/**
 * =============================================================================
 * Router de Questões — tRPC
 * =============================================================================
 * Procedimentos públicos (aluno) e protegidos (admin/professor).
 *
 * Procedimentos:
 *   PUBLIC
 *     getForStage       — sorteia questões aleatórias para uma etapa
 *     getById           — retorna uma questão pelo ID (sem gabarito)
 *
 *   ADMIN
 *     list              — lista com filtros + paginação
 *     getByIdAdmin      — retorna questão completa (com gabarito)
 *     create            — insere nova questão
 *     update            — atualiza questão existente
 *     toggleActive      — ativa / desativa questão
 *     delete            — remove questão permanentemente
 *     importBatch       — importa array de questões (bulk insert)
 * =============================================================================
 */

import { z } from "zod";
import { eq, and, inArray, ne, sql, asc, desc } from "drizzle-orm";
import { createTRPCRouter, publicProcedure, adminProcedure } from "../trpc";
import { questions } from "../../drizzle/schema";
import type { NewQuestion } from "../../drizzle/schema";

// =============================================================================
// Schemas de validação
// =============================================================================

const NivelDificuldadeEnum = z.enum([
  "Muito Baixa",
  "Baixa",
  "Média",
  "Alta",
  "Muito Alta",
]);

/** Parâmetros TRI com validação de intervalos típicos */
const ParametrosTRISchema = z.object({
  a: z.number().min(0.1).max(4.0),
  b: z.number().min(-4.0).max(4.0),
  c: z.number().min(0.0).max(0.5),
});

/** Alternativas: objeto com chaves A–E e texto (pode ter LaTeX) */
const AlternativasSchema = z
  .record(z.string().min(1).max(5), z.string().min(1))
  .refine((alt) => Object.keys(alt).length >= 2, {
    message: "Deve haver pelo menos 2 alternativas",
  });

/** Schema base compartilhado entre create e update */
const QuestionBaseSchema = z.object({
  fonte: z.string().max(50).default("ENEM"),
  ano: z.number().int().min(2000).max(2100).optional(),
  conteudo_principal: z.string().min(1).max(100),
  tags: z.array(z.string()).default([]),
  nivel_dificuldade: NivelDificuldadeEnum.default("Média"),
  param_a: z.number().min(0.1).max(4.0).default(1.0),
  param_b: z.number().min(-4.0).max(4.0).default(0.0),
  param_c: z.number().min(0.0).max(0.5).default(0.2),
  enunciado: z.string().min(10),
  url_imagem: z.string().url().nullable().optional(),
  alternativas: AlternativasSchema,
  gabarito: z.string().length(1),
  comentario_resolucao: z.string().optional(),
});

/** Schema para o formato JSON do professor (mapeado para colunas do schema) */
const ProfessorJsonSchema = z.object({
  fonte: z.string().max(50).default("ENEM"),
  ano: z.number().int().optional(),
  conteudo_principal: z.string().min(1).max(100),
  tags: z.array(z.string()).default([]),
  nivel_dificuldade: NivelDificuldadeEnum,
  parametros_tri: ParametrosTRISchema,
  enunciado: z.string().min(10),
  url_imagem: z.string().url().nullable().optional(),
  alternativas: z.union([
    // Formato array: [{ id: "A", texto: "..." }]
    z
      .array(z.object({ id: z.string(), texto: z.string() }))
      .transform((arr) =>
        Object.fromEntries(arr.map((a) => [a.id, a.texto]))
      ),
    // Formato objeto: { A: "...", B: "..." }
    AlternativasSchema,
  ]),
  gabarito: z.string().length(1),
  comentario_resolucao: z.string().optional(),
});

// Configuração de questões por etapa
const STAGE_CONFIG = {
  1: { total: 15, minPass: 12 },
  2: { total: 25, minPass: 18 },
  3: { total: 45, minPass: 0 },
} as const;

// =============================================================================
// Router
// =============================================================================

