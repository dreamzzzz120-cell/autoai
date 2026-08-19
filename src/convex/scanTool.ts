import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

/**
 * Read-only scan-tool boundary.
 *
 * The diagnostic AI is never allowed to emit arbitrary CAN/UDS/OBD commands.
 * A hardware adapter owns protocol details and exposes only approved read
 * operations to the diagnostic engine. Control/clear/actuation commands are
 * intentionally absent from this interface.
 */
export const READ_OPERATIONS = [
  "vehicle_info",
  "supported_pids",
  "current_data",
  "freeze_frame",
  "stored_dtcs",
  "pending_dtcs",
  "permanent_dtcs",
  "readiness",
  "monitor_results",
] as const;

export const ingestReadOnlySnapshot = action({
  args: {
    sessionId: v.id("diagnosticSessions"),
    protocol: v.optional(v.string()),
    operation: v.union(
      v.literal("vehicle_info"),
      v.literal("supported_pids"),
      v.literal("current_data"),
      v.literal("freeze_frame"),
      v.literal("stored_dtcs"),
      v.literal("pending_dtcs"),
      v.literal("permanent_dtcs"),
      v.literal("readiness"),
      v.literal("monitor_results"),
    ),
    payload: v.any(),
    adapterId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal, {});
    if (!user) throw new Error("Authentication required");

    // Public getSession performs the second ownership check. The action never
    // trusts a client-supplied session id by itself.
    const session = await ctx.runQuery(api.diagnostics.getSession, { sessionId: args.sessionId });
    if (!session || session.userId !== user._id) throw new Error("Diagnostic session not found");

    return {
      sessionId: args.sessionId,
      operation: args.operation,
      adapterId: args.adapterId.slice(0, 100),
      protocol: args.protocol?.slice(0, 100),
      payload: args.payload,
      capturedAt: Date.now(),
      evidenceLevel: "direct_observed" as const,
      safety: "read_only",
    };
  },
});
