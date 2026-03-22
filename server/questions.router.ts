import { z } from "zod";
import { eq, and, sql, asc, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "./trpc";
import { questions } from "./schema";
import type { NewQuestion } from "./schema";

const NivelDificuldadeEnum = z.enum(["Muito Baixa", "Baixa", "Média", "Alta", "Muito Alta"]);

const QuestionBaseSchema = z.object({
  fonte: z.string().max(50).default("ENEM"),
  ano: z.number().int().min(2000).max(2100).optional(),
  conteudo_principal: z.string().min(1).max(100),
  tags: z.array(z.string()).default([]),
  nivel_dificuldade: NivelDificuldadeEnum.default("Média"),
  param_a: z.number().min(0.1).max(4.0).default(1.0),
  param_b: z.number().min(-4.0).max(4.0).default(0.0),
  param_c: z.number().min(0.0).max(0.5).default(0.2),
  enunciado: z.string().min(5),
  url_imagem: z.string().url().nullable().optional(),
  alternativas: z.record(z.string().min(1).max(5), z.any()),
  gabarito: z.string().length(1),
  comentario_resolucao: z.string().optional(),
});

export const questionsRouter = createTRPCRouter({

  // Listagem para alunos autenticados
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      conteudo: z.string().optional(),
      nivel_dificuldade: NivelDificuldadeEnum.optional(),
      activeOnly: z.boolean().default(true),
      orderBy: z.enum(["id", "conteudo_principal", "nivel_dificuldade", "createdAt"]).default("conteudo_principal"),
      orderDir: z.enum(["asc", "desc"]).default("asc"),
    }))
    .query(async ({ ctx, input }) => {
      const { page, pageSize, activeOnly, orderBy, orderDir } = input;
      const offset = (page - 1) * pageSize;

      const filters: any[] = [];
      if (activeOnly) filters.push(eq(questions.active, true));
      if (input.conteudo) filters.push(sql`${questions.conteudo_principal} LIKE ${'%' + input.conteudo + '%'}`);
      if (input.nivel_dificuldade) filters.push(eq(questions.nivel_dificuldade, input.nivel_dificuldade));

      const where = filters.length > 0 ? and(...filters) : undefined;
      const orderColumn = orderBy === "conteudo_principal" ? questions.conteudo_principal
        : orderBy === "nivel_dificuldade" ? questions.nivel_dificuldade
        : orderBy === "createdAt" ? questions.createdAt
        : questions.id;
      const orderFn = orderDir === "asc" ? asc : desc;

      const [rows, [{ count }]] = await Promise.all([
        ctx.db.select().from(questions).where(where).orderBy(orderFn(orderColumn)).limit(pageSize).offset(offset),
        ctx.db.select({ count: sql<number>`COUNT(*)` }).from(questions).where(where),
      ]);

      return {
        questions: rows,
        pagination: { total: Number(count), page, pageSize, totalPages: Math.ceil(Number(count) / pageSize) },
      };
    }),

  // Admin: questão completa por ID
  getByIdAdmin: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const [q] = await ctx.db.select().from(questions).where(eq(questions.id, input.id)).limit(1);
      if (!q) throw new TRPCError({ code: "NOT_FOUND", message: "Questão não encontrada." });
      return q;
    }),

  // Admin: cria questão
  create: adminProcedure
    .input(QuestionBaseSchema)
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db.insert(questions).values({
        ...input,
        gabarito: input.gabarito.toUpperCase(),
        url_imagem: input.url_imagem ?? null,
        active: true,
      } as NewQuestion);
      return { id: Number(result.insertId), success: true };
    }),

  // Admin: actualiza questão
  update: adminProcedure
    .input(QuestionBaseSchema.partial().extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updateData: Partial<NewQuestion> = { ...data } as any;
      if (data.gabarito) updateData.gabarito = data.gabarito.toUpperCase();
      if (data.url_imagem !== undefined) updateData.url_imagem = data.url_imagem ?? null;
      await ctx.db.update(questions).set(updateData).where(eq(questions.id, id));
      return { success: true };
    }),

  // Admin: activa/desactiva
  toggleActive: adminProcedure
    .input(z.object({ id: z.number().int().positive(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(questions).set({ active: input.active }).where(eq(questions.id, input.id));
      return { success: true };
    }),

  // Admin: elimina uma questão
  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(questions).where(eq(questions.id, input.id));
      return { success: true };
    }),

  // Admin: elimina TODAS as questões do banco
  deleteAll: adminProcedure
    .mutation(async ({ ctx }) => {
      await ctx.db.delete(questions);
      return { success: true };
    }),
});
