/**
 * =============================================================================
 * Router de Simulados — tRPC
 * =============================================================================
 *
 * Fluxo de um simulado:
 *   1. start        → cria sessão, sorteia questões, retorna lista sem gabarito
 *   2. saveAnswer   → salva resposta de uma questão (pode chamar várias vezes)
 *   3. finish       → finaliza, calcula nota (TRI na Etapa 3, % nas demais),
 *                     verifica progressão de etapa
 *
 * Consultas:
 *   getActive       → retorna simulado em andamento do aluno (se existir)
 *   getResult       → detalhes completos de um simulado finalizado
 *   getHistory      → histórico paginado por etapa
 *   getProgress     → progresso nas 3 etapas (melhor nota, desbloqueio)
 * =============================================================================
 */

import { z } from "zod";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "./trpc";
import { questions, simulations, simulationAnswers } from "./schema";
import type { NewSimulation, NewSimulationAnswer } from "./schema";
import {
  estimateTheta,
  thetaToEnemScore,
  checkStagePass,
  probabilityCorrect,
} from "./tri";
import type { QuestionResult } from "./tri";

// =============================================================================
// Constantes de configuração das etapas
// =============================================================================

const STAGE_CONFIG = {
  1: { total: 15, minPass: 12, timeLimitPerQuestion: 5 * 60 }, // 5 min
  2: { total: 25, minPass: 18, timeLimitPerQuestion: 4 * 60 }, // 4 min
  3: { total: 45, minPass: 0,  timeLimitPerQuestion: 3 * 60 }, // 3 min
} as const;

type Stage = 1 | 2 | 3;

// =============================================================================
// Helpers internos
// =============================================================================

/** Sorteia N questões aleatórias activas do banco */
async function drawQuestions(db: any, count: number, excludeIds: number[] = []) {
  const rows = await db
    .select({
      id: questions.id,
      conteudo_principal: questions.conteudo_principal,
      nivel_dificuldade: questions.nivel_dificuldade,
      param_a: questions.param_a,
      param_b: questions.param_b,
      param_c: questions.param_c,
      enunciado: questions.enunciado,
      url_imagem: questions.url_imagem,
      alternativas: questions.alternativas,
      tags: questions.tags,
    })
    .from(questions)
    .where(eq(questions.active, true))
    .orderBy(sql`RAND()`)
    .limit(count + (excludeIds.length > 0 ? excludeIds.length : 0));

  // Filtra excluídos em memória (mais simples que SQL dinâmico)
  const filtered = rows.filter((q: any) => !excludeIds.includes(q.id));
  return filtered.slice(0, count);
}

/** Lança TRPCError NOT_FOUND padronizado */
function notFound(entity: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message: `${entity} não encontrado(a).` });
}

/** Lança TRPCError FORBIDDEN padronizado */
function forbidden(msg: string): never {
  throw new TRPCError({ code: "FORBIDDEN", message: msg });
}

// =============================================================================
// Router
// =============================================================================

