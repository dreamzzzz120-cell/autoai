import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { z } from "zod";
import { UNIVERSAL_DIAGNOSTIC_SYSTEM_PROMPT } from "./diagnosticEngine";
import { buildDiagnosticGate, classifyDiagnosticRisk } from "./diagnosticGuardrails";

const MAX_CONTENT_LENGTH = 10_000;
const MAX_ATTACHMENTS = 5;
const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const UPLOAD_CLAIM_TTL_MS = 10 * 60 * 1000;
const OPENAI_TIMEOUT_MS = 45_000;
const MAX_AI_RESPONSE_BYTES = 120_000;
const RATE_LIMIT_WINDOWS: [number, number][] = [[30, 8], [60, 15], [3600, 60]];
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const ALLOWED_AUDIO_TYPES = ["audio/webm", "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/flac", "audio/x-m4a"] as const;
const UPLOAD_TYPE_MAP: Record<string, "image" | "audio"> = {};
for (const type of ALLOWED_IMAGE_TYPES) UPLOAD_TYPE_MAP[type] = "image";
for (const type of ALLOWED_AUDIO_TYPES) UPLOAD_TYPE_MAP[type] = "audio";

type EvidenceLevelType = "verified_fact" | "strong_evidence" | "professional_inference" | "unknown";

type Attachment = { type: "image" | "audio"; name: string; storageId?: string; transcript?: string };

const DiagnosticResponseSchema = z.object({
  content: z.string().min(1).max(6000),
  evidence: z.object({
    level: z.enum(["verified_fact", "strong_evidence", "professional_inference", "unknown"]),
    sources: z.array(z.object({ type: z.string().max(50), reference: z.string().max(300) })).max(10).default([]),
    confidence: z.number().min(0).max(100).optional(),
    missingEvidence: z.array(z.string().max(300)).max(12).default([]),
    alternativeExplanations: z.array(z.string().max(300)).max(10).default([]),
    nextStep: z.string().max(800).default("Obtain additional evidence before concluding."),
    safetyFlags: z.array(z.string().max(300)).max(10).default([]),
  }),
});

type DiagnosticResponse = z.infer<typeof DiagnosticResponseSchema>;

