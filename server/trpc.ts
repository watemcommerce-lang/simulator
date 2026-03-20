/**
 * =============================================================================
 * tRPC Base — contexto, middlewares e procedures tipadas
 * =============================================================================
 * Ficheiro: server/_core/trpc.ts
 * =============================================================================
 */

import { initTRPC, TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import superjson from "superjson";
import { db } from "./db";

// =============================================================================
// Contexto
// =============================================================================

export interface TRPCContext {
  db: typeof db;
  req: Request;
  res: Response;
  user: {
    id: string;
    email: string;
    name: string;
    role: "student" | "admin";
  } | null;
}

export async function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<TRPCContext> {
  // O utilizador é injectado pelo middleware de autenticação (Manus OAuth / JWT)
  const user = (req as any).user ?? null;
  return { db, req, res, user };
}

// =============================================================================
// tRPC init
// =============================================================================

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const createTRPCRouter = t.router;
export const middleware = t.middleware;

// =============================================================================
// Middlewares
// =============================================================================

/** Garante que o utilizador está autenticado */
const isAuthenticated = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "É necessário estar autenticado para aceder a este recurso.",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Garante que o utilizador tem role admin */
const isAdmin = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Não autenticado." });
  }
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso restrito a administradores.",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// =============================================================================
// Procedures exportadas
// =============================================================================

/** Rota pública — qualquer utilizador (autenticado ou não) */
export const publicProcedure = t.procedure;

/** Rota protegida — requer autenticação */
export const protectedProcedure = t.procedure.use(isAuthenticated);

/** Rota admin — requer role admin */
export const adminProcedure = t.procedure.use(isAdmin);