export const simulationsRouter = createTRPCRouter({

  // ---------------------------------------------------------------------------
  // INICIA um novo simulado
  // ---------------------------------------------------------------------------
  start: protectedProcedure
    .input(
      z.object({
        stage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { stage } = input;
      const userId = ctx.user.id;
      const config = STAGE_CONFIG[stage];

      // --- Verifica se já existe simulado em andamento ---
      const [existing] = await ctx.db
        .select({ id: simulations.id })
        .from(simulations)
        .where(
          and(
            eq(simulations.userId, userId),
            eq(simulations.status, "in_progress")
          )
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Você já tem um simulado em andamento. Finalize-o antes de iniciar outro.",
        });
      }

      // --- Verifica desbloqueio de etapa ---
      if (stage > 1) {
        const prevStage = (stage - 1) as Stage;
        const prevConfig = STAGE_CONFIG[prevStage];

        const [bestPrev] = await ctx.db
          .select({ correctCount: simulations.correctCount })
          .from(simulations)
          .where(
            and(
              eq(simulations.userId, userId),
              eq(simulations.stage, prevStage),
              eq(simulations.status, "completed")
            )
          )
          .orderBy(desc(simulations.correctCount))
          .limit(1);

        if (!bestPrev || (bestPrev.correctCount ?? 0) < prevConfig.minPass) {
          forbidden(
            `Você precisa atingir ${prevConfig.minPass} acertos na Etapa ${prevStage} para desbloquear a Etapa ${stage}.`
          );
        }
      }

      // --- Sorteia questões ---
      const drawn = await drawQuestions(ctx.db, config.total);

      if (drawn.length < config.total) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Banco de questões insuficiente. Necessário: ${config.total}, disponível: ${drawn.length}.`,
        });
      }

      // --- Cria sessão de simulado ---
      const newSim: NewSimulation = {
        userId,
        stage,
        totalQuestions: config.total,
        status: "in_progress",
      };

      const [result] = await ctx.db.insert(simulations).values(newSim);
      const simulationId = Number(result.insertId);

      // --- Cria slots de resposta (pré-alocados, sem resposta ainda) ---
      const answerSlots: NewSimulationAnswer[] = drawn.map((q: any, idx: number) => ({
        simulationId,
        questionId: q.id,
        questionOrder: idx + 1,
      }));

      await ctx.db.insert(simulationAnswers).values(answerSlots);

      return {
        simulationId,
        stage,
        totalQuestions: config.total,
        minPassRequired: config.minPass,
        timeLimitPerQuestion: config.timeLimitPerQuestion,
        questions: drawn, // sem gabarito
      };
    }),

  // ---------------------------------------------------------------------------
  // SALVA RESPOSTA de uma questão
  // ---------------------------------------------------------------------------
  saveAnswer: protectedProcedure
    .input(
      z.object({
        simulationId: z.number().int().positive(),
        questionId: z.number().int().positive(),
        selectedAnswer: z.string().length(1).toUpperCase(),
        timeSpentSeconds: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // --- Verifica que o simulado pertence ao aluno e está em andamento ---
      const [sim] = await ctx.db
        .select()
        .from(simulations)
        .where(
          and(
            eq(simulations.id, input.simulationId),
            eq(simulations.userId, userId),
            eq(simulations.status, "in_progress")
          )
        )
        .limit(1);

      if (!sim) notFound("Simulado activo");

      // --- Busca o slot de resposta e o gabarito ---
      const [answerRow] = await ctx.db
        .select({
          id: simulationAnswers.id,
          questionId: simulationAnswers.questionId,
          gabarito: questions.gabarito,
        })
        .from(simulationAnswers)
        .innerJoin(questions, eq(simulationAnswers.questionId, questions.id))
        .where(
          and(
            eq(simulationAnswers.simulationId, input.simulationId),
            eq(simulationAnswers.questionId, input.questionId)
          )
        )
        .limit(1);

      if (!answerRow) notFound("Questão neste simulado");

      const isCorrect =
        input.selectedAnswer.toUpperCase() === answerRow.gabarito.toUpperCase();

      // --- Persiste resposta ---
      await ctx.db
        .update(simulationAnswers)
        .set({
          selectedAnswer: input.selectedAnswer.toUpperCase(),
          isCorrect,
          timeSpentSeconds: input.timeSpentSeconds,
          answeredAt: new Date(),
        })
        .where(eq(simulationAnswers.id, answerRow.id));

      return { isCorrect };
    }),

  // ---------------------------------------------------------------------------
  // FINALIZA simulado e calcula pontuação
  // ---------------------------------------------------------------------------
  finish: protectedProcedure
    .input(
      z.object({
        simulationId: z.number().int().positive(),
        totalTimeSeconds: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // --- Carrega simulado ---
      const [sim] = await ctx.db
        .select()
        .from(simulations)
        .where(
          and(
            eq(simulations.id, input.simulationId),
            eq(simulations.userId, userId),
            eq(simulations.status, "in_progress")
          )
        )
        .limit(1);

      if (!sim) notFound("Simulado activo");

      const stage = sim.stage as Stage;
      const config = STAGE_CONFIG[stage];

      // --- Carrega todas as respostas com parâmetros TRI ---
      const answers = await ctx.db
        .select({
          questionId: simulationAnswers.questionId,
          selectedAnswer: simulationAnswers.selectedAnswer,
          isCorrect: simulationAnswers.isCorrect,
          timeSpentSeconds: simulationAnswers.timeSpentSeconds,
          param_a: questions.param_a,
          param_b: questions.param_b,
          param_c: questions.param_c,
          gabarito: questions.gabarito,
          conteudo_principal: questions.conteudo_principal,
          nivel_dificuldade: questions.nivel_dificuldade,
        })
        .from(simulationAnswers)
        .innerJoin(questions, eq(simulationAnswers.questionId, questions.id))
        .where(eq(simulationAnswers.simulationId, input.simulationId));

      const correctCount = answers.filter((a) => a.isCorrect === true).length;

      // --- Calcula pontuação ---
      let score: number;
      let triTheta: number | null = null;
      let enemScore: number | null = null;

      if (stage === 3) {
        // Etapa 3: Cálculo TRI completo
        const triResults: QuestionResult[] = answers.map((a) => ({
          questionId: a.questionId,
          params: { a: a.param_a, b: a.param_b, c: a.param_c },
          correct: a.isCorrect,
        }));

        const { theta, standardError } = estimateTheta(triResults);
        triTheta = theta;
        enemScore = thetaToEnemScore(theta);
        score = enemScore;
      } else {
        // Etapas 1 e 2: percentual simples
        score =
          sim.totalQuestions && sim.totalQuestions > 0
            ? Math.round((correctCount / sim.totalQuestions) * 100)
            : 0;
      }

      // --- Verifica progressão de etapa ---
      const stageResult = checkStagePass(stage, correctCount);

      // --- Actualiza simulado como concluído ---
      await ctx.db
        .update(simulations)
        .set({
          status: "completed",
          correctCount,
          score,
          triTheta,
          totalTimeSeconds: input.totalTimeSeconds,
          completedAt: new Date(),
        })
        .where(eq(simulations.id, input.simulationId));

      // --- Monta feedback por questão com tempo ---
      const avgTime =
        answers.filter((a) => a.timeSpentSeconds != null).length > 0
          ? Math.round(
              answers.reduce((s, a) => s + (a.timeSpentSeconds ?? 0), 0) /
                answers.length
            )
          : 0;

      const timeWarning =
        avgTime > config.timeLimitPerQuestion
          ? `Você gastou em média ${Math.round(avgTime / 60)} min por questão. O ideal é até ${config.timeLimitPerQuestion / 60} min.`
          : null;

      return {
        simulationId: input.simulationId,
        stage,
        correctCount,
        totalQuestions: sim.totalQuestions ?? config.total,
        score,
        triTheta,
        enemScore,
        stageResult,
        timeWarning,
        totalTimeSeconds: input.totalTimeSeconds,
        // Resumo por questão (gabarito revelado após finalizar)
        answersSummary: answers.map((a) => ({
          questionId: a.questionId,
          selectedAnswer: a.selectedAnswer,
          correctAnswer: a.gabarito,
          isCorrect: a.isCorrect,
          timeSpentSeconds: a.timeSpentSeconds,
          conteudo_principal: a.conteudo_principal,
          nivel_dificuldade: a.nivel_dificuldade,
        })),
      };
    }),

  // ---------------------------------------------------------------------------
  // SIMULADO ACTIVO do aluno (para retomar após reload)
  // ---------------------------------------------------------------------------
  getActive: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const [sim] = await ctx.db
      .select()
      .from(simulations)
      .where(
        and(eq(simulations.userId, userId), eq(simulations.status, "in_progress"))
      )
      .limit(1);

    if (!sim) return null;

    // Carrega questões e respostas já dadas
    const answers = await ctx.db
      .select({
        questionId: simulationAnswers.questionId,
        questionOrder: simulationAnswers.questionOrder,
        selectedAnswer: simulationAnswers.selectedAnswer,
        timeSpentSeconds: simulationAnswers.timeSpentSeconds,
        // Dados da questão (sem gabarito)
        conteudo_principal: questions.conteudo_principal,
        nivel_dificuldade: questions.nivel_dificuldade,
        param_a: questions.param_a,
        param_b: questions.param_b,
        param_c: questions.param_c,
        enunciado: questions.enunciado,
        url_imagem: questions.url_imagem,
        alternativas: questions.alternativas,
        tags: questions.tags,
      })
      .from(simulationAnswers)
      .innerJoin(questions, eq(simulationAnswers.questionId, questions.id))
      .where(eq(simulationAnswers.simulationId, sim.id))
      .orderBy(simulationAnswers.questionOrder);

    const stage = sim.stage as Stage;
    const config = STAGE_CONFIG[stage];

    return {
      simulationId: sim.id,
      stage,
      totalQuestions: sim.totalQuestions ?? config.total,
      minPassRequired: config.minPass,
      timeLimitPerQuestion: config.timeLimitPerQuestion,
      answeredCount: answers.filter((a) => a.selectedAnswer != null).length,
      questions: answers.map((a) => ({
        id: a.questionId,
        order: a.questionOrder,
        selectedAnswer: a.selectedAnswer, // null se ainda não respondida
        conteudo_principal: a.conteudo_principal,
        nivel_dificuldade: a.nivel_dificuldade,
        param_a: a.param_a,
        param_b: a.param_b,
        param_c: a.param_c,
        enunciado: a.enunciado,
        url_imagem: a.url_imagem,
        alternativas: a.alternativas,
        tags: a.tags,
      })),
    };
  }),

  // ---------------------------------------------------------------------------
  // RESULTADO DETALHADO de um simulado finalizado
  // ---------------------------------------------------------------------------
  getResult: protectedProcedure
    .input(z.object({ simulationId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const [sim] = await ctx.db
        .select()
        .from(simulations)
        .where(
          and(
            eq(simulations.id, input.simulationId),
            eq(simulations.userId, userId),
            eq(simulations.status, "completed")
          )
        )
        .limit(1);

      if (!sim) notFound("Simulado");

      const answers = await ctx.db
        .select({
          questionId: simulationAnswers.questionId,
          questionOrder: simulationAnswers.questionOrder,
          selectedAnswer: simulationAnswers.selectedAnswer,
          isCorrect: simulationAnswers.isCorrect,
          timeSpentSeconds: simulationAnswers.timeSpentSeconds,
          // Questão completa (gabarito incluído — simulado já finalizado)
          enunciado: questions.enunciado,
          alternativas: questions.alternativas,
          gabarito: questions.gabarito,
          comentario_resolucao: questions.comentario_resolucao,
          conteudo_principal: questions.conteudo_principal,
          nivel_dificuldade: questions.nivel_dificuldade,
          tags: questions.tags,
          url_imagem: questions.url_imagem,
        })
        .from(simulationAnswers)
        .innerJoin(questions, eq(simulationAnswers.questionId, questions.id))
        .where(eq(simulationAnswers.simulationId, sim.id))
        .orderBy(simulationAnswers.questionOrder);

      // Estatísticas por dificuldade
      const byDifficulty: Record<string, { correct: number; total: number }> = {};
      for (const a of answers) {
        const diff = a.nivel_dificuldade ?? "Média";
        if (!byDifficulty[diff]) byDifficulty[diff] = { correct: 0, total: 0 };
        byDifficulty[diff].total++;
        if (a.isCorrect) byDifficulty[diff].correct++;
      }

      // Estatísticas por tópico
      const byTopic: Record<string, { correct: number; total: number }> = {};
      for (const a of answers) {
        const topic = a.conteudo_principal;
        if (!byTopic[topic]) byTopic[topic] = { correct: 0, total: 0 };
        byTopic[topic].total++;
        if (a.isCorrect) byTopic[topic].correct++;
      }

      const stage = sim.stage as Stage;
      const config = STAGE_CONFIG[stage];

      return {
        simulationId: sim.id,
        stage,
        status: sim.status,
        score: sim.score,
        triTheta: sim.triTheta,
        correctCount: sim.correctCount ?? 0,
        totalQuestions: sim.totalQuestions ?? config.total,
        totalTimeSeconds: sim.totalTimeSeconds,
        completedAt: sim.completedAt,
        minPassRequired: config.minPass,
        stageResult: checkStagePass(stage, sim.correctCount ?? 0),
        byDifficulty,
        byTopic,
        answers,
      };
    }),

  // ---------------------------------------------------------------------------
  // HISTÓRICO — últimas N tentativas por etapa
  // ---------------------------------------------------------------------------
  getHistory: protectedProcedure
    .input(
      z.object({
        stage: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const filters = [
        eq(simulations.userId, userId),
        eq(simulations.status, "completed"),
      ];
      if (input.stage) filters.push(eq(simulations.stage, input.stage));

      const rows = await ctx.db
        .select({
          id: simulations.id,
          stage: simulations.stage,
          score: simulations.score,
          triTheta: simulations.triTheta,
          correctCount: simulations.correctCount,
          totalQuestions: simulations.totalQuestions,
          totalTimeSeconds: simulations.totalTimeSeconds,
          completedAt: simulations.completedAt,
        })
        .from(simulations)
        .where(and(...filters))
        .orderBy(desc(simulations.completedAt))
        .limit(input.limit);

      return rows;
    }),

  // ---------------------------------------------------------------------------
  // PROGRESSO nas 3 etapas (para o dashboard)
  // ---------------------------------------------------------------------------
  getProgress: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const completed = await ctx.db
      .select({
        stage: simulations.stage,
        score: simulations.score,
        triTheta: simulations.triTheta,
        correctCount: simulations.correctCount,
        totalQuestions: simulations.totalQuestions,
        completedAt: simulations.completedAt,
      })
      .from(simulations)
      .where(
        and(eq(simulations.userId, userId), eq(simulations.status, "completed"))
      )
      .orderBy(desc(simulations.completedAt));

    const stageStats = ([1, 2, 3] as Stage[]).map((stage) => {
      const attempts = completed.filter((s) => s.stage === stage);
      const config = STAGE_CONFIG[stage];

      const best = attempts.reduce(
        (max, a) => ((a.correctCount ?? 0) > (max?.correctCount ?? -1) ? a : max),
        null as (typeof attempts)[0] | null
      );

      const passed = best != null && (best.correctCount ?? 0) >= config.minPass;
      const unlocked =
        stage === 1 ||
        (() => {
          const prev = ([1, 2, 3] as Stage[]).find((s) => s === stage - 1)!;
          const prevBest = completed.find(
            (s) =>
              s.stage === prev &&
              (s.correctCount ?? 0) >= STAGE_CONFIG[prev].minPass
          );
          return prevBest != null;
        })();

      return {
        stage,
        unlocked,
        passed,
        attempts: attempts.length,
        bestCorrectCount: best?.correctCount ?? null,
        bestScore: best?.score ?? null,
        bestTriTheta: best?.triTheta ?? null,
        minPassRequired: config.minPass,
        totalQuestions: config.total,
        lastAttemptAt: attempts[0]?.completedAt ?? null,
        recentAttempts: attempts.slice(0, 5),
      };
    });

    return stageStats;
  }),

  // ---------------------------------------------------------------------------
  // ABANDONA simulado em andamento
  // ---------------------------------------------------------------------------
  abandon: protectedProcedure
    .input(z.object({ simulationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      await ctx.db
        .update(simulations)
        .set({ status: "abandoned" })
        .where(
          and(
            eq(simulations.id, input.simulationId),
            eq(simulations.userId, userId),
            eq(simulations.status, "in_progress")
          )
        );

      return { success: true };
    }),
});
