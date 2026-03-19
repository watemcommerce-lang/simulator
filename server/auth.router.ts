import { createTRPCRouter, publicProcedure, protectedProcedure } from "./trpc";

export const authRouter = createTRPCRouter({
  // Retorna o utilizador autenticado actual
  me: protectedProcedure.query(({ ctx }) => {
    return ctx.user;
  }),

  // Logout — limpa o cookie
  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie("token");
    return { success: true };
  }),
});
