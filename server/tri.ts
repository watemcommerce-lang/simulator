/**
 * =============================================================================
 * Motor TRI — Modelo Logístico de 3 Parâmetros (3PL)
 * =============================================================================
 *
 * O Modelo 3PL estima a probabilidade de um aluno com habilidade θ (theta)
 * acertar uma questão com parâmetros (a, b, c):
 *
 *   P(θ) = c + (1 - c) / (1 + exp(-Da(θ - b)))
 *
 * Onde:
 *   θ (theta) — habilidade do aluno (escala logit, tipicamente -4 a +4)
 *   a         — discriminação: quão bem a questão separa alunos por habilidade
 *               (valores típicos: 0.5 a 2.5; quanto maior, mais discriminativa)
 *   b         — dificuldade: valor de θ onde P(θ) = (1+c)/2
 *               (escala logit: negativo = fácil, positivo = difícil)
 *   c         — pseudo-chute: probabilidade mínima de acerto (tipicamente 0.2
 *               para questões de 5 alternativas, ou 0.25 para 4 alternativas)
 *   D         — constante de escala = 1.702 (normalização para escala normal)
 * =============================================================================
 */

const D = 1.702; // Constante de escala do modelo logístico normal

// =============================================================================
// Tipos
// =============================================================================

export interface IrtParams {
  /** Discriminação (a): quanto a questão diferencia alunos. Tipicamente 0.5–2.5 */
  a: number;
  /** Dificuldade (b): valor de θ com 50% de chance de acerto (acima do chute). Tipicamente -3 a +3 */
  b: number;
  /** Pseudo-chute (c): probabilidade mínima de acerto. Tipicamente 0.15–0.25 */
  c: number;
}

export interface QuestionResult {
  questionId: number;
  params: IrtParams;
  /** true = acertou, false = errou, null = não respondida */
  correct: boolean | null;
}

export interface ThetaEstimationResult {
  /** Estimativa final de habilidade θ */
  theta: number;
  /** Erro padrão da estimativa */
  standardError: number;
  /** Número de iterações até convergência */
  iterations: number;
  /** true se o algoritmo convergiu dentro do tolerância */
  converged: boolean;
}

export interface SimulationScore {
  /** Habilidade estimada θ (escala logit) */
  theta: number;
  /** Nota na escala ENEM (0–1000), derivada do θ */
  enemScore: number;
  /** Erro padrão da estimativa de θ */
  standardError: number;
  /** Percentual de acertos simples (sem TRI) */
  rawAccuracy: number;
  /** Número de acertos */
  correctCount: number;
  /** Número de questões respondidas */
  answeredCount: number;
}

// =============================================================================
// Função central: P(θ | a, b, c)
// =============================================================================

/**
 * Calcula a probabilidade de acerto para um aluno com habilidade θ.
 *
 * P(θ) = c + (1 - c) / (1 + exp(-D·a·(θ - b)))
 */
export function probabilityCorrect(theta: number, params: IrtParams): number {
  const { a, b, c } = params;
  const exponent = -D * a * (theta - b);
  return c + (1 - c) / (1 + Math.exp(exponent));
}

// =============================================================================
// Informação do item: I(θ) — quanto uma questão contribui para estimar θ
// =============================================================================

/**
 * Informação de Fisher do item no ponto θ.
 *
 * I(θ) = D²·a²·(P(θ) - c)² · (1 - P(θ)) / ((1 - c)² · P(θ))
 *
 * Questões mais discriminativas (a alto) e bem calibradas no θ do aluno
 * fornecem maior informação.
 */
export function itemInformation(theta: number, params: IrtParams): number {
  const p = probabilityCorrect(theta, params);
  const { a, c } = params;

  // Evita divisão por zero quando P→0 ou P→1
  if (p <= 1e-10 || p >= 1 - 1e-10) return 0;

  const numerator = D * D * a * a * Math.pow(p - c, 2) * (1 - p);
  const denominator = Math.pow(1 - c, 2) * p;
  return numerator / denominator;
}

/**
 * Informação total do teste no ponto θ (soma das informações dos itens).
 */
export function testInformation(theta: number, items: IrtParams[]): number {
  return items.reduce((sum, params) => sum + itemInformation(theta, params), 0);
}

// =============================================================================
// Estimação de θ — Método de Máxima Verossimilhança (MLE) via Newton-Raphson
// =============================================================================

/**
 * Estima a habilidade θ do aluno usando o padrão de respostas e o algoritmo
 * iterativo de Newton-Raphson.
 *
 * O algoritmo maximiza a log-verossimilhança:
 *   L(θ) = Σ [ u_i · ln(P_i) + (1-u_i) · ln(1-P_i) ]
 *
 * Onde u_i = 1 se acertou, 0 se errou.
 *
 * Atualização Newton-Raphson a cada iteração:
 *   θ_novo = θ_atual + L'(θ) / I(θ)
 *
 * @param results    - Lista de {params, correct} por questão respondida
 * @param maxIter    - Número máximo de iterações (default: 50)
 * @param tolerance  - Critério de convergência em |Δθ| (default: 0.001)
 * @param thetaInit  - Estimativa inicial de θ (default: 0.0)
 */
