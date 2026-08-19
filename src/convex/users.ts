import { getAuthUserId } from "@convex-dev/auth/server";
import { query, QueryCtx } from "./_generated/server";

/**
 * AutoAI has no guest mode. Legacy anonymous records are treated as
 * unauthenticated and cannot access diagnostic data or write paths.
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;

  const user = await ctx.db.get(userId);
  if (!user || user.isAnonymous === true) return null;

  return user;
};

export const currentUser = query({
  args: {},
  handler: async (ctx) => getCurrentUser(ctx),
});
