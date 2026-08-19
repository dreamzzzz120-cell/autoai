import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

export type ObdSnapshot = {
  protocol?: string;
  dtcs: string[];
  freezeFrame: Record<string, number | string>;
  liveData: Record<string, number | string>;
  readiness: Record<string, boolean>;
  capturedAt: number;
};

export const validateObdSnapshot = action({
  args: {
    dtcs: v.array(v.string()),
    freezeFrame: v.optional(v.any()),
    liveData: v.optional(v.any()),
    readiness: v.optional(v.any()),
    protocol: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal, {});
    if (!user) throw new Error("Authentication required");
    const dtcs = args.dtcs.map((code) => code.trim().toUpperCase()).filter((code) => /^[PCBU][0-9A-F]{4}$/.test(code)).slice(0, 100);
    return {
      protocol: args.protocol?.slice(0, 100),
      dtcs,
      freezeFrame: (args.freezeFrame && typeof args.freezeFrame === "object" ? args.freezeFrame : {}) as Record<string, number | string>,
      liveData: (args.liveData && typeof args.liveData === "object" ? args.liveData : {}) as Record<string, number | string>,
      readiness: (args.readiness && typeof args.readiness === "object" ? args.readiness : {}) as Record<string, boolean>,
      capturedAt: Date.now(),
      evidenceLevel: dtcs.length || Object.keys(args.liveData || {}).length ? "direct_observed" : "unknown",
    } satisfies ObdSnapshot & { evidenceLevel: string };
  },
});

export const explainDtc = action({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal, {});
    if (!user) throw new Error("Authentication required");
    const code = args.code.trim().toUpperCase();
    if (!/^[PCBU][0-9A-F]{4}$/.test(code)) throw new Error("Invalid DTC");
    const prefix: Record<string, string> = { P: "Powertrain", C: "Chassis", B: "Body", U: "Network/communication" };
    return { code, category: prefix[code[0]] || "Unknown", warning: "A DTC identifies a monitored condition; it does not by itself prove a failed component.", verified: true, source: "SAE diagnostic convention" };
  },
});