export const questionsRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // PUBLIC: sorteia questões para uma etapa (sem gabarito)
  // ---------------------------------------------------------------------------
  getForStage: publicProcedure
    .input(
      z.object({
        stage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        /** IDs de questões já usadas nesta sessão (para não repetir) */
        excludeIds: z.array(z.number()).optional().default([]),
      })
    )
    .query(async ({ ctx, input }) => {
      const { stage, excludeIds } = input;
      const config = STAGE_CONFIG[stage];

      // Busca questões activas, excluindo as já usadas
      const baseWhere =
        excludeIds.length > 0
          ? and(
              eq(questions.active, true),
              ne(questions.id, excludeIds[0]), // Drizzle exige pelo menos 1
              // Para múltiplos IDs usa subquery via sql``
              sql`${questions.id} NOT IN (${sql.join(
                excludeIds.map((id) => sql`${id}`),
                sql`, `
              )})`
            )
          : eq(questions.active, true);

      const pool = await ctx.db
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
          // gabarito NÃO é retornado aqui — apenas no servidor após resposta
        })
        .from(questions)
        .where(eq(questions.active, true))
        .orderBy(sql`RAND()`)
        .limit(config.total * 3); // busca 3x para ter margem no shuffle

      // Shuffle adicional em memória e limita ao total da etapa
      const shuffled = pool.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, config.total);

      return {
        stage,
        questions: selected,
        totalRequired: config.total,
        minPassRequired: config.minPass,
      };
    }),

  // ---------------------------------------------------------------------------
  // PUBLIC: retorna questão pelo ID (sem gabarito, para o simulador)
  // ---------------------------------------------------------------------------
  getById: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const [question] = await ctx.db
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
          fonte: questions.fonte,
          ano: questions.ano,
          tags: questions.tags,
        })
        .from(questions)
        .where(and(eq(questions.id, input.id), eq(questions.active, true)))
        .limit(1);

      if (!question) throw new Error("Questão não encontrada");
      return question;
    }),

  // ---------------------------------------------------------------------------
  // ADMIN: lista questões com filtros e paginação
  // ---------------------------------------------------------------------------
  list: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        conteudo: z.string().optional(),
        nivel_dificuldade: NivelDificuldadeEnum.optional(),
        fonte: z.string().optional(),
        ano: z.number().int().optional(),
        activeOnly: z.boolean().default(true),
        orderBy: z.enum(["id", "conteudo_principal", "nivel_dificuldade", "createdAt"]).default("id"),
        orderDir: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, activeOnly, orderBy, orderDir } = input;
      const offset = (page - 1) * pageSize;

      // Constrói filtros dinâmicos
      const filters = [];
      if (activeOnly) filters.push(eq(questions.active, true));
      if (input.conteudo) {
        filters.push(
          sql`${questions.conteudo_principal} LIKE ${`%${input.conteudo}%`}`
        );
      }
      if (input.nivel_dificuldade) {
        filters.push(eq(questions.nivel_dificuldade, input.nivel_dificuldade));
      }
      if (input.fonte) filters.push(eq(questions.fonte, input.fonte));
      if (input.ano) filters.push(eq(questions.ano, input.ano));

      const where = filters.length > 0 ? and(...filters) : undefined;

      // Ordenação
      const orderColumn =
        orderBy === "conteudo_principal"
          ? questions.conteudo_principal
          : orderBy === "nivel_dificuldade"
          ? questions.nivel_dificuldade
          : orderBy === "createdAt"
          ? questions.createdAt
          : questions.id;

      const orderFn = orderDir === "asc" ? asc : desc;

      const [rows, [{ count }]] = await Promise.all([
        ctx.db
          .select()
          .from(questions)
          .where(where)
          .orderBy(orderFn(orderColumn))
          .limit(pageSize)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`COUNT(*)` })
          .from(questions)
          .where(where),
      ]);

      return {
        questions: rows,
        pagination: {
          total: Number(count),
          page,
          pageSize,
          totalPages: Math.ceil(Number(count) / pageSize),
        },
      };
    }),

  // ---------------------------------------------------------------------------
  // ADMIN: retorna questão completa (com gabarito e resolução)
  // ---------------------------------------------------------------------------
  getByIdAdmin: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const [question] = await ctx.db
        .select()
        .from(questions)
        .where(eq(questions.id, input.id))
        .limit(1);

      if (!question) throw new Error("Questão não encontrada");
      return question;
    }),

  // ---------------------------------------------------------------------------
  // ADMIN: cria nova questão
  // ---------------------------------------------------------------------------
  create: adminProcedure
    .input(QuestionBaseSchema)
    .mutation(async ({ ctx, input }) => {
      const newQuestion: NewQuestion = {
        fonte: input.fonte,
        ano: input.ano,
        conteudo_principal: input.conteudo_principal,
        tags: input.tags,
        nivel_dificuldade: input.nivel_dificuldade,
        param_a: input.param_a,
        param_b: input.param_b,
        param_c: input.param_c,
        enunciado: input.enunciado,
        url_imagem: input.url_imagem ?? null,
        alternativas: input.alternativas,
        gabarito: input.gabarito.toUpperCase(),
        comentario_resolucao: input.comentario_resolucao,
        active: true,
      };

      const result = await ctx.db.insert(questions).values(newQuestion);
      return { id: Number(result[0].insertId), success: true };
    }),

  // ---------------------------------------------------------------------------
  // ADMIN: atualiza questão existente
  // ---------------------------------------------------------------------------
  update: adminProcedure
    .input(QuestionBaseSchema.partial().extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const updateData: Partial<NewQuestion> = {};
      if (data.fonte !== undefined) updateData.fonte = data.fonte;
      if (data.ano !== undefined) updateData.ano = data.ano;
      if (data.conteudo_principal !== undefined) updateData.conteudo_principal = data.conteudo_principal;
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (data.nivel_dificuldade !== undefined) updateData.nivel_dificuldade = data.nivel_dificuldade;
      if (data.param_a !== undefined) updateData.param_a = data.param_a;
      if (data.param_b !== undefined) updateData.param_b = data.param_b;
      if (data.param_c !== undefined) updateData.param_c = data.param_c;
      if (data.enunciado !== undefined) updateData.enunciado = data.enunciado;
      if (data.url_imagem !== undefined) updateData.url_imagem = data.url_imagem ?? null;
      if (data.alternativas !== undefined) updateData.alternativas = data.alternativas;
      if (data.gabarito !== undefined) updateData.gabarito = data.gabarito.toUpperCase();
      if (data.comentario_resolucao !== undefined) updateData.comentario_resolucao = data.comentario_resolucao;

      await ctx.db.update(questions).set(updateData).where(eq(questions.id, id));
      return { success: true };
    }),

  // ---------------------------------------------------------------------------
  // ADMIN: ativa / desativa questão (soft delete)
  // ---------------------------------------------------------------------------
  toggleActive: adminProcedure
    .input(z.object({ id: z.number().int().positive(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(questions)
        .set({ active: input.active })
        .where(eq(questions.id, input.id));
      return { success: true };
    }),

  // ---------------------------------------------------------------------------
  // ADMIN: deleta questão permanentemente
  // ---------------------------------------------------------------------------
  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(questions).where(eq(questions.id, input.id));
      return { success: true };
    }),

  // ---------------------------------------------------------------------------
  // ADMIN: importação em lote — aceita o formato JSON do professor
  // ---------------------------------------------------------------------------
  importBatch: adminProcedure
    .input(z.array(ProfessorJsonSchema).min(1).max(100))
    .mutation(async ({ ctx, input }) => {
      const toInsert: NewQuestion[] = input.map((q) => ({
        fonte: q.fonte,
        ano: q.ano,
        conteudo_principal: q.conteudo_principal,
        tags: q.tags,
        nivel_dificuldade: q.nivel_dificuldade,
        param_a: q.parametros_tri.a,
        param_b: q.parametros_tri.b,
        param_c: q.parametros_tri.c,
        enunciado: q.enunciado,
        url_imagem: q.url_imagem ?? null,
        alternativas: q.alternativas as Record<string, string>,
        gabarito: q.gabarito.toUpperCase(),
        comentario_resolucao: q.comentario_resolucao,
        active: true,
      }));

      await ctx.db.insert(questions).values(toInsert);
      return { inserted: toInsert.length, success: true };
    }),
});
