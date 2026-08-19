import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

const MAX_REQUESTS_PER_HOUR = 30;
const MAX_REQUESTS_PER_DAY = 150;
const MAX_ESTIMATED_TOKENS_PER_DAY = 250_000;

export const getBudget = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db.get(identity.subject as any);
    if (!user || user.isAnonymous === true) return null;
    return { maxRequestsPerHour: MAX_REQUESTS_PER_HOUR, maxRequestsPerDay: MAX_REQUESTS_PER_DAY, maxEstimatedTokensPerDay: MAX_ESTIMATED_TOKENS_PER_DAY };
  },
});

export const enforceBudgetInternal = internalMutation({
  args: { userId: v.id("users"), estimatedTokens: v.number() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const events = await ctx.db.query("auditLogs").withIndex("by_user", (q) => q.eq("userId", args.userId)).order("desc").collect();
    const recent = events.filter((event) => event.timestamp >= dayAgo && event.action === "ai_request");
    const hourly = recent.filter((event) => event.timestamp >= hourAgo).length;
    const dailyTokens = recent.reduce((sum, event) => sum + Number(event.metadata?.estimatedTokens || 0), 0);
    if (hourly >= MAX_REQUESTS_PER_HOUR) throw new Error("AI hourly limit reached");
    if (recent.length >= MAX_REQUESTS_PER_DAY) throw new Error("AI daily limit reached");
    if (dailyTokens + args.estimatedTokens > MAX_ESTIMATED_TOKENS_PER_DAY) throw new Error("AI daily compute budget reached");
    return true;
  },
});