function sanitizeText(text: string): string {
  return String(text || "")
    .replace(/<script[\\s\\S]*?>[\\s\\S]*?<\\/script>/gi, "")
    .replace(/<style[\\s\\S]*?>[\\s\\S]*?<\\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript\\s*:/gi, "")
    .trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

function normalizeDiagnosis(raw: unknown, inputText: string, machineIdentified: boolean, hasDirectEvidence: boolean): DiagnosticResponse {
  const parsed = DiagnosticResponseSchema.safeParse(raw);
  const base = parsed.success ? parsed.data : fallbackDiagnosis(inputText);
  const clean: DiagnosticResponse = {
    content: sanitizeText(base.content).slice(0, 6000),
    evidence: {
      level: base.evidence.level,
      sources: base.evidence.sources.slice(0, 10).map((s) => ({ type: sanitizeText(s.type).slice(0, 50), reference: `[UNVERIFIED AI CLAIM] ${sanitizeText(s.reference).slice(0, 280)}` })),
      confidence: 0,
      missingEvidence: base.evidence.missingEvidence.slice(0, 12).map((x) => sanitizeText(x).slice(0, 300)),
      alternativeExplanations: base.evidence.alternativeExplanations.slice(0, 10).map((x) => sanitizeText(x).slice(0, 300)),
      nextStep: sanitizeText(base.evidence.nextStep).slice(0, 800),
      safetyFlags: base.evidence.safetyFlags.slice(0, 10).map((x) => sanitizeText(x).slice(0, 300)),
    },
  };

  // AI can never manufacture verified evidence. Directly supplied/retrieved evidence
  // is promoted only by server-side code, never by the model.
  if (clean.evidence.level === "verified_fact" || clean.evidence.level === "strong_evidence") {
    clean.evidence.level = "professional_inference";
  }

  const gate = buildDiagnosticGate({
    text: `${inputText} ${clean.content} ${clean.evidence.safetyFlags.join(" ")}`,
    machineIdentified,
    hasDirectEvidence,
  });

  if (gate.requiresMachineIdentity && !clean.evidence.missingEvidence.some((x) => /machine|vehicle|make|model|identity/i.test(x))) {
    clean.evidence.missingEvidence.unshift("Exact machine identity (year/make/model or manufacturer/model)");
  }
  if (gate.requiresDirectEvidence && !clean.evidence.missingEvidence.some((x) => /measurement|evidence|test|code|inspection/i.test(x))) {
    clean.evidence.missingEvidence.unshift("Direct evidence or an objective measurement");
  }
  if (gate.requiresDiscriminatingTest && !clean.evidence.nextStep) {
    clean.evidence.nextStep = "Perform a safe discriminating test before replacing a component.";
  }
  if (gate.prohibitsPartsReplacementClaim && /replace|replacement|install|condemn|bad component|failed component/i.test(clean.content)) {
    clean.content = `${clean.content} Do not replace or condemn a component from this evidence alone; verify it with the recommended test.`;
  }
  if (gate.risk === "stop_work" && clean.evidence.safetyFlags.length === 0) {
    clean.evidence.safetyFlags.push("STOP WORK: isolate the machine and follow the manufacturer's safe procedure before further hands-on diagnosis.");
  }
  if (gate.risk === "safety_critical" && clean.evidence.safetyFlags.length === 0) {
    clean.evidence.safetyFlags.push("Safety-critical condition detected: do not operate until the relevant system is safely inspected.");
  }

  const levelBase: Record<EvidenceLevelType, number> = { verified_fact: 82, strong_evidence: 68, professional_inference: 48, unknown: 20 };
  const missingPenalty = Math.min(clean.evidence.missingEvidence.length, 8) * 4;
  const safetyPenalty = Math.min(clean.evidence.safetyFlags.length, 4) * 4;
  const gatePenalty = gate.requiresMachineIdentity || gate.requiresDirectEvidence ? 8 : 0;
  clean.evidence.confidence = clamp(Math.round(levelBase[clean.evidence.level] - missingPenalty - safetyPenalty - gatePenalty), 5, 74);

  if (!clean.evidence.missingEvidence.length) {
    clean.evidence.missingEvidence.push("Independent measurement or authoritative service evidence required before a high-confidence repair decision.");
  }
  return clean;
}

function fallbackDiagnosis(message: string): DiagnosticResponse {
  const text = message.toLowerCase();
  const safety: string[] = [];
  if (/brake|no brake|can't stop|cannot stop/.test(text)) safety.push("Possible brake-system failure: do not operate until inspected.");
  if (/steer|steering|wheel.*loose|lug/.test(text)) safety.push("Possible steering/wheel-control fault: do not operate until inspected.");
  if (/fuel leak|gasoline leak|diesel leak|fuel smell|smoke|fire/.test(text)) safety.push("Possible fire/fuel hazard: shut down safely and isolate ignition sources.");
  if (/overheat|overheating|temperature.*red|boil/.test(text)) safety.push("Possible overheating: stop operation and allow the system to cool safely.");
  if (/high voltage|hv battery|traction battery|orange cable|ev battery/.test(text)) safety.push("High-voltage risk: do not expose energized conductors or bypass interlocks.");
  if (/hydraulic|hydraulics|injection injury/.test(text)) safety.push("High-pressure hydraulic risk: isolate and depressurize using the manufacturer's procedure.");
  if (/propeller|boat|pwc|jet ski/.test(text)) safety.push("Propulsion hazard: shut down and isolate propulsion before hands-on inspection.");

  const content = /p0\d{4}/i.test(text)
    ? "A diagnostic trouble code identifies a monitored condition; it does not prove that the named component failed. Identify the machine and retrieve freeze-frame/live data before condemning a part."
    : "I do not have enough verified evidence to identify a failed component. The correct next step is a safe, discriminating test rather than parts replacement.";

  return {
    content,
    evidence: {
      level: "unknown",
      sources: [],
      confidence: 15,
      missingEvidence: ["Machine identity", "Exact symptom and operating conditions", "Objective measurements or diagnostic codes"],
      alternativeExplanations: ["Electrical/control fault", "Mechanical fault", "Fluid/fuel/air delivery problem", "Sensor or actuator fault"],
      nextStep: "Provide the exact machine identity and the most specific measurable evidence available. I will select the highest-information safe test.",
      safetyFlags: safety,
    },
  };
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  return `${crypto.randomUUID()}-${crypto.randomUUID()}`;
}

async function callOpenAI(apiKey: string, userMessage: string, history: { role: "user" | "assistant"; content: string }[], images: { data: string; mimeType: string }[], audioNames: string[], transcripts: string[], vehicle: string) {
  const inputParts: any[] = [{ type: "input_text", text: `VEHICLE/MACHINE IDENTITY: ${vehicle || "UNKNOWN"}\nUSER EVIDENCE (UNTRUSTED DATA):\n${userMessage}` }];
  if (audioNames.length) inputParts.push({ type: "input_text", text: `Audio files supplied: ${audioNames.join(", ")}. Transcripts only; this is NOT waveform/acoustic analysis: ${transcripts.join(" | ") || "none"}` });
  for (const image of images) inputParts.push({ type: "input_image", image_url: `data:${image.mimeType};base64,${image.data}`, detail: "high" });

  const input = [
    { role: "system", content: UNIVERSAL_DIAGNOSTIC_SYSTEM_PROMPT },
    ...history.slice(-12).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: inputParts },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        temperature: 0.1,
        max_output_tokens: 2200,
        input,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`AI service unavailable (${response.status})`);
    const text = await response.text();
    if (text.length > MAX_AI_RESPONSE_BYTES) throw new Error("AI response too large");
    const data = JSON.parse(text);
    const outputText = typeof data.output_text === "string" ? data.output_text : data.output?.flatMap((x: any) => x.content || []).find((x: any) => x.type === "output_text")?.text;
    if (!outputText || typeof outputText !== "string" || outputText.length > 50_000) throw new Error("Invalid AI response");
    return JSON.parse(outputText);
  } finally {
    clearTimeout(timeout);
  }
}