export function estimateTheta(
  results: QuestionResult[],
  maxIter = 50,
  tolerance = 0.001,
  thetaInit = 0.0
): ThetaEstimationResult {
  // Filtra apenas questões respondidas
  const answered = results.filter((r) => r.correct !== null);

  // Sem respostas: retorna θ = 0 com alto erro padrão
  if (answered.length === 0) {
    return { theta: 0, standardError: 999, iterations: 0, converged: false };
  }

  // Casos extremos: tudo certo ou tudo errado
  const allCorrect = answered.every((r) => r.correct === true);
  const allWrong = answered.every((r) => r.correct === false);

  if (allCorrect) {
    return { theta: 3.0, standardError: 0.5, iterations: 0, converged: true };
  }
  if (allWrong) {
    return { theta: -3.0, standardError: 0.5, iterations: 0, converged: true };
  }

  let theta = thetaInit;
  let converged = false;
  let iterations = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    iterations++;

    let firstDerivative = 0; // L'(θ): gradiente da log-verossimilhança
    let secondDerivative = 0; // L''(θ): curvatura (negativo da informação de Fisher)

    for (const { params, correct } of answered) {
      const p = probabilityCorrect(theta, params);
      const { a, c } = params;

      // Derivada de P em relação a θ:
      // dP/dθ = D·a·(P - c)·(1 - P) / (1 - c)
      const dP = (D * a * (p - c) * (1 - p)) / (1 - c);

      // Contribuição para L'(θ)
      const u = correct ? 1 : 0;
      if (p > 1e-10 && p < 1 - 1e-10) {
        firstDerivative += ((u - p) * dP) / (p * (1 - p));
        // Aproximação da segunda derivada via informação de Fisher
        secondDerivative -= (dP * dP) / (p * (1 - p));
      }
    }

    // Evita divisão por zero ou divergência
    if (Math.abs(secondDerivative) < 1e-10) break;

    const delta = firstDerivative / secondDerivative;
    theta -= delta;

    // Limita θ a [-4, 4] para estabilidade numérica
    theta = Math.max(-4, Math.min(4, theta));

    if (Math.abs(delta) < tolerance) {
      converged = true;
      break;
    }
  }

  // Erro padrão = 1 / sqrt(Informação total)
  const info = testInformation(theta, answered.map((r) => r.params));
  const standardError = info > 1e-10 ? 1 / Math.sqrt(info) : 999;

  return { theta, standardError, iterations, converged };
}

// =============================================================================
// Conversão θ → Escala ENEM (500 ± 100 por desvio padrão)
// =============================================================================

/**
 * Converte o θ estimado para a escala ENEM (0–1000).
 *
 * A escala ENEM usa média ~500 e desvio padrão ~110.
 * Mapeamento linear:
 *   - θ = 0.0  → 500 pontos  (desempenho médio)
 *   - θ = +1.0 → 610 pontos
 *   - θ = -1.0 → 390 pontos
 *   - θ = +3.0 → 830 pontos  (excelente)
 *   - θ = -3.0 → 170 pontos  (muito abaixo da média)
 */
export function thetaToEnemScore(theta: number): number {
  const mean = 500;
  const sd = 110; // Desvio padrão aproximado da escala ENEM
  const raw = mean + sd * theta;
  // Limita ao intervalo válido [0, 1000]
  return Math.round(Math.max(0, Math.min(1000, raw)));
}

// =============================================================================
// Função principal: calcula pontuação completa de um simulado
// =============================================================================

/**
 * Calcula a pontuação completa de um simulado (Etapa 3 com TRI).
 *
 * @param results - Padrão de respostas do aluno
 * @returns SimulationScore com θ, nota ENEM, erro padrão e estatísticas simples
 */
export function calculateSimulationScore(
  results: QuestionResult[]
): SimulationScore {
  const answered = results.filter((r) => r.correct !== null);
  const correctCount = answered.filter((r) => r.correct === true).length;
  const rawAccuracy = answered.length > 0 ? correctCount / answered.length : 0;

  const { theta, standardError } = estimateTheta(results);
  const enemScore = thetaToEnemScore(theta);

  return {
    theta,
    enemScore,
    standardError,
    rawAccuracy,
    correctCount,
    answeredCount: answered.length,
  };
}

// =============================================================================
// Utilitário: verifica aprovação nas Etapas 1 e 2 (sem TRI)
// =============================================================================

/**
 * Verifica se o aluno atingiu o mínimo de acertos para avançar de etapa.
 *
 * Etapa 1: 15 questões, mínimo 12 acertos (80%)
 * Etapa 2: 25 questões, mínimo 18 acertos (72%)
 * Etapa 3: sem mínimo (avaliação TRI)
 */
export function checkStagePass(
  stage: 1 | 2 | 3,
  correctCount: number
): { passed: boolean; required: number; message: string } {
  const requirements: Record<number, number> = { 1: 12, 2: 18, 3: 0 };
  const required = requirements[stage];
  const passed = stage === 3 || correctCount >= required;

  const message = passed
    ? stage === 3
      ? `Simulado concluído! Nota TRI calculada.`
      : `Parabéns! Você acertou ${correctCount} questões e avançou para a Etapa ${stage + 1}.`
    : `Você acertou ${correctCount} de ${required} necessárias. Tente novamente a Etapa ${stage}.`;

  return { passed, required, message };
}
