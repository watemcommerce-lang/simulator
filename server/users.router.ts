import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "./trpc";
import { users, simulations, simulationAnswers } from "./schema";
import { hashPassword } from "./auth";

export const usersRouter = createTRPCRouter({

  // Lista todos os utilizadores
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
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(users.createdAt);

      if (!input.search) return rows;
      const q = input.search.toLowerCase();
      return rows.filter((u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }),

  // Redefine a senha de um utilizador
  resetPassword: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      newPassword: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
    }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.id))
        .limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });

      const passwordHash = await hashPassword(input.newPassword);
      await ctx.db.update(users).set({ passwordHash }).where(eq(users.id, input.id));

      return { success: true };
    }),

  // Elimina utilizador e todos os seus dados
  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.id, input.id))
        .limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
      if (user.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Não é possível excluir um admin." });

      // Apaga respostas → simulados → utilizador
      const userSims = await ctx.db
        .select({ id: simulations.id })
        .from(simulations)
        .where(eq(simulations.userId, input.id));

      for (const sim of userSims) {
        await ctx.db.delete(simulationAnswers).where(eq(simulationAnswers.simulationId, sim.id));
      }
      await ctx.db.delete(simulations).where(eq(simulations.userId, input.id));
      await ctx.db.delete(users).where(eq(users.id, input.id));

      return { success: true };
    }),
});
