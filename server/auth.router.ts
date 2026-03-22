import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "./trpc";
import { users } from "./schema";
import { hashPassword, verifyPassword, createToken } from "./auth";

export const authRouter = createTRPCRouter({

  // Retorna sessão actual — público (retorna null se não logado)
  me: publicProcedure.query(({ ctx }) => {
    return ctx.user ?? null;
  }),

  // Registo
  register: publicProcedure
    .input(z.object({
      name: z.string().min(2).max(100),
      email: z.string().email(),
      password: z.string().min(6),
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Este email já está registado." });
      }

      const passwordHash = await hashPassword(input.password);

      const [result] = await ctx.db.insert(users).values({
        name: input.name,
        email: input.email,
        passwordHash,
        role: "student",
      });

      const userId = Number(result.insertId);
      const token = await createToken({ id: userId, email: input.email, name: input.name, role: "student" });

      ctx.res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
      });

      return { id: userId, name: input.name, email: input.email, role: "student" };
    }),

  // Login
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha incorrectos." });
      }

      if (!user.active) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Conta desactivada." });
      }

      const token = await createToken({ id: user.id, email: user.email, name: user.name, role: user.role });

      ctx.res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return { id: user.id, name: user.name, email: user.email, role: user.role };
    }),

  // Logout
  logout: protectedProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie("token");
    return { success: true };
  }),
});
