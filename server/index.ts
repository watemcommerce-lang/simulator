import express from "express";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path from "node:path";
import { createContext } from "./trpc";
import { appRouter } from "./router";
import { authMiddleware } from "./auth";
import { db } from "./db";
import { questions, users } from "./schema";
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
// URL: /admin/make-admin?secret=IMPORTAR2024&email=teu@email.com
// =============================================================================

app.get("/admin/make-admin", async (req, res) => {
  const secret = req.query.secret as string;
  const email = req.query.email as string;
  const IMPORT_SECRET = process.env.IMPORT_SECRET ?? "IMPORTAR2024";

  if (secret !== IMPORT_SECRET) return res.status(401).send("Senha incorrecta.");
  if (!email) return res.status(400).send("Forneça ?email=teu@email.com");

  try {
    await db.update(users).set({ role: "admin" }).where(eq(users.email, email.toLowerCase().trim()));
    res.send(`✅ ${email} é agora admin. Faça logout e login novamente no site.`);
  } catch (err: any) {
    res.status(500).send(`Erro: ${err.message}`);
  }
});

// =============================================================================
// Rota: importar questões do ENEM
// URL: /admin/import?secret=IMPORTAR2024&year=2023
// =============================================================================

app.get("/admin/import", async (req, res) => {
  const secret = req.query.secret as string;
  const IMPORT_SECRET = process.env.IMPORT_SECRET ?? "IMPORTAR2024";
  if (secret !== IMPORT_SECRET) return res.status(401).send("Senha incorrecta.");

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
      if (r < 0.75) return { a: 1.2, b: 0.5, c: 0.2, nivel: "Alta" as const };
      return { a: 1.5, b: 1.5, c: 0.2, nivel: "Muito Alta" as const };
    }

    let inseridas = 0;
    let ignoradas = 0;
    let erros = 0;

    for (const q of allQuestions) {
      // -----------------------------------------------------------------------
      // 1. Alternativas: preserva imagens como [Imagem: url] para renderização
      // -----------------------------------------------------------------------
      const alternativas: Record<string, string> = {};
      for (const alt of (q.alternatives ?? [])) {
        if (alt.text && alt.file) {
          // Texto + imagem: concatena
          alternativas[alt.letter] = `${alt.text}\n[Imagem: ${alt.file}]`;
        } else if (alt.file) {
          // Só imagem: usa tag renderizável (não descarta!)
          alternativas[alt.letter] = `[Imagem: ${alt.file}]`;
        } else {
          alternativas[alt.letter] = alt.text ?? "";
        }
      }
      // Descarta só se não tiver nenhuma alternativa mapeada
      if (Object.keys(alternativas).length < 2) {
        ignoradas++;
        log(`  [ignorada] Questão ${q.index}/${q.year}: apenas ${Object.keys(alternativas).length} alternativa(s).`);
        continue;
      }

      // -----------------------------------------------------------------------
      // 2. Enunciado: context + alternativesIntroduction (o "comando")
      //    Converte qualquer formato de imagem Markdown para [Imagem: url]
      // -----------------------------------------------------------------------

      // Converte formatos vindos da API para o padrão da plataforma:
      //   ![](url)       → [Imagem: url]
      //   ![alt](url)    → [Imagem: url]
      function normalizeImages(text: string): string {
        return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "[Imagem: $2]");
      }

      const partes: string[] = [];
      if (q.context)                  partes.push(normalizeImages(q.context.trim()));
      if (q.alternativesIntroduction) partes.push(normalizeImages(q.alternativesIntroduction.trim()));

      // Adiciona imagens do campo files que ainda não estejam no enunciado
      const textoAtual = partes.join(" ");
      for (const imgUrl of (q.files ?? [])) {
        if (!textoAtual.includes(imgUrl)) {
          partes.push(`[Imagem: ${imgUrl}]`);
        }
      }

      const enunciado = partes.join("\n\n") || `Questão ${q.index} — ENEM ${q.year}`;

      // -----------------------------------------------------------------------
      // 3. Insere no banco
      // -----------------------------------------------------------------------
      const tri = estimateTRI(q.index);
      try {
        await db.insert(questions).values({
          fonte: "ENEM", ano: q.year,
          conteudo_principal: "Matemática e suas Tecnologias",
          tags: ["Matemática", "ENEM", `ENEM ${q.year}`],
          nivel_dificuldade: tri.nivel,
          param_a: tri.a, param_b: tri.b, param_c: tri.c,
          enunciado,
          url_imagem: null,          // imagens agora ficam inline no enunciado
          alternativas, gabarito: (q.correctAlternative ?? "A").toUpperCase(),
          comentario_resolucao: null, active: true,
        });
        inseridas++;
        if (inseridas % 5 === 0) log(`  ${inseridas} inseridas...`);
      } catch (err: any) {
        erros++;
        log(`  [erro] Questão ${q.index}/${q.year}: ${err.message}`);
      }
    }

    log(`\nConcluído: ${inseridas} inseridas, ${ignoradas} ignoradas (sem alternativas), ${erros} erros de banco.`);
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