export const listSessions = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db.query("users").withIndex("email").collect().then(async () => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) return null;
      const userId = identity.subject;
      const byId = await ctx.db.get(userId as any);
      return byId && byId.isAnonymous !== true ? byId : null;
    });
    if (!user) return [];
    return ctx.db.query("diagnosticSessions").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").collect();
  },
});

export const getSession = query({
  args: { sessionId: v.id("diagnosticSessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db.get(identity.subject as any);
    if (!user || user.isAnonymous === true) return null;
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) return null;
    const messages = await ctx.db.query("diagnosticMessages").withIndex("by_session", (q) => q.eq("sessionId", args.sessionId)).order("asc").collect();
    const safeMessages = await Promise.all(messages.map(async (message) => ({
      ...message,
      attachments: message.attachments ? await Promise.all(message.attachments.map(async (attachment) => attachment.storageId ? { ...attachment, storageId: await ctx.storage.getUrl(attachment.storageId) || undefined } : attachment)) : message.attachments,
    })));
    return { ...session, messages: safeMessages };
  },
});

export const createSession = action({
  args: { title: v.string(), vehicleInfo: v.optional(v.object({ make: v.optional(v.string()), model: v.optional(v.string()), year: v.optional(v.number()), vin: v.optional(v.string()) })) },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal, {});
    if (!user) throw new Error("Authentication required. Guest access is disabled.");
    const title = sanitizeText(args.title).slice(0, 200);
    if (!title) throw new Error("Session title is required");
    return ctx.runMutation(internal.diagnostics.createSessionInternal, {
      userId: user._id,
      title,
      vehicleInfo: args.vehicleInfo ? { make: args.vehicleInfo.make ? sanitizeText(args.vehicleInfo.make).slice(0, 80) : undefined, model: args.vehicleInfo.model ? sanitizeText(args.vehicleInfo.model).slice(0, 80) : undefined, year: args.vehicleInfo.year ? clamp(args.vehicleInfo.year, 1886, 2100) : undefined, vin: args.vehicleInfo.vin ? sanitizeText(args.vehicleInfo.vin).slice(0, 17).toUpperCase() : undefined },
    });
  },
});

