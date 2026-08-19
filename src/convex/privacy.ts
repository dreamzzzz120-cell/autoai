import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const requestAccountDeletion = action({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal, {});
    if (!user) throw new Error("Authentication required");
    await ctx.runMutation(internal.privacy.deleteUserDataInternal, { userId: user._id });
    return { deleted: true };
  },
});

export const deleteUserDataInternal = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db.query("diagnosticSessions").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect();
    for (const session of sessions) {
      const messages = await ctx.db.query("diagnosticMessages").withIndex("by_session", (q) => q.eq("sessionId", session._id)).collect();
      for (const message of messages) await ctx.db.delete(message._id);
      await ctx.db.delete(session._id);
    }
    const claims = await ctx.db.query("uploadClaims").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect();
    for (const claim of claims) await ctx.db.delete(claim._id);
    const limits = await ctx.db.query("rateLimits").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect();
    for (const limit of limits) await ctx.db.delete(limit._id);
    const logs = await ctx.db.query("auditLogs").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect();
    for (const log of logs) await ctx.db.delete(log._id);
    await ctx.db.delete(args.userId);
    return true;
  },
});
