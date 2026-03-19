/**
 * =============================================================================
 * Cliente tRPC — configuração para o frontend React
 * =============================================================================
 * Ficheiro: client/src/lib/trpc.ts
 *
 * Uso nos componentes:
 *   import { trpc } from "@/lib/trpc";
 *
 *   // Query
 *   const { data } = trpc.simulations.getProgress.useQuery();
 *
 *   // Mutation
 *   const start = trpc.simulations.start.useMutation();
 *   await start.mutateAsync({ stage: 1 });
 * =============================================================================
 */

import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../server/_core/router";

// Hook tRPC tipado com o AppRouter do servidor
export const trpc = createTRPCReact<AppRouter>();

// Factory do cliente HTTP — usado no Provider
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        // Envia cookies de sessão (Manus OAuth)
        fetch: (url, options) =>
          fetch(url, { ...options, credentials: "include" }),
      }),
    ],
  });
}