export const deleteSession = action({
  args: { sessionId: v.id("diagnosticSessions") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal, {});
    if (!user) throw new Error("Authentication required. Guest access is disabled.");
    return ctx.runMutation(internal.diagnostics.deleteSessionInternal, { userId: user._id, sessionId: args.sessionId });
  },
});

export const generateUploadUrl = action({
  args: { contentType: v.string(), fileName: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal, {});
    if (!user) throw new Error("Authentication required. Guest access is disabled.");
    const contentType = args.contentType.toLowerCase().trim();
    const kind = UPLOAD_TYPE_MAP[contentType];
    if (!kind) throw new Error("Unsupported upload type");
    const fileName = sanitizeText(args.fileName).trim().slice(0, 255);
    if (!fileName) throw new Error("Invalid filename");
    const token = randomToken();
    const tokenHash = await sha256(token);
    const uploadUrl = await ctx.storage.generateUploadUrl();
    await ctx.runMutation(internal.diagnostics.createUploadClaimInternal, { userId: user._id, tokenHash, contentType, fileName });
    return { uploadUrl, kind, token };
  },
});

export const sendMessage = action({
  args: {
    sessionId: v.id("diagnosticSessions"),
    content: v.string(),
    attachments: v.optional(v.array(v.object({ type: v.union(v.literal("image"), v.literal("audio")), name: v.string(), storageId: v.string(), claimToken: v.string() }))),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal, {});
    if (!user) throw new Error("Authentication required. Guest access is disabled.");
    const content = sanitizeText(args.content).slice(0, MAX_CONTENT_LENGTH);
    if (!content && !args.attachments?.length) throw new Error("Message cannot be empty");
    if ((args.attachments?.length || 0) > MAX_ATTACHMENTS) throw new Error("Too many attachments");

    const prepared = await ctx.runMutation(internal.diagnostics.prepareMessageInternal, {
      userId: user._id,
      sessionId: args.sessionId,
      content: content || "[Media attachment]",
      attachments: args.attachments || [],
    });

    const images: { data: string; mimeType: string }[] = [];
    const audioNames: string[] = [];
    const transcripts: string[] = [];
    for (const attachment of prepared.attachments) {
      const url = await ctx.storage.getUrl(attachment.storageId);
      if (!url) continue;
      const response = await fetch(url);
      if (!response.ok) continue;
      const buffer = await response.arrayBuffer();
      if (attachment.type === "image") {
        if (buffer.byteLength <= MAX_IMAGE_SIZE_BYTES) images.push({ data: Buffer.from(buffer).toString("base64"), mimeType: attachment.contentType });
      } else {
        audioNames.push(attachment.name);
        if (buffer.byteLength <= MAX_AUDIO_SIZE_BYTES) {
          const transcript = await transcribeAudio(process.env.OPENAI_API_KEY || "", buffer, attachment.name);
          if (transcript) transcripts.push(transcript);
          await ctx.runMutation(internal.diagnostics.saveTranscriptInternal, { userId: user._id, messageId: prepared.messageId, storageId: attachment.storageId, transcript });
        }
      }
    }

    let diagnosis: DiagnosticResponse;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      diagnosis = fallbackDiagnosis(content);
    } else {
      try {
        const raw = await callOpenAI(apiKey, content, prepared.history, images, audioNames, transcripts, prepared.vehicleIdentity);
        diagnosis = normalizeDiagnosis(raw, content, Boolean(prepared.vehicleIdentity), images.length > 0 || transcripts.length > 0 || /\bP[0-3][0-9A-F]{4}\b/i.test(content));
      } catch {
        diagnosis = fallbackDiagnosis(content);
      }
    }

    return ctx.runMutation(internal.diagnostics.saveAssistantMessageInternal, {
      userId: user._id,
      sessionId: args.sessionId,
      content: diagnosis.content,
      evidence: diagnosis.evidence,
    });
  },
});

