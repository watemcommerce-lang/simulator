import express from "express";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path from "node:path";
import { createContext } from "./trpc";
import { appRouter } from "./router";
import { authMiddleware } from "./auth";
import { db } from "./db";
import { questions, users, simulationAnswers } from "./schema";
import { eq } from "drizzle-orm";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(authMiddleware);

// =============================================================================
// Rota: promover utilizador a admin
// =============================================================================
app.get("/admin/make-admin", async (req, res) => {
  const secret = req.query.secret as string;
  const email = req.query.email as string;
  if (secret !== (process.env.IMPORT_SECRET ?? "IMPORTAR2024")) return res.status(401).send("Senha incorrecta.");
  if (!email) return res.status(400).send("Forneça ?email=teu@email.com");
  try {
    await db.update(users).set({ role: "admin" }).where(eq(users.email, email.toLowerCase().trim()));
    res.send(`✅ ${email} é agora admin. Faça logout e login novamente.`);
  } catch (err: any) {
    res.status(500).send(`Erro: ${err.message}`);
  }
});

// =============================================================================
// Rota: excluir TODAS as questões (rota directa — contorna FK restrict)
// POST /admin/delete-all-questions   body: { secret: "ExcluirWaldo16@" }
// =============================================================================
app.post("/admin/delete-all-questions", async (req, res) => {
  const { secret } = req.body ?? {};
  if (secret !== "ExcluirWaldo16@") return res.status(401).json({ error: "Senha incorrecta." });
  try {
    // 1. Apaga respostas (FK restrict impede apagar questões directamente)
    await db.delete(simulationAnswers);
    // 2. Agora apaga as questões
    await db.delete(questions);
    res.json({ success: true, message: "Todas as questões foram excluídas." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// Rota: importar questões do ENEM
// =============================================================================
app.get("/admin/import", async (req, res) => {
  const secret = req.query.secret as string;
  if (secret !== (process.env.IMPORT_SECRET ?? "IMPORTAR2024")) return res.status(401).send("Senha incorrecta.");

  const year = Number(req.query.year ?? 2023);
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  const log = (msg: string) => { console.log(msg); res.write(msg + "\n"); };
  log(`Iniciando importação — ENEM ${year}...`);

  try {
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let offset = 0;
    const limit = 50;
    let hasMore = true;
    const allQuestions: any[] = [];

    while (hasMore) {
      await delay(1200);
      const url = `https://api.enem.dev/v1/exams/${year}/questions?limit=${limit}&offset=${offset}`;
      const resp = await fetch(url);
      if (!resp.ok) { log(`Erro HTTP ${resp.status}`); break; }
      const data = await resp.json();
      const mathQs = data.questions.filter((q: any) => q.discipline === "matematica");
      allQuestions.push(...mathQs);
      log(`  Página ${offset}: ${mathQs.length} questões de matemática`);
      hasMore = data.metadata.hasMore;
      offset += limit;
    }

    log(`\nTotal: ${allQuestions.length} questões`);

    function estimateTRI(index: number) {
      const r = index / 45;
      if (r < 0.25) return { a: 0.8, b: -1.5, c: 0.2, nivel: "Baixa" as const };
      if (r < 0.50) return { a: 1.0, b: -0.5, c: 0.2, nivel: "Média" as const };
      if (r < 0.75) return { a: 1.2, b: 0.5,  c: 0.2, nivel: "Alta" as const };
      return               { a: 1.5, b: 1.5,  c: 0.2, nivel: "Muito Alta" as const };
    }

    let inseridas = 0;
    let ignoradas = 0;

    for (const q of allQuestions) {
      const alternativas: Record<string, { text: string; file: string | null }> = {};
      for (const alt of (q.alternatives ?? [])) {
        alternativas[alt.letter] = { text: alt.text ?? "", file: alt.file ?? null };
      }
      if (Object.keys(alternativas).length < 2) { ignoradas++; continue; }
      const tri = estimateTRI(q.index);
      try {
        await db.insert(questions).values({
          fonte: "ENEM", ano: q.year,
          conteudo_principal: "Matemática e suas Tecnologias",
          tags: ["Matemática", "ENEM", `ENEM ${q.year}`],
          nivel_dificuldade: tri.nivel,
          param_a: tri.a, param_b: tri.b, param_c: tri.c,
          enunciado: (q.context ?? `Questão ${q.index} — ENEM ${q.year}`).trim(),
          url_imagem: q.files?.[0] ?? null,
          alternativas,
          gabarito: (q.correctAlternative ?? "A").toUpperCase(),
          comentario_resolucao: null, active: true,
        });
        inseridas++;
        if (inseridas % 5 === 0) log(`  ${inseridas} inseridas...`);
      } catch { ignoradas++; }
    }

    log(`\nConcluído: ${inseridas} inseridas, ${ignoradas} ignoradas.`);
  } catch (err: any) {
    log(`Erro: ${err.message}`);
  }
  res.end();
});

// =============================================================================
// tRPC
// =============================================================================
app.use("/api/trpc", createExpressMiddleware({
  router: appRouter,
  createContext,
  onError: !isProd ? ({ path, error }) => console.error(`[tRPC] /${path}:`, error.message) : undefined,
}));

// =============================================================================
// Frontend estático
// =============================================================================
if (isProd) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 http://localhost:${PORT} [${process.env.NODE_ENV ?? "development"}]`);
});

export type { AppRouter } from "./router";
