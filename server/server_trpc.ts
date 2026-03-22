import { initTRPC, TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import superjson from "superjson";
import { db } from "./db";
import { users } from "./schema";
import { eq } from "drizzle-orm";

export interface TRPCContext {
  db: typeof db;
  req: Request;
  res: Response;
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
  } | null;
}

export async function createContext({ req, res }: { req: Request; res: Response }): Promise<TRPCContext> {
  return { db, req, res, user: (req as any).user ?? null };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) { return shape; },
});

export const createTRPCRouter = t.router;

const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão expirada. Faça login novamente." });

  // Verifica assinatura — admins sempre passam
  if (ctx.user.role !== "admin") {
    const [user] = await ctx.db
      .select({ subscriptionExpiresAt: users.subscriptionExpiresAt, active: users.active })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user || !user.active) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Conta inativa. Entre em contato com o administrador." });
    }

    if (user.subscriptionExpiresAt !== null && user.subscriptionExpiresAt < new Date()) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Sua assinatura expirou. Renove para continuar." });
    }
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(isAdmin);