async function transcribeAudio(apiKey: string, buffer: ArrayBuffer, fileName: string): Promise<string> {
  if (!apiKey || buffer.byteLength > MAX_AUDIO_SIZE_BYTES) return "";
  const ext = fileName.split(".").pop()?.toLowerCase() || "webm";
  const mime: Record<string, string> = { webm: "audio/webm", mp3: "audio/mpeg", mp4: "audio/mp4", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", flac: "audio/flac" };
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mime[ext] || "audio/webm" }), fileName);
  form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
  form.append("response_format", "json");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: controller.signal });
    if (!response.ok) return "";
    const text = await response.text();
    if (text.length > 50_000) return "";
    const data = JSON.parse(text);
    return sanitizeText(data.text || "").slice(0, 2500);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

export const createSessionInternal = internalMutation({
  args: { userId: v.id("users"), title: v.string(), vehicleInfo: v.optional(v.object({ make: v.optional(v.string()), model: v.optional(v.string()), year: v.optional(v.number()), vin: v.optional(v.string()) })) },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.isAnonymous === true) throw new Error("Invalid authenticated user");
    const now = Date.now();
    const id = await ctx.db.insert("diagnosticSessions", { userId: args.userId, title: args.title, vehicleInfo: args.vehicleInfo, status: "active", createdAt: now, updatedAt: now });
    await ctx.db.insert("auditLogs", { userId: args.userId, action: "session_create", targetId: id, metadata: JSON.stringify({ title: args.title }).slice(0, 4000), timestamp: now });
    return id;
  },
});

export const deleteSessionInternal = internalMutation({
  args: { userId: v.id("users"), sessionId: v.id("diagnosticSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) throw new Error("Not found");
    const messages = await ctx.db.query("diagnosticMessages").withIndex("by_session", (q) => q.eq("sessionId", args.sessionId)).collect();
    for (const message of messages) {
      for (const attachment of message.attachments || []) if (attachment.storageId) await ctx.storage.delete(attachment.storageId);
      await ctx.db.delete(message._id);
    }
    const claims = await ctx.db.query("uploadClaims").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect();
    for (const claim of claims.filter((c) => c.storageId && c.claimedAt)) await ctx.db.delete(claim._id);
    await ctx.db.delete(args.sessionId);
    await ctx.db.insert("auditLogs", { userId: args.userId, action: "session_delete", targetId: args.sessionId, metadata: JSON.stringify({ messageCount: messages.length }).slice(0, 4000), timestamp: Date.now() });
  },
});

export const createUploadClaimInternal = internalMutation({
  args: { userId: v.id("users"), tokenHash: v.string(), contentType: v.string(), fileName: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.isAnonymous === true) throw new Error("Invalid authenticated user");
    await ctx.db.insert("uploadClaims", { userId: args.userId, tokenHash: args.tokenHash, contentType: args.contentType, fileName: args.fileName, createdAt: Date.now(), expiresAt: Date.now() + UPLOAD_CLAIM_TTL_MS });
  },
});

