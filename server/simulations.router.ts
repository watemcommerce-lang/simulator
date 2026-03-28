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
import { eq, and, desc, sql, inArray, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "./trpc";
import { questions, simulations, simulationAnswers, users, dailyChallenges } from "./schema";
import type { NewSimulation, NewSimulationAnswer, NewDailyChallenge } from "./schema";
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
  1: { total: 45, minPass: 0, timeLimitPerQuestion: 3 * 60 },
  2: { total: 45, minPass: 0, timeLimitPerQuestion: 3 * 60 },
  3: { total: 45, minPass: 0, timeLimitPerQuestion: 3 * 60 },
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

      // Etapa única: qualquer aluno pode iniciar diretamente

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
      const unlocked = true; // Acesso livre sem progressão por etapas

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
  // STATS — streak, metas semanais, gráfico diário (dashboard)
  // ---------------------------------------------------------------------------
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Todos os simulados concluídos, do mais recente ao mais antigo
    const completed = await ctx.db
      .select({
        id: simulations.id,
        stage: simulations.stage,
        correctCount: simulations.correctCount,
        totalQuestions: simulations.totalQuestions,
        score: simulations.score,
        completedAt: simulations.completedAt,
      })
      .from(simulations)
      .where(and(eq(simulations.userId, userId), eq(simulations.status, "completed")))
      .orderBy(desc(simulations.completedAt));

    const now = new Date();

    // --- Streak: dias consecutivos com pelo menos 1 simulado ---
    let streak = 0;
    const daySet = new Set(
      completed
        .filter((s) => s.completedAt)
        .map((s) => {
          const d = new Date(s.completedAt!);
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        })
    );
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (daySet.has(key)) streak++;
      else if (i > 0) break; // para no primeiro dia sem atividade
    }

    // --- Semana atual (seg a dom) ---
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    const dayOfWeek = startOfWeek.getDay(); // 0=dom
    startOfWeek.setDate(startOfWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const thisWeek = completed.filter(
      (s) => s.completedAt && new Date(s.completedAt) >= startOfWeek
    );

    const weeklyQuestions = thisWeek.reduce((s, sim) => s + (sim.totalQuestions ?? 0), 0);
    const weeklyCorrect = thisWeek.reduce((s, sim) => s + (sim.correctCount ?? 0), 0);
    const weeklyAccuracy = weeklyQuestions > 0
      ? Math.round((weeklyCorrect / weeklyQuestions) * 100)
      : 0;

    // --- Gráfico: últimos 7 dias ---
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });

    const dailyData = days.map((day) => {
      const label = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"][day.getDay() === 0 ? 6 : day.getDay() - 1];
      const daySims = completed.filter((s) => {
        if (!s.completedAt) return false;
        const sd = new Date(s.completedAt);
        return (
          sd.getFullYear() === day.getFullYear() &&
          sd.getMonth() === day.getMonth() &&
          sd.getDate() === day.getDate()
        );
      });
      const q = daySims.reduce((s, sim) => s + (sim.totalQuestions ?? 0), 0);
      const c = daySims.reduce((s, sim) => s + (sim.correctCount ?? 0), 0);
      return {
        label,
        questoes: q,
        acertos: c,
        pct: q > 0 ? Math.round((c / q) * 100) : 0,
      };
    });

    return {
      streak,
      weeklyQuestions,
      weeklyAccuracy,
      totalSimulations: completed.length,
      dailyData,
    };
  }),

  // ---------------------------------------------------------------------------
  // RANKING — top 20 alunos por melhor nota TRI na Etapa 3
  // ---------------------------------------------------------------------------
  getRanking: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        userId: simulations.userId,
        score: simulations.score,
        correctCount: simulations.correctCount,
        completedAt: simulations.completedAt,
        userName: users.name,
      })
      .from(simulations)
      .innerJoin(users, eq(simulations.userId, users.id))
      .where(and(eq(simulations.stage, 3), eq(simulations.status, "completed")))
      .orderBy(desc(simulations.score))
      .limit(100);

    // Pega melhor resultado por aluno
    const bestByUser = new Map<number, typeof rows[0]>();
    for (const row of rows) {
      const existing = bestByUser.get(row.userId);
      if (!existing || (row.score ?? 0) > (existing.score ?? 0)) {
        bestByUser.set(row.userId, row);
      }
    }

    const ranking = Array.from(bestByUser.values())
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 20)
      .map((r, idx) => ({
        position: idx + 1,
        userId: r.userId,
        userName: r.userName,
        score: r.score,
        correctCount: r.correctCount,
        completedAt: r.completedAt,
        isMe: r.userId === ctx.user.id,
      }));

    return ranking;
  }),

  // ---------------------------------------------------------------------------
  // TREINO LIVRE — sorteia N questões de um tópico com gabarito imediato
  // ---------------------------------------------------------------------------
  startFreeTraining: protectedProcedure
    .input(z.object({
      conteudo: z.string().optional(),
      count: z.number().int().min(1).max(20).default(10),
    }))
    .mutation(async ({ ctx, input }) => {
      const filters: any[] = [eq(questions.active, true)];
      if (input.conteudo) {
        filters.push(sql`${questions.conteudo_principal} = ${input.conteudo}`);
      }

      const rows = await ctx.db
        .select({
          id: questions.id,
          enunciado: questions.enunciado,
          url_imagem: questions.url_imagem,
          alternativas: questions.alternativas,
          gabarito: questions.gabarito,
          comentario_resolucao: questions.comentario_resolucao,
          conteudo_principal: questions.conteudo_principal,
          nivel_dificuldade: questions.nivel_dificuldade,
          tags: questions.tags,
        })
        .from(questions)
        .where(and(...filters))
        .orderBy(sql`RAND()`)
        .limit(input.count);

      return { questions: rows };
    }),

  // Tópicos disponíveis para treino livre
  getTopics: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        conteudo: questions.conteudo_principal,
        total: sql<number>`COUNT(*)`,
      })
      .from(questions)
      .where(eq(questions.active, true))
      .groupBy(questions.conteudo_principal)
      .orderBy(questions.conteudo_principal);

    return rows;
  }),


  // ---------------------------------------------------------------------------
  // DESAFIO DIÁRIO — 3 questões randômicas sem repetição
  // ---------------------------------------------------------------------------
  getDailyChallenge: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Verifica se já existe desafio de hoje
    const [existing] = await ctx.db
      .select()
      .from(dailyChallenges)
      .where(and(eq(dailyChallenges.userId, userId), eq(dailyChallenges.challengeDate, today)))
      .limit(1);

    if (existing) {
      // Carrega as questões do desafio
      const qs = await ctx.db
        .select({
          id: questions.id,
          enunciado: questions.enunciado,
          url_imagem: questions.url_imagem,
          alternativas: questions.alternativas,
          gabarito: questions.gabarito,
          comentario_resolucao: questions.comentario_resolucao,
          conteudo_principal: questions.conteudo_principal,
          nivel_dificuldade: questions.nivel_dificuldade,
        })
        .from(questions)
        .where(inArray(questions.id, existing.questionIds));

      return {
        challengeId: existing.id,
        date: today,
        completed: existing.completed,
        correctCount: existing.correctCount,
        answers: existing.answers as Record<string, string>,
        questions: qs,
      };
    }

    // Busca questões que o aluno nunca respondeu nos desafios
    const pastChallenges = await ctx.db
      .select({ questionIds: dailyChallenges.questionIds })
      .from(dailyChallenges)
      .where(eq(dailyChallenges.userId, userId));

    const usedIds = new Set<number>(pastChallenges.flatMap((c) => c.questionIds));

    // Sorteia 3 questões não usadas
    let drawn = await ctx.db
      .select({
        id: questions.id,
        enunciado: questions.enunciado,
        url_imagem: questions.url_imagem,
        alternativas: questions.alternativas,
        gabarito: questions.gabarito,
        comentario_resolucao: questions.comentario_resolucao,
        conteudo_principal: questions.conteudo_principal,
        nivel_dificuldade: questions.nivel_dificuldade,
      })
      .from(questions)
      .where(eq(questions.active, true))
      .orderBy(sql`RAND()`)
      .limit(100);

    const filtered = drawn.filter((q) => !usedIds.has(q.id)).slice(0, 3);
    // Se acabaram questões novas, recomeça do banco inteiro
    const final = filtered.length >= 3 ? filtered : drawn.slice(0, 3);

    const newChallenge: NewDailyChallenge = {
      userId,
      challengeDate: today,
      questionIds: final.map((q) => q.id),
      answers: {},
      completed: false,
    };

    const [result] = await ctx.db.insert(dailyChallenges).values(newChallenge);

    return {
      challengeId: Number(result.insertId),
      date: today,
      completed: false,
      correctCount: null,
      answers: {},
      questions: final,
    };
  }),

  saveDailyAnswer: protectedProcedure
    .input(z.object({
      challengeId: z.number().int().positive(),
      questionId: z.number().int().positive(),
      selectedAnswer: z.string().length(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const [challenge] = await ctx.db
        .select()
        .from(dailyChallenges)
        .where(and(eq(dailyChallenges.id, input.challengeId), eq(dailyChallenges.userId, userId)))
        .limit(1);

      if (!challenge || challenge.completed) return { ok: false };

      const [q] = await ctx.db
        .select({ gabarito: questions.gabarito })
        .from(questions)
        .where(eq(questions.id, input.questionId))
        .limit(1);

      const newAnswers = { ...(challenge.answers as Record<string, string>), [input.questionId]: input.selectedAnswer.toUpperCase() };
      const allAnswered = challenge.questionIds.every((id) => newAnswers[id]);
      const correctCount = challenge.questionIds.filter((id) => {
        const [qData] = [{ gabarito: q?.gabarito }];
        return newAnswers[id] === (newAnswers[id] ? q?.gabarito : null);
      }).length;

      // Calcula acertos corretamente
      await ctx.db
        .update(dailyChallenges)
        .set({
          answers: newAnswers,
          ...(allAnswered ? { completed: true, completedAt: new Date() } : {}),
        })
        .where(eq(dailyChallenges.id, input.challengeId));

      return { ok: true, isCorrect: input.selectedAnswer.toUpperCase() === q?.gabarito };
    }),

  finishDailyChallenge: protectedProcedure
    .input(z.object({ challengeId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const [challenge] = await ctx.db
        .select()
        .from(dailyChallenges)
        .where(and(eq(dailyChallenges.id, input.challengeId), eq(dailyChallenges.userId, userId)))
        .limit(1);

      if (!challenge) return { ok: false };

      const answers = challenge.answers as Record<string, string>;

      // Busca gabaritos
      const qs = await ctx.db
        .select({ id: questions.id, gabarito: questions.gabarito })
        .from(questions)
        .where(inArray(questions.id, challenge.questionIds));

      const correctCount = qs.filter((q) => answers[q.id] === q.gabarito).length;

      await ctx.db
        .update(dailyChallenges)
        .set({ completed: true, correctCount, completedAt: new Date() })
        .where(eq(dailyChallenges.id, input.challengeId));

      return { ok: true, correctCount, total: challenge.questionIds.length };
    }),

  getDailyHistory: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const rows = await ctx.db
      .select({
        id: dailyChallenges.id,
        challengeDate: dailyChallenges.challengeDate,
        completed: dailyChallenges.completed,
        correctCount: dailyChallenges.correctCount,
        completedAt: dailyChallenges.completedAt,
      })
      .from(dailyChallenges)
      .where(eq(dailyChallenges.userId, userId))
      .orderBy(desc(dailyChallenges.challengeDate))
      .limit(30);
    return rows;
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
