import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// Evidence levels for diagnostic messages
export const evidenceLevels = v.union(
  v.literal("verified_fact"),
  v.literal("strong_evidence"),
  v.literal("professional_inference"),
  v.literal("unknown"),
);
export type EvidenceLevel = Infer<typeof evidenceLevels>;

const schema = defineSchema(
  {
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
    }).index("email", ["email"]),

    // Diagnostic sessions (conversations)
    diagnosticSessions: defineTable({
      userId: v.id("users"),
      title: v.string(),
      vehicleInfo: v.optional(
        v.object({
          make: v.optional(v.string()),
          model: v.optional(v.string()),
          year: v.optional(v.number()),
          vin: v.optional(v.string()),
        }),
      ),
      status: v.union(v.literal("active"), v.literal("resolved"), v.literal("archived")),
      confidenceSummary: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_status", ["userId", "status"]),

    // Messages within a diagnostic session
    diagnosticMessages: defineTable({
      sessionId: v.id("diagnosticSessions"),
      role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
      content: v.string(),
      // Evidence metadata for assistant messages
      evidence: v.optional(
        v.object({
          level: evidenceLevels,
          sources: v.array(
            v.object({
              type: v.string(), // e.g. "oem_manual", "tsb", "obdii", "visual", "audio", "industry_standard"
              reference: v.string(), // e.g. "TSB #21-047", "OBD-II P0302"
              url: v.optional(v.string()),
            }),
          ),
          confidence: v.optional(v.number()), // 0-100
          missingEvidence: v.optional(v.array(v.string())),
          alternativeExplanations: v.optional(v.array(v.string())),
          nextStep: v.optional(v.string()),
          safetyFlags: v.optional(v.array(v.string())),
        }),
      ),
      // For user messages: attached media references
      attachments: v.optional(
        v.array(
          v.object({
            type: v.union(v.literal("image"), v.literal("audio"), v.literal("video"), v.literal("document")),
            name: v.string(),
            storageId: v.optional(v.string()),
            transcript: v.optional(v.string()),
          }),
        ),
      ),
      createdAt: v.number(),
    }).index("by_session", ["sessionId"]),

    // Per-user rate limiting counters
    rateLimits: defineTable({
      userId: v.id("users"),
      window: v.string(), // e.g. "30s:1719600000"
      count: v.number(),
    })
      .index("by_user_window", ["userId", "window"]),

    // Audit log for security monitoring and debugging
    auditLogs: defineTable({
      userId: v.id("users"),
      action: v.union(
        v.literal("session_create"),
        v.literal("session_delete"),
        v.literal("message_send"),
      ),
      targetId: v.string(), // session ID or message ID
      metadata: v.optional(v.string()), // JSON-encoded extra context
      timestamp: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_action", ["action"]),
  },
  {
    schemaValidation: true,
  },
);

export default schema;
