import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

export const ROLES = { ADMIN: "admin", USER: "user", MEMBER: "member" } as const;
export const roleValidator = v.union(v.literal(ROLES.ADMIN), v.literal(ROLES.USER), v.literal(ROLES.MEMBER));
export type Role = Infer<typeof roleValidator>;
export const evidenceLevels = v.union(v.literal("verified_fact"), v.literal("strong_evidence"), v.literal("professional_inference"), v.literal("unknown"));
export type EvidenceLevel = Infer<typeof evidenceLevels>;

const schema = defineSchema({
  ...authTables,
  users: defineTable({ name: v.optional(v.string()), image: v.optional(v.string()), email: v.optional(v.string()), emailVerificationTime: v.optional(v.number()), isAnonymous: v.optional(v.boolean()), role: v.optional(roleValidator) }).index("email", ["email"]),
  diagnosticSessions: defineTable({
    userId: v.id("users"), title: v.string(),
    vehicleInfo: v.optional(v.object({ make: v.optional(v.string()), model: v.optional(v.string()), year: v.optional(v.number()), vin: v.optional(v.string()) })),
    status: v.union(v.literal("active"), v.literal("resolved"), v.literal("archived")), confidenceSummary: v.optional(v.number()), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_user", ["userId"]).index("by_user_status", ["userId", "status"]),
  diagnosticMessages: defineTable({
    sessionId: v.id("diagnosticSessions"), role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")), content: v.string(),
    evidence: v.optional(v.object({ level: evidenceLevels, sources: v.array(v.object({ type: v.string(), reference: v.string(), url: v.optional(v.string()) })), confidence: v.optional(v.number()), missingEvidence: v.optional(v.array(v.string())), alternativeExplanations: v.optional(v.array(v.string())), nextStep: v.optional(v.string()), safetyFlags: v.optional(v.array(v.string())) })),
    attachments: v.optional(v.array(v.object({ type: v.union(v.literal("image"), v.literal("audio")), name: v.string(), storageId: v.optional(v.string()), transcript: v.optional(v.string()) }))),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),
  rateLimits: defineTable({ userId: v.id("users"), window: v.string(), count: v.number() }).index("by_user_window", ["userId", "window"]),
  auditLogs: defineTable({ userId: v.id("users"), action: v.union(v.literal("session_create"), v.literal("session_delete"), v.literal("message_send")), targetId: v.string(), metadata: v.optional(v.string()), timestamp: v.number() }).index("by_user", ["userId"]).index("by_action", ["action"]),
  uploadClaims: defineTable({ userId: v.id("users"), tokenHash: v.string(), storageId: v.optional(v.string()), contentType: v.string(), fileName: v.string(), createdAt: v.number(), expiresAt: v.number(), claimedAt: v.optional(v.number()) }).index("by_token", ["tokenHash"]).index("by_user", ["userId"]),
}, { schemaValidation: true });

export default schema;