export const prepareMessageInternal = internalMutation({
  args: { userId: v.id("users"), sessionId: v.id("diagnosticSessions"), content: v.string(), attachments: v.array(v.object({ type: v.union(v.literal("image"), v.literal("audio")), name: v.string(), storageId: v.string(), claimToken: v.string() })) },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) throw new Error("Not found");
    const historyDocs = await ctx.db.query("diagnosticMessages").withIndex("by_session", (q) => q.eq("sessionId", args.sessionId)).order("desc").take(12);
    const preparedAttachments: { type: "image" | "audio"; name: string; storageId: string; contentType: string }[] = [];
    for (const attachment of args.attachments) {
      const tokenHash = await sha256(attachment.claimToken);
      const claims = await ctx.db.query("uploadClaims").withIndex("by_token", (q) => q.eq("tokenHash", tokenHash)).collect();
      const claim = claims.find((c) => c.userId === args.userId && !c.claimedAt && c.expiresAt >= Date.now() && c.fileName === attachment.name && UPLOAD_TYPE_MAP[c.contentType] === attachment.type);
      if (!claim) throw new Error("Invalid, expired, or already-used upload claim");
      const url = await ctx.storage.getUrl(attachment.storageId);
      if (!url) throw new Error("Attachment not found");
      await ctx.db.patch(claim._id, { storageId: attachment.storageId, claimedAt: Date.now() });
      preparedAttachments.push({ type: attachment.type, name: attachment.name, storageId: attachment.storageId, contentType: claim.contentType });
    }
    const messageId = await ctx.db.insert("diagnosticMessages", { sessionId: args.sessionId, role: "user", content: args.content, attachments: args.attachments.map((a) => ({ type: a.type, name: a.name, storageId: a.storageId })), createdAt: Date.now() });
    const history = historyDocs.reverse().map((m) => ({ role: m.role === "assistant" ? "assistant" as const : "user" as const, content: m.content }));
    const vehicle = session.vehicleInfo ? [session.vehicleInfo.year, session.vehicleInfo.make, session.vehicleInfo.model, session.vehicleInfo.vin].filter(Boolean).join(" ") : "";
    return { messageId, attachments: preparedAttachments, history, vehicleIdentity: vehicle };
  },
});

export const saveTranscriptInternal = internalMutation({
  args: { userId: v.id("users"), messageId: v.id("diagnosticMessages"), storageId: v.string(), transcript: v.string() },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return;
    const session = await ctx.db.get(message.sessionId);
    if (!session || session.userId !== args.userId) return;
    const attachments = (message.attachments || []).map((a) => a.storageId === args.storageId ? { ...a, transcript: args.transcript.slice(0, 2500) } : a);
    await ctx.db.patch(message._id, { attachments });
  },
});

export const saveAssistantMessageInternal = internalMutation({
  args: { userId: v.id("users"), sessionId: v.id("diagnosticSessions"), content: v.string(), evidence: v.object({ level: v.union(v.literal("verified_fact"), v.literal("strong_evidence"), v.literal("professional_inference"), v.literal("unknown")), sources: v.array(v.object({ type: v.string(), reference: v.string() })), confidence: v.number(), missingEvidence: v.array(v.string()), alternativeExplanations: v.array(v.string()), nextStep: v.string(), safetyFlags: v.array(v.string()) }) },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) throw new Error("Not found");
    const now = Date.now();
    const messageId = await ctx.db.insert("diagnosticMessages", { sessionId: args.sessionId, role: "assistant", content: args.content, evidence: args.evidence, createdAt: now });
    await ctx.db.patch(args.sessionId, { updatedAt: now, confidenceSummary: args.evidence.confidence });
    await ctx.db.insert("auditLogs", { userId: args.userId, action: "message_send", targetId: messageId, metadata: JSON.stringify({ sessionId: args.sessionId, confidence: args.evidence.confidence, risk: classifyDiagnosticRisk(`${args.content} ${args.evidence.safetyFlags.join(" ")}`) }).slice(0, 4000), timestamp: now });
    return messageId;
  },
});

export const cleanupRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Math.floor(Date.now() / 1000) - 3600;
    const rows = await ctx.db.query("rateLimits").collect();
    for (const row of rows) {
      const match = row.window.match(/^(?:30|60|3600)s:(\\d+)$/);
      if (match && Number(match[1]) < cutoff) await ctx.db.delete(row._id);
    }
  },
});

export const cleanupUploadClaims = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const claims = await ctx.db.query("uploadClaims").collect();
    for (const claim of claims) {
      if (claim.expiresAt < now) {
        if (claim.storageId && !claim.claimedAt) {
          try { await ctx.storage.delete(claim.storageId); } catch { /* already deleted */ }
        }
        await ctx.db.delete(claim._id);
      }
    }
  },
});
