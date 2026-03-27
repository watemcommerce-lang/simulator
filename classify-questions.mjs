/**
 * classify-questions.mjs
 * ======================
 * Lê as questões do banco que ainda não têm tags de conteúdo reais
 * e usa a API do Claude (Anthropic) para classificar automaticamente:
 *   - conteudo_principal  (ex: "Funções", "Geometria Plana", ...)
 *   - tags                (lista de subtópicos)
 *   - nivel_dificuldade   (Baixa / Média / Alta / Muito Alta)
 *   - param_b             (ajuste do parâmetro TRI de dificuldade)
 *
 * Uso:
 *   node classify-questions.mjs              → classifica todas sem tag real
 *   node classify-questions.mjs --dry-run    → mostra classificações sem salvar
 *   node classify-questions.mjs --limit 20   → processa só 20 questões
 *
 * Requisitos no .env:
 *   DATABASE_URL=mysql://...
 *   ANTHROPIC_API_KEY=sk-ant-...
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

// =============================================================================
// Config
// =============================================================================

const DELAY_MS       = 1200;   // pausa entre chamadas à API (evita rate limit)
const BATCH_SIZE     = 5;      // questões processadas em paralelo por lote
const MODEL          = "claude-haiku-4-5-20251001"; // rápido e barato para classificação

const isDryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find(a => a.startsWith("--limit="))?.split("=")[1]
  ?? process.argv[process.argv.indexOf("--limit") + 1];
const LIMIT = limitArg ? Number(limitArg) : Infinity;

// Tópicos válidos de Matemática ENEM — a IA deve escolher um destes
const TOPICOS_VALIDOS = [
  "Funções",
  "Funções Quadráticas",
  "Funções Exponenciais",
  "Funções Logarítmicas",
  "Progressões Aritméticas",
  "Progressões Geométricas",
  "Trigonometria",
  "Geometria Plana",
  "Geometria Espacial",
  "Geometria Analítica",
  "Matrizes e Determinantes",
  "Sistemas Lineares",
  "Probabilidade",
  "Estatística e Análise de Dados",
  "Combinatória",
  "Álgebra",
  "Números e Operações",
  "Raciocínio Lógico",
  "Matemática Financeira",
  "Polinômios",
];

// =============================================================================
// Helpers
// =============================================================================

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// =============================================================================
// Classifica uma questão usando a API do Claude
// =============================================================================

async function classifyQuestion(apiKey, question) {
  const prompt = `Você é um especialista em Matemática do ENEM. Analise a questão abaixo e classifique-a.

QUESTÃO (id=${question.id}, ano=${question.ano ?? "?"}):
${question.enunciado.slice(0, 1200)}

ALTERNATIVAS:
${Object.entries(JSON.parse(question.alternativas))
  .map(([k, v]) => `${k}) ${String(v).slice(0, 200)}`)
  .join("\n")}

Responda SOMENTE com um JSON válido, sem markdown, sem explicação, exatamente neste formato:
{
  "conteudo_principal": "<um dos tópicos da lista>",
  "tags": ["<tópico principal>", "<subtópico 1>", "<subtópico 2>"],
  "nivel_dificuldade": "<Baixa|Média|Alta|Muito Alta>",
  "param_b": <número entre -2.0 e 2.5>,
  "justificativa": "<uma frase curta explicando a classificação>"
}

Tópicos válidos para conteudo_principal: ${TOPICOS_VALIDOS.join(", ")}

Critérios de dificuldade:
- Baixa: cálculo direto, fórmula simples
- Média: dois ou três passos lógicos
- Alta: raciocínio complexo, múltiplos conceitos
- Muito Alta: abstração elevada, contextualização densa

param_b representa a dificuldade na escala TRI: -2.0 = muito fácil, 0 = médio, 2.5 = muito difícil.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Claude: HTTP ${response.status} — ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const raw = data.content?.[0]?.text ?? "";

  // Garante que pegamos só o JSON, mesmo que venha com texto extra
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Resposta não contém JSON válido: ${raw.slice(0, 200)}`);

  const parsed = JSON.parse(jsonMatch[0]);

  // Valida campos obrigatórios
  if (!parsed.conteudo_principal || !parsed.nivel_dificuldade) {
    throw new Error(`JSON incompleto: ${raw.slice(0, 200)}`);
  }

  // Garante que o tópico é válido
  if (!TOPICOS_VALIDOS.includes(parsed.conteudo_principal)) {
    // Tenta achar o mais próximo
    const lower = parsed.conteudo_principal.toLowerCase();
    const match = TOPICOS_VALIDOS.find(t => t.toLowerCase().includes(lower) || lower.includes(t.toLowerCase()));
    parsed.conteudo_principal = match ?? "Matemática e suas Tecnologias";
  }

  // Garante tags mínimas
  if (!Array.isArray(parsed.tags) || parsed.tags.length === 0) {
    parsed.tags = ["Matemática", "ENEM", parsed.conteudo_principal];
  }
  // Sempre inclui ENEM e Matemática nas tags
  if (!parsed.tags.includes("ENEM")) parsed.tags.push("ENEM");
  if (!parsed.tags.includes("Matemática")) parsed.tags.push("Matemática");

  return parsed;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const dbUrl    = process.env.DATABASE_URL;
  const apiKey   = process.env.ANTHROPIC_API_KEY;

  if (!dbUrl)   { console.error("❌ DATABASE_URL não definida no .env"); process.exit(1); }
  if (!apiKey)  { console.error("❌ ANTHROPIC_API_KEY não definida no .env"); process.exit(1); }

  const db = await mysql.createConnection(dbUrl);

  console.log("🔍 Buscando questões sem classificação real...\n");

  // Busca questões cujo conteudo_principal ainda é o valor genérico de importação
  const [rows] = await db.execute(
    `SELECT id, ano, enunciado, alternativas, conteudo_principal, nivel_dificuldade, tags
     FROM questions
     WHERE active = 1
       AND (conteudo_principal = 'Matemática e suas Tecnologias' OR conteudo_principal IS NULL)
     ORDER BY id ASC
     LIMIT ?`,
    [LIMIT === Infinity ? 99999 : LIMIT]
  );

  if (rows.length === 0) {
    console.log("✅ Nenhuma questão pendente de classificação.");
    await db.end();
    return;
  }

  console.log(`📋 ${rows.length} questões para classificar.\n`);

  if (isDryRun) console.log("🟡 Modo --dry-run: não salvará no banco.\n");

  let ok = 0, erros = 0;

  // Processa em lotes para não sobrecarregar a API
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const lote = rows.slice(i, i + BATCH_SIZE);

    const resultados = await Promise.allSettled(
      lote.map(q => classifyQuestion(apiKey, q))
    );

    for (let j = 0; j < lote.length; j++) {
      const q   = lote[j];
      const res = resultados[j];

      if (res.status === "rejected") {
        console.error(`  ❌ id=${q.id}: ${res.reason?.message ?? res.reason}`);
        erros++;
        continue;
      }

      const c = res.value;
      console.log(`  ✅ id=${q.id} | ${c.conteudo_principal} | ${c.nivel_dificuldade} | ${c.justificativa}`);

      if (!isDryRun) {
        await db.execute(
          `UPDATE questions
           SET conteudo_principal = ?,
               tags               = ?,
               nivel_dificuldade  = ?,
               param_b            = ?
           WHERE id = ?`,
          [
            c.conteudo_principal,
            JSON.stringify(c.tags),
            c.nivel_dificuldade,
            c.param_b ?? 0,
            q.id,
          ]
        );
      }
      ok++;
    }

    // Pausa entre lotes
    if (i + BATCH_SIZE < rows.length) {
      process.stdout.write(`\n  ⏳ Aguardando ${DELAY_MS}ms...\n\n`);
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n✅ Concluído: ${ok} classificadas, ${erros} erros.`);
  await db.end();
}

main().catch(err => {
  console.error("❌ Erro fatal:", err.message);
  process.exit(1);
});
