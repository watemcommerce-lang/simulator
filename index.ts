/**
 * =============================================================================
 * Servidor Express — ponto de entrada
 * =============================================================================
 * Ficheiro: server/_core/index.ts
 *
 * Liga o tRPC ao Express e serve o frontend React em produção.
 * =============================================================================
 */

import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path from "node:path";
import { createContext } from "./trpc";
import { appRouter } from "./router";
import { authMiddleware } from "../middleware/auth";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const isProd = process.env.NODE_ENV === "production";

// =============================================================================
// Middlewares globais
// =============================================================================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Middleware de autenticação — injeta req.user a partir do JWT/cookie
app.use(authMiddleware);

// =============================================================================
// tRPC
// =============================================================================

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(`[tRPC] /${path}:`, error.message);
          }
        : undefined,
  })
);

// =============================================================================
// Frontend estático (produção)
// =============================================================================

if (isProd) {
  const distPath = path.resolve(import.meta.dirname, "../../dist/public");
  app.use(express.static(distPath));

  // SPA fallback — todas as rotas não-API servem o index.html
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// =============================================================================
// Start
// =============================================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🚀 Servidor a correr em http://localhost:${PORT} [${process.env.NODE_ENV ?? "development"}]`
  );
});

export type { AppRouter } from "./router";
