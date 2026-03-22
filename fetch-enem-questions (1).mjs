/**
 * fetch-enem-questions.mjs
 * ------------------------
 * Busca questões de Matemática da API enem.dev e importa para o banco.
 *
 * Uso:
 *   node fetch-enem-questions.mjs              → importa todos os anos disponíveis
 *   node fetch-enem-questions.mjs --year 2023  → importa só um ano
 *   node fetch-enem-questions.mjs --dry-run    → mostra o que seria importado, sem inserir
 *
 * Requisito: DATABASE_URL no .env
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const BASE_URL = "https://api.enem.dev/v1";
const DISCIPLINE = "matematica";
const DELAY_MS = 1100; // respeita o rate limit de 1 req/seg

const isDryRun = process.argv.includes("--dry-run");
const yearArg = process.argv.find((a) => a.startsWith("--year="))?.split("=")[1]
  ?? process.argv[process.argv.indexOf("--year") + 1];

// =============================================================================
// Parâmetros TRI padrão por nível de dificuldade estimado
// A API não fornece TRI — usamos valores razoáveis que podes calibrar depois
// =============================================================================

function estimateTRI(index, total) {
  // Questões do ENEM geralmente aumentam de dificuldade ao longo da prova
  const ratio = index / total;

  if (ratio < 0.25) return { a: 0.8, b: -1.5, c: 0.2, nivel: "Baixa" };
  if (ratio < 0.50) return { a: 1.0, b: -0.5, c: 0.2, nivel: "Média" };
  if (ratio < 0.75) return { a: 1.2, b: 0.5,  c: 0.2, nivel: "Alta" };
  return               { a: 1.5, b: 1.5,  c: 0.2, nivel: "Muito Alta" };
}

// =============================================================================
// Helpers
// =============================================================================

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} em ${url}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// =============================================================================
// Busca questões de matemática de um ano (com paginação)
// =============================================================================

async function fetchMathQuestions(year) {
  const allQuestions = [];
  let offset = 0;
  const limit = 50; // máximo razoável por página

  console.log(`  Buscando questões de ${year}...`);

  while (true) {
    await sleep(DELAY_MS);

    const url = `${BASE_URL}/exams/${year}/questions?limit=${limit}&offset=${offset}`;
    const data = await fetchJson(url);

    // Filtra só matemática
    const mathQs = data.questions.filter((q) => q.discipline === DISCIPLINE);
    allQuestions.push(...mathQs);

    console.log(`    Página offset=${offset}: ${data.questions.length} total, ${mathQs.length} matemática`);

    if (!data.metadata.hasMore) break;
    offset += limit;
  }

  return allQuestions;
}

// =============================================================================
// Converte questão da API para o formato do nosso schema
// =============================================================================

function mapQuestion(apiQ, triParams) {
  // Alternativas: { A: "texto", B: "texto", ... }
  const alternativas = {};
  for (const alt of apiQ.alternatives) {
    alternativas[alt.letter] = alt.text || `[Ver imagem: ${alt.file ?? ""}]`;
  }

  // Enunciado: combina context + alternativesIntroduction
  const enunciado = [
    apiQ.context ?? "",
    apiQ.alternativesIntroduction ? `\n\n${apiQ.alternativesIntroduction}` : "",
  ].join("").trim();

  // Tags
  const tags = ["Matemática", "ENEM", `ENEM ${apiQ.year}`];

  // Imagem do enunciado (primeira da lista, se existir)
  const url_imagem = apiQ.files?.[0] ?? null;

  return {
    fonte: "ENEM",
    ano: apiQ.year,
    conteudo_principal: "Matemática e suas Tecnologias",
    tags: JSON.stringify(tags),
    nivel_dificuldade: triParams.nivel,
    param_a: triParams.a,
    param_b: triParams.b,
    param_c: triParams.c,
    enunciado: enunciado || `Questão ${apiQ.index} — ENEM ${apiQ.year}`,
    url_imagem,
    alternativas: JSON.stringify(alternativas),
    gabarito: apiQ.correctAlternative.toUpperCase(),
    comentario_resolucao: null,
    // Identificador externo para evitar duplicatas
    enem_index: apiQ.index,
    enem_year: apiQ.year,
  };
}

// =============================================================================
// Insere no banco com verificação de duplicatas
// =============================================================================

async function insertQuestions(db, questions) {
  let inseridas = 0;
  let ignoradas = 0;

  for (const q of questions) {
    // Verifica duplicata por ano + índice
    const [rows] = await db.execute(
      "SELECT id FROM questions WHERE ano = ? AND JSON_EXTRACT(tags, '$[2]') = ? AND LEFT(enunciado, 80) = LEFT(?, 80) LIMIT 1",
      [q.ano, `ENEM ${q.ano}`, q.enunciado]
    );

    if (rows.length > 0) {
      ignoradas++;
      continue;
    }

    await db.execute(
      `INSERT INTO questions
         (fonte, ano, conteudo_principal, tags, nivel_dificuldade,
          param_a, param_b, param_c,
          enunciado, url_imagem, alternativas, gabarito, comentario_resolucao, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        q.fonte,
        q.ano,
        q.conteudo_principal,
        q.tags,
        q.nivel_dificuldade,
        q.param_a,
        q.param_b,
        q.param_c,
        q.enunciado,
        q.url_imagem,
        q.alternativas,
        q.gabarito,
        q.comentario_resolucao,
      ]
    );

    inseridas++;
  }

  return { inseridas, ignoradas };
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL não definida.");
    process.exit(1);
  }

  // Busca anos disponíveis
  console.log("Buscando anos disponíveis na API...");
  await sleep(DELAY_MS);
  const exams = await fetchJson(`${BASE_URL}/exams`);

  let years = exams.map((e) => e.year).sort((a, b) => b - a); // mais recente primeiro

  // Filtra só anos que têm matemática
  years = years.filter((y) =>
    exams.find((e) => e.year === y)?.disciplines?.some((d) => d.value === DISCIPLINE)
  );

  // Se --year foi passado, filtra só aquele
  if (yearArg) {
    const y = Number(yearArg);
    if (!years.includes(y)) {
      console.error(`❌ Ano ${y} não disponível. Anos disponíveis: ${years.join(", ")}`);
      process.exit(1);
    }
    years = [y];
  }

  console.log(`Anos a processar: ${years.join(", ")}\n`);

  if (isDryRun) {
    console.log("Modo --dry-run. Buscando questões sem inserir...\n");
  }

  const db = isDryRun ? null : await mysql.createConnection(dbUrl);

  let totalInseridas = 0;
  let totalIgnoradas = 0;

  try {
    for (const year of years) {
      const apiQuestions = await fetchMathQuestions(year);

      if (apiQuestions.length === 0) {
        console.log(`  Nenhuma questão de matemática em ${year}.\n`);
        continue;
      }

      console.log(`  Total de questões de matemática em ${year}: ${apiQuestions.length}`);

      // Mapeia para o nosso formato
      const mapped = apiQuestions.map((q, i) => {
        const tri = estimateTRI(q.index, 45); // ENEM tem 45 questões de mat.
        return mapQuestion(q, tri);
      });

      if (isDryRun) {
        console.log(`  [dry-run] Seriam inseridas: ${mapped.length}`);
        console.log(`  Exemplo:`, JSON.stringify(mapped[0], null, 2).slice(0, 400));
        console.log();
        continue;
      }

      const { inseridas, ignoradas } = await insertQuestions(db, mapped);
      totalInseridas += inseridas;
      totalIgnoradas += ignoradas;
      console.log(`  ✅ ${inseridas} inseridas, ${ignoradas} ignoradas (duplicatas)\n`);
    }

    if (!isDryRun) {
      console.log(`\nConcluído: ${totalInseridas} questões inseridas, ${totalIgnoradas} ignoradas.`);
    }

  } finally {
    if (db) await db.end();
  }
}

main().catch((err) => {
  console.error("❌ Erro:", err.message);
  process.exit(1);
});
