import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "./trpc";
import { users, simulations, simulationAnswers } from "./schema";
import { hashPassword } from "./auth";

export const usersRouter = createTRPCRouter({

  // Lista todos os utilizadores com status de assinatura
  list: adminProcedure
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          active: users.active,
          subscriptionExpiresAt: users.subscriptionExpiresAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(users.createdAt);

      const now = new Date();

      const withStatus = rows.map((u) => ({
        ...u,
        subscriptionStatus:
          u.role === "admin" ? "admin" :
          u.subscriptionExpiresAt === null ? "sem_assinatura" :
          u.subscriptionExpiresAt > now ? "ativa" : "expirada",
        daysRemaining:
          u.subscriptionExpiresAt && u.subscriptionExpiresAt > now
            ? Math.ceil((u.subscriptionExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null,
      }));

      if (!input.search) return withStatus;
      const q = input.search.toLowerCase();
      return withStatus.filter((u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }),

  // Define ou renova a assinatura de um utilizador
  setSubscription: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      // Número de meses a adicionar a partir de hoje (ou da expiração actual se ainda válida)
      months: z.number().int().min(1).max(24),
    }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select({ id: users.id, subscriptionExpiresAt: users.subscriptionExpiresAt })
        .from(users)
        .where(eq(users.id, input.id))
        .limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Utilizador não encontrado." });

      const now = new Date();
      // Se ainda tem assinatura válida, renova a partir da expiração actual
      const base = user.subscriptionExpiresAt && user.subscriptionExpiresAt > now
        ? user.subscriptionExpiresAt
        : now;

      const newExpiry = new Date(base);
      newExpiry.setMonth(newExpiry.getMonth() + input.months);

      await ctx.db
        .update(users)
        .set({ subscriptionExpiresAt: newExpiry, active: true })
        .where(eq(users.id, input.id));

      return { success: true, expiresAt: newExpiry };
    }),

  // Remove a assinatura de um utilizador
  revokeSubscription: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ subscriptionExpiresAt: null, active: false })
        .where(eq(users.id, input.id));
      return { success: true };
    }),

  // Redefine a senha
  resetPassword: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      newPassword: z.string().min(6),
    }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db.select({ id: users.id }).from(users).where(eq(users.id, input.id)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Utilizador não encontrado." });

      const passwordHash = await hashPassword(input.newPassword);
      await ctx.db.update(users).set({ passwordHash }).where(eq(users.id, input.id));
      return { success: true };
    }),

  // Elimina utilizador
  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.id, input.id))
        .limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Utilizador não encontrado." });
      if (user.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Não é possível excluir um admin." });

      const userSims = await ctx.db.select({ id: simulations.id }).from(simulations).where(eq(simulations.userId, input.id));
      for (const sim of userSims) {
        await ctx.db.delete(simulationAnswers).where(eq(simulationAnswers.simulationId, sim.id));
      }
      await ctx.db.delete(simulations).where(eq(simulations.userId, input.id));
      await ctx.db.delete(users).where(eq(users.id, input.id));
      return { success: true };
    }),
});
