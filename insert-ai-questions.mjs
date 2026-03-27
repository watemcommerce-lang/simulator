/**
 * insert-ai-questions.mjs
 * =======================
 * Insere questões geradas por IA no banco de dados.
 * As questões devem estar num arquivo JSON seguindo o formato do template.
 *
 * Uso:
 *   node insert-ai-questions.mjs questions.json
 *   node insert-ai-questions.mjs questions.json --dry-run   → valida sem inserir
 *
 * Requisito no .env:
 *   DATABASE_URL=mysql://...
 */

import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config();

// =============================================================================
// Parâmetros TRI por nível de dificuldade
// =============================================================================

const TRI_PARAMS = {
  "Muito Baixa": { a: 0.7, b: -2.0, c: 0.2 },
  "Baixa":       { a: 0.8, b: -1.0, c: 0.2 },
  "Média":       { a: 1.0, b:  0.0, c: 0.2 },
  "Alta":        { a: 1.2, b:  1.0, c: 0.2 },
  "Muito Alta":  { a: 1.5, b:  2.0, c: 0.2 },
};

const NIVEIS_VALIDOS = Object.keys(TRI_PARAMS);

const TOPICOS_VALIDOS = [
  "Funções", "Funções Quadráticas", "Funções Exponenciais", "Funções Logarítmicas",
  "Progressões Aritméticas", "Progressões Geométricas", "Trigonometria",
  "Geometria Plana", "Geometria Espacial", "Geometria Analítica",
  "Matrizes e Determinantes", "Sistemas Lineares", "Probabilidade",
  "Estatística e Análise de Dados", "Combinatória", "Álgebra",
  "Números e Operações", "Raciocínio Lógico", "Matemática Financeira", "Polinômios",
  "Matemática e suas Tecnologias",
];

// =============================================================================
// Validação de uma questão
// =============================================================================

function validateQuestion(q, index) {
  const errors = [];

  if (!q.enunciado || q.enunciado.trim().length < 20)
    errors.push("enunciado ausente ou muito curto (mínimo 20 caracteres)");

  if (!q.alternativas || typeof q.alternativas !== "object")
    errors.push("alternativas ausentes ou inválidas");
  else {
    const keys = Object.keys(q.alternativas);
    if (keys.length < 2)
      errors.push(`apenas ${keys.length} alternativa(s) — mínimo 2`);
    const letrasEsperadas = ["A", "B", "C", "D", "E"];
    for (const k of keys) {
      if (!letrasEsperadas.includes(k))
        errors.push(`alternativa inválida: "${k}" — use A, B, C, D ou E`);
    }
  }

  if (!q.gabarito || q.gabarito.length !== 1)
    errors.push("gabarito ausente ou inválido (deve ser uma letra: A-E)");
  else if (q.alternativas && !q.alternativas[q.gabarito.toUpperCase()])
    errors.push(`gabarito "${q.gabarito}" não corresponde a nenhuma alternativa`);

  if (!q.nivel_dificuldade || !NIVEIS_VALIDOS.includes(q.nivel_dificuldade))
    errors.push(`nivel_dificuldade inválido: "${q.nivel_dificuldade}" — use: ${NIVEIS_VALIDOS.join(", ")}`);

  if (!q.conteudo_principal)
    errors.push("conteudo_principal ausente");
  else if (!TOPICOS_VALIDOS.includes(q.conteudo_principal))
    console.warn(`  ⚠️  [${index}] conteudo_principal "${q.conteudo_principal}" não está na lista padrão — será aceito assim mesmo`);

  return errors;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const filePath = process.argv.find(a => a.endsWith(".json") && !a.includes("node"));

  if (!filePath) {
    console.error("❌ Informe o arquivo JSON: node insert-ai-questions.mjs questions.json");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  // Lê e parseia o JSON
  let questoes;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    questoes = JSON.parse(raw);
    if (!Array.isArray(questoes)) throw new Error("O arquivo deve ser um array JSON.");
  } catch (err) {
    console.error(`❌ Erro ao ler JSON: ${err.message}`);
    process.exit(1);
  }

  console.log(`📋 ${questoes.length} questão(ões) encontrada(s) em "${path.basename(filePath)}"\n`);

  // Valida todas antes de inserir qualquer uma
  let hasErrors = false;
  for (let i = 0; i < questoes.length; i++) {
    const erros = validateQuestion(questoes[i], i + 1);
    if (erros.length > 0) {
      console.error(`  ❌ Questão ${i + 1} (${questoes[i].conteudo_principal ?? "sem tópico"}):`);
      erros.forEach(e => console.error(`      • ${e}`));
      hasErrors = true;
    } else {
      console.log(`  ✅ Questão ${i + 1}: ${questoes[i].conteudo_principal} | ${questoes[i].nivel_dificuldade}`);
    }
  }

  if (hasErrors) {
    console.error("\n❌ Corrija os erros acima antes de inserir.");
    process.exit(1);
  }

  if (isDryRun) {
    console.log("\n🟡 Modo --dry-run: validação OK, nada foi inserido.");
    return;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL não definida no .env");
    process.exit(1);
  }

  const db = await mysql.createConnection(dbUrl);

  console.log("\n💾 Inserindo no banco...\n");

  let inseridas = 0;
  let ignoradas = 0;

  for (let i = 0; i < questoes.length; i++) {
    const q = questoes[i];
    const tri = TRI_PARAMS[q.nivel_dificuldade] ?? TRI_PARAMS["Média"];

    // Tags: garante mínimo + adiciona as do JSON
    const tags = Array.isArray(q.tags) ? q.tags : [];
    if (!tags.includes("Matemática")) tags.push("Matemática");
    if (!tags.includes("ENEM")) tags.push("ENEM");
    if (!tags.includes(q.conteudo_principal)) tags.push(q.conteudo_principal);

    try {
      await db.execute(
        `INSERT INTO questions
           (fonte, ano, conteudo_principal, tags, nivel_dificuldade,
            param_a, param_b, param_c,
            enunciado, url_imagem, alternativas, gabarito,
            comentario_resolucao, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          "IA",
          q.ano ?? new Date().getFullYear(),
          q.conteudo_principal,
          JSON.stringify(tags),
          q.nivel_dificuldade,
          tri.a,
          tri.b,
          tri.c,
          q.enunciado.trim(),
          q.url_imagem ?? null,
          JSON.stringify(q.alternativas),
          q.gabarito.toUpperCase(),
          q.comentario_resolucao?.trim() ?? null,
        ]
      );
      console.log(`  ✅ Questão ${i + 1} inserida: ${q.conteudo_principal} | ${q.nivel_dificuldade}`);
      inseridas++;
    } catch (err) {
      console.error(`  ❌ Questão ${i + 1}: ${err.message}`);
      ignoradas++;
    }
  }

  await db.end();
  console.log(`\n🎉 Concluído: ${inseridas} inserida(s), ${ignoradas} erro(s).`);
}

main().catch(err => {
  console.error("❌ Erro fatal:", err.message);
  process.exit(1);
});
