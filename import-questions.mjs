/**
 * import-questions.mjs
 * --------------------
 * Insere questões no banco usando o formato JSON do professor.
 * Usa mysql2 directamente — sem ORM, sem dependências extra.
 *
 * Uso:
 *   node import-questions.mjs
 *   node import-questions.mjs --dry-run   (valida sem inserir)
 *
 * Requisito: DATABASE_URL no ambiente (.env ou variável de shell)
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// =============================================================================
// Questões — adiciona as tuas aqui no mesmo formato
// =============================================================================

const questions = [
  {
    fonte: "ENEM",
    ano: 2025,
    conteudo_principal: "Logaritmos",
    tags: ["Física", "Ondulatória", "Matemática", "Logaritmos", "ENEM 2025"],
    nivel_dificuldade: "Baixa",
    parametros_tri: { a: 1.0, b: -1.5, c: 0.2 },
    enunciado:
      "O nível sonoro, em decibel (dB), é calculado pela expressão:\n\n$$ n = 10 \\log_{10}\\left(\\frac{I}{I_0}\\right) $$\n\nUma conversa normal entre duas pessoas gera sons de níveis sonoros entre 50 e 60 dB, enquanto pessoas gritando podem gerar sons de níveis superiores a 100 dB. Supondo que, no centro de um estádio de futebol, foram realizadas medidas para avaliar o ruído médio de uma pessoa gritando a palavra \"gol\" em diferentes posições das arquibancadas. O valor médio obtido, considerando um grande número de medidas, foi de 100 dB. Com esse dado, estimou-se o ruído sonoro produzido por 10.000 pessoas, distribuídas aleatoriamente nas arquibancadas, enquanto gritavam, simultaneamente, a palavra \"gol\".\n\nO valor médio estimado para o ruído produzido por essas pessoas, na posição central desse estádio hipotético, foi de",
    url_imagem: null,
    alternativas: {
      A: "$60\\text{ dB}$.",
      B: "$104\\text{ dB}$.",
      C: "$140\\text{ dB}$.",
      D: "$400\\text{ dB}$.",
      E: "$800\\text{ dB}$.",
    },
    gabarito: "C",
    comentario_resolucao:
      "1. O ruído de 1 pessoa é $100\\text{ dB}$. Logo: $100 = 10 \\log_{10}(I_1 / I_0) \\Rightarrow I_1 = 10^{10} I_0$.\n2. A intensidade gerada por 10.000 pessoas ($10^4$) é $I_{total} = 10^{14} I_0$.\n3. Calculando o novo nível sonoro: $n = 10 \\log_{10}(10^{14}) = 140\\text{ dB}$.",
  },
  {
    fonte: "ENEM",
    ano: 2025,
    conteudo_principal: "Razões e Proporções",
    tags: ["Matemática", "Grandezas Proporcionais", "Razões e Proporções", "ENEM 2025"],
    nivel_dificuldade: "Baixa",
    parametros_tri: { a: 0.8, b: -2.0, c: 0.2 },
    enunciado:
      "Na cantina de uma escola, há cinco alimentos vendidos em pacotes com diferentes quantidades de porções. As informações nutricionais contidas nos rótulos desses produtos estão indicadas a seguir:\n\n* **Batata chips:** Pacote com 3 porções de 50 g. 170 mg de sódio por porção.\n* **Palitos salgados:** Pacote com 4 porções de 20 g. 501 mg de sódio por porção.\n* **Biscoito multigrãos:** Pacote com 8 porções de 25 g. 264 mg de sódio por porção.\n* **Biscoito de polvilho:** Pacote com 6 porções de 15 g. 175 mg de sódio por porção.\n* **Biscoito de água e sal:** Pacote com 5 porções de 40 g. 166 mg de sódio por porção.\n\nUma estudante opta sempre pelo alimento com a menor quantidade total de sódio por pacote.\nQual desses produtos deve ser o escolhido pela estudante?",
    url_imagem: null,
    alternativas: {
      A: "Batata chips.",
      B: "Palitos salgados.",
      C: "Biscoito multigrãos.",
      D: "Biscoito de polvilho.",
      E: "Biscoito de água e sal.",
    },
    gabarito: "A",
    comentario_resolucao:
      "Basta multiplicar a quantidade de porções pela quantidade de sódio por porção:\n- Batata chips: $3 \\times 170 = 510\\text{ mg}$ (menor)\n- Palitos salgados: $4 \\times 501 = 2004\\text{ mg}$\n- Biscoito multigrãos: $8 \\times 264 = 2112\\text{ mg}$\n- Biscoito de polvilho: $6 \\times 175 = 1050\\text{ mg}$\n- Água e sal: $5 \\times 166 = 830\\text{ mg}$",
  },
  {
    fonte: "ENEM",
    ano: 2025,
    conteudo_principal: "Gráficos de Funções",
    tags: ["Matemática", "Funções", "Gráficos", "Leitura de Gráficos", "ENEM 2025"],
    nivel_dificuldade: "Baixa",
    parametros_tri: { a: 1.1, b: -1.0, c: 0.2 },
    enunciado:
      "Pesquisas na área de neurobiologia confirmam que a prática meditativa é responsável por diminuir consideravelmente a frequência respiratória para praticantes avançados. O gráfico apresenta a relação da frequência respiratória (rpm) em relação ao tempo (min), em que $f_1$ representa a frequência no instante $t_1$, no qual se inicia a prática meditativa; e $f_2$, a frequência no instante $t_2$, a partir do qual esta se estabiliza.\n\nA partir do instante $t_1$, o comportamento da frequência respiratória em relação ao tempo",
    url_imagem: null,
    alternativas: {
      A: "mantém-se constante.",
      B: "é diretamente proporcional ao tempo.",
      C: "é inversamente proporcional ao tempo.",
      D: "diminui até o instante $t_2$, a partir do qual se torna constante.",
      E: "diminui de forma proporcional ao tempo, tanto entre $t_1$ e $t_2$ quanto após $t_2$.",
    },
    gabarito: "D",
    comentario_resolucao:
      "Analisando o gráfico: no momento $t_1$ a curva sofre uma queda suave até $t_2$. A partir de $t_2$ a linha torna-se horizontal, indicando que a frequência se estabilizou (tornou-se constante).",
  },
];

// =============================================================================
// Validação
// =============================================================================

const NIVEIS_VALIDOS = ["Muito Baixa", "Baixa", "Média", "Alta", "Muito Alta"];

function validar(q, idx) {
  const erros = [];
  if (!q.conteudo_principal) erros.push("conteudo_principal em falta");
  if (!NIVEIS_VALIDOS.includes(q.nivel_dificuldade))
    erros.push(`nivel_dificuldade inválido: "${q.nivel_dificuldade}"`);
  if (!q.enunciado || q.enunciado.length < 10) erros.push("enunciado muito curto");
  if (!q.alternativas || Object.keys(q.alternativas).length < 2)
    erros.push("precisa de pelo menos 2 alternativas");
  if (!q.gabarito || q.gabarito.length !== 1) erros.push("gabarito inválido");
  if (!Object.keys(q.alternativas ?? {}).includes(q.gabarito))
    erros.push(`gabarito "${q.gabarito}" não existe nas alternativas`);
  if (!q.parametros_tri?.a || !("b" in (q.parametros_tri ?? {})) || !("c" in (q.parametros_tri ?? {})))
    erros.push("parametros_tri incompletos (a, b, c obrigatórios)");
  return erros;
}

// =============================================================================
// Main
// =============================================================================

const isDryRun = process.argv.includes("--dry-run");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL não definida.");
    process.exit(1);
  }

  // Valida todas antes de inserir qualquer uma
  let totalErros = 0;
  for (const [idx, q] of questions.entries()) {
    const erros = validar(q, idx);
    if (erros.length > 0) {
      console.error(`❌ Questão ${idx + 1} (${q.conteudo_principal}): ${erros.join(", ")}`);
      totalErros++;
    }
  }

  if (totalErros > 0) {
    console.error(`\n${totalErros} questão(ões) com erro. Corrige antes de inserir.`);
    process.exit(1);
  }

  console.log(`✅ ${questions.length} questões validadas.`);

  if (isDryRun) {
    console.log("Modo --dry-run: nenhuma inserção realizada.");
    process.exit(0);
  }

  const db = await mysql.createConnection(url);

  try {
    let inseridas = 0;
    let ignoradas = 0;

    for (const q of questions) {
      // Verifica duplicata pelo enunciado (primeiros 100 chars)
      const [rows] = await db.execute(
        "SELECT id FROM questions WHERE LEFT(enunciado, 100) = LEFT(?, 100) LIMIT 1",
        [q.enunciado]
      );

      if (rows.length > 0) {
        console.log(`⏭  Ignorada (já existe): ${q.conteudo_principal}`);
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
          q.fonte ?? "ENEM",
          q.ano ?? null,
          q.conteudo_principal,
          JSON.stringify(q.tags ?? []),
          q.nivel_dificuldade,
          q.parametros_tri.a,
          q.parametros_tri.b,
          q.parametros_tri.c,
          q.enunciado,
          q.url_imagem ?? null,
          JSON.stringify(q.alternativas),
          q.gabarito.toUpperCase(),
          q.comentario_resolucao ?? null,
        ]
      );

      console.log(`✅ Inserida: ${q.conteudo_principal}`);
      inseridas++;
    }

    console.log(`\nConcluído: ${inseridas} inserida(s), ${ignoradas} ignorada(s).`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error("❌ Erro:", err.message);
  process.exit(1);
});
