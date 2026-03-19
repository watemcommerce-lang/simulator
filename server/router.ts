/**
 * =============================================================================
 * App Router — registo central de todos os routers tRPC
 * =============================================================================
 * Ficheiro: server/_core/router.ts
 *
 * Para adicionar um novo router:
 *   1. Importa-o aqui
 *   2. Adiciona-o ao objeto appRouter
 *   3. O tipo AppRouter é inferido automaticamente — o cliente fica tipado
 * =============================================================================
 */

import { createTRPCRouter } from "./trpc";
import { questionsRouter } from "./questions.router";
import { simulationsRouter } from "./simulations.router";
import { authRouter } from "./auth.router";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  questions: questionsRouter,
  simulations: simulationsRouter,
});

/** Tipo exportado para o cliente tRPC — nunca importar o router em si no frontend */
export type AppRouter = typeof appRouter;
