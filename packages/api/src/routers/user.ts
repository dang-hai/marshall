import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";

export const userRouter = router({
  me: protectedProcedure.query(({ ctx }) => {
    return ctx.session.user;
  }),

  getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    // Placeholder - implement with actual database query
    return { id: input.id, email: "", name: null };
  }),
});
