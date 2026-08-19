import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getCurrentUser } from "./users";
import { evidenceLevels } from "./schema";

// ─── Security Constants ────────────────────────────────────

const MAX_CONTENT_LENGTH = 10_000;
const MAX_ATTACHMENTS = 5;
const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024; // Whisper limit: 25MB
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;  // 10MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_AUDIO_TYPES = [
  "audio/webm", "audio/mpeg", "audio/mp4", "audio/wav",
  "audio/ogg", "audio/flac", "audio/x-m4a",
];

const UPLOAD_TYPE_MAP: Record<string, "image" | "audio"> = {};
for (const t of ALLOWED_IMAGE_TYPES) UPLOAD_TYPE_MAP[t] = "image";
for (const t of ALLOWED_AUDIO_TYPES) UPLOAD_TYPE_MAP[t] = "audio";

// ─── Rate Limiting ─────────────────────────────────────────

/** Rate limit windows: [duration in seconds, max requests per window] */
const RATE_LIMIT_WINDOWS: [number, number][] = [
  [30, 8],   // 8 messages per 30 seconds
  [60, 15],  // 15 messages per minute
  [3600, 60], // 60 messages per hour
];

/** Maximum age of a rate limit row before cleanup (seconds). */
const RATE_LIMIT_MAX_AGE_SEC = 3600; // 1 hour

/**
 * Check and increment per-user rate limits. Throws if any window is exceeded.
 * Uses atomic upsert via the Convex database to prevent race conditions.
 */
async function checkRateLimit(
  ctx: { db: { query: Function; insert: Function; patch: Function; get: Function }; scheduler?: unknown },
  userId: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000); // seconds

  for (const [windowSec, maxCount] of RATE_LIMIT_WINDOWS) {
    const bucketStart = Math.floor(now / windowSec) * windowSec;
    const windowKey = `${windowSec}s:${bucketStart}`;

    // Look up existing counter for this user + window
    const existing = await (ctx.db as any)
      .query("rateLimits")
      .withIndex("by_user_window", (q: any) =>
        q.eq("userId", userId).eq("window", windowKey),
      )
      .first();

    if (existing) {
      const newCount = existing.count + 1;
      if (newCount > maxCount) {
        throw new Error(`Rate limit exceeded. Please wait before sending another message.`);
      }
      await (ctx.db as any).patch(existing._id, { count: newCount });
    } else {
      // First message in this window — insert new counter
      await (ctx.db as any).insert("rateLimits", {
        userId,
        window: windowKey,
        count: 1,
      });
    }
  }
}

// ─── MechanicAI System Prompt ─────────────────────────────────

const SYSTEM_PROMPT = `You are MechanicAI, an expert automotive diagnostic and repair intelligence system.

Your primary rule is: If you cannot verify it with evidence, you must never present it as fact.

Core Principles:
- Never invent information. Never guess. Never hallucinate.
- Never fabricate specifications, procedures, torque values, wiring diagrams, recalls, or repair steps.
- Clearly distinguish: Verified Fact, Strong Evidence, Professional Inference, Unknown.

Evidence Hierarchy (Highest to Lowest):
1. OEM service manuals. 2. Manufacturer TSBs. 3. OEM wiring diagrams.
4. OEM parts catalogs. 5. Live OBD-II and manufacturer diagnostic data.
6. Direct visual evidence (including uploaded images). 7. Sensor readings and scan tool data.
8. Industry standards (SAE, ISO, ASE). 9. Peer-reviewed engineering literature.
10. Clearly identified expert opinion.

When analyzing uploaded images: identify components, detect fluid leaks, cracks, corrosion,
loose/missing hardware, damaged wiring, abnormal tire wear, brake wear, suspension damage,
and collision damage. If image quality is insufficient, state that clearly instead of guessing.

When the user uploads audio with a Whisper transcript: use the transcript text as direct evidence
of the audio content. Analyze for possible rod knock, bearing noise, belt squeal, vacuum leaks,
exhaust leaks, brake squeal, wheel bearing hum, misfires, or timing chain noise.
If the transcript describes engine sounds, treat it as user-described audio evidence.

Diagnostic Workflow:
1. Gather evidence. 2. Validate evidence quality. 3. Identify missing information.
4. Generate multiple possible causes. 5. Rank causes by probability.
6. Explain why each cause is likely or unlikely.
7. Recommend the least expensive, least invasive diagnostic test first.
8. Update conclusions only when new evidence is available.

Confidence Rules:
- Every conclusion must include a confidence percentage.
- Never report 100% certainty unless directly confirmed by objective evidence.

Safety Rules: Immediately flag brake failures, steering failures, fuel leaks,
high-voltage hazards, airbag systems, fire risks, structural damage.

Golden Rule: If you cannot see it, measure it, verify it, or support it with
authoritative evidence, say "I don't know" and request more information.

OUTPUT: Valid JSON only, no other text. Structure:
{
  "content": "diagnostic response with **bold** for key terms",
  "evidence": {
    "level": "verified_fact|strong_evidence|professional_inference|unknown",
    "sources": [{"type": "obdii|oem_manual|tsb|industry_standard|visual|audio|expert_opinion", "reference": "source"}],
    "confidence": 0-100,
    "missingEvidence": ["..."],
    "alternativeExplanations": ["..."],
    "nextStep": "recommended next step",
    "safetyFlags": ["safety warnings or empty array"]
  }
}`;

// ─── Types ─────────────────────────────────────────────────────

type EvidenceLevelType = "verified_fact" | "strong_evidence" | "professional_inference" | "unknown";

interface DiagnosticResponse {
  content: string;
  evidence: {
    level: EvidenceLevelType;
    sources: { type: string; reference: string }[];
    confidence: number;
    missingEvidence: string[];
    alternativeExplanations: string[];
    nextStep: string;
    safetyFlags: string[];
  };
}

// ─── Helpers ───────────────────────────────────────────────────

/** Insert an audit log entry (fire-and-forget — failure is non-fatal). */
async function auditLog(
  ctx: { db: any },
  userId: string,
  action: "session_create" | "session_delete" | "message_send",
  targetId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await ctx.db.insert("auditLogs", {
      userId,
      action,
      targetId,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      timestamp: Date.now(),
    });
  } catch {
    // Audit logging is non-fatal — don't fail the user's request
  }
}

/** Strip HTML tags and script-adjacent content to prevent XSS. */
function sanitizeText(text: string): string {
  return text
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

/** Clamp a number between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Validate and sanitize the AI-parsed diagnostic response. */
function sanitizeDiagnosis(raw: DiagnosticResponse): DiagnosticResponse {
  return {
    content: sanitizeText(raw.content).slice(0, 4000),
    evidence: {
      level: (["verified_fact", "strong_evidence", "professional_inference", "unknown"].includes(raw.evidence.level)
        ? raw.evidence.level
        : "unknown") as EvidenceLevelType,
      sources: (raw.evidence.sources || []).slice(0, 10).map((s) => ({
        type: sanitizeText(s.type || "").slice(0, 50),
        reference: sanitizeText(s.reference || "").slice(0, 200),
      })),
      confidence: clamp(Math.round(raw.evidence.confidence ?? 50), 0, 100),
      missingEvidence: (raw.evidence.missingEvidence || []).slice(0, 10).map((m) => sanitizeText(m).slice(0, 200)),
      alternativeExplanations: (raw.evidence.alternativeExplanations || []).slice(0, 8).map((a) => sanitizeText(a).slice(0, 200)),
      nextStep: sanitizeText(raw.evidence.nextStep || "").slice(0, 500),
      safetyFlags: (raw.evidence.safetyFlags || []).slice(0, 5).map((f) => sanitizeText(f).slice(0, 200)),
    },
  };
}

// ─── Queries ────────────────────────────────────────────────────

export const listSessions = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    const sessions = await ctx.db
      .query("diagnosticSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
    return sessions;
  },
});

export const getSession = query({
  args: { sessionId: v.id("diagnosticSessions") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) return null;
    const messages = await ctx.db
      .query("diagnosticMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
    return { ...session, messages };
  },
});

// ─── Mutations ──────────────────────────────────────────────────

export const createSession = mutation({
  args: {
    title: v.string(),
    vehicleInfo: v.optional(
      v.object({
        make: v.optional(v.string()),
        model: v.optional(v.string()),
        year: v.optional(v.number()),
        vin: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Sanitize inputs
    const title = sanitizeText(args.title).slice(0, 200);
    const vehicleInfo = args.vehicleInfo
      ? {
          make: args.vehicleInfo.make ? sanitizeText(args.vehicleInfo.make).slice(0, 50) : undefined,
          model: args.vehicleInfo.model ? sanitizeText(args.vehicleInfo.model).slice(0, 50) : undefined,
          year: args.vehicleInfo.year ? clamp(args.vehicleInfo.year, 1900, 2100) : undefined,
          vin: args.vehicleInfo.vin ? sanitizeText(args.vehicleInfo.vin).slice(0, 17).toUpperCase() : undefined,
        }
      : undefined;

    const now = Date.now();
    const sessionId = await ctx.db.insert("diagnosticSessions", {
      userId: user._id,
      title,
      vehicleInfo,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    // Audit log
    await auditLog(ctx, user._id, "session_create", sessionId, { title });

    return sessionId;
  },
});

export const deleteSession = mutation({
  args: { sessionId: v.id("diagnosticSessions") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) throw new Error("Not found");

    // Collect all messages and their storage references
    const messages = await ctx.db
      .query("diagnosticMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Delete storage files associated with attachments
    const storageIds: string[] = [];
    for (const msg of messages) {
      if (msg.attachments) {
        for (const att of msg.attachments) {
          if (att.storageId) storageIds.push(att.storageId);
        }
      }
    }
    for (const storageId of storageIds) {
      try {
        await ctx.storage.delete(storageId);
      } catch {
        // Storage file may already be deleted — ignore
      }
    }

    // Delete messages and session
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    await ctx.db.delete(args.sessionId);

    // Audit log
    await auditLog(ctx, user._id, "session_delete", args.sessionId, {
      messageCount: messages.length,
    });
  },
});

/** Generate an upload URL for image or audio files with type validation. */
export const generateUploadUrl = mutation({
  args: {
    contentType: v.string(),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Validate content type
    const sanitizedType = args.contentType.toLowerCase().trim();
    if (!UPLOAD_TYPE_MAP[sanitizedType]) {
      throw new Error("Invalid file type. Only JPEG, PNG, WebP, GIF images and WebM, MP3, MP4, WAV, OGG, FLAC audio are allowed.");
    }

    const url = await ctx.storage.generateUploadUrl();
    return { uploadUrl: url };
  },
});

// ─── Whisper Audio Transcription ────────────────────────────

async function transcribeAudio(
  fetchFn: typeof globalThis.fetch,
  apiKey: string,
  audioBuffer: ArrayBuffer,
  fileName: string,
): Promise<string> {
  // Enforce max audio size
  if (audioBuffer.byteLength > MAX_AUDIO_SIZE_BYTES) {
    console.warn(`Audio file "${fileName}" exceeds 25MB limit (${(audioBuffer.byteLength / 1024 / 1024).toFixed(1)}MB)`);
    return "";
  }

  // Determine MIME type from file extension
  const ext = fileName.split(".").pop()?.toLowerCase() || "webm";
  const mimeMap: Record<string, string> = {
    webm: "audio/webm",
    mp3: "audio/mpeg",
    mp4: "audio/mp4",
    m4a: "audio/mp4",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac",
  };
  const mimeType = mimeMap[ext] || "audio/webm";

  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: mimeType }), fileName);
  formData.append("model", "whisper-1");
  formData.append("response_format", "json");
  // Whisper prompt: bias toward automotive vocabulary
  formData.append("prompt", "engine knock belt squeal brake grinding misfire ticking tapping rattling exhaust leak wheel bearing hum vacuum leak");

  const response = await fetchFn("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    console.error(`Whisper API returned ${response.status}`);
    return "";
  }

  const data = await response.json();
  return sanitizeText(data.text || "").slice(0, 2000);
}

// ─── Simulated diagnostic engine (fallback) ────────────────────

function generateSimulatedDiagnosis(
  userMessage: string,
  imageCount = 0,
  audioCount = 0,
  transcripts: string[] = [],
): DiagnosticResponse {
  const lower = userMessage.toLowerCase();
  const safetyFlags: string[] = [];

  // Combine user message with transcripts for pattern matching
  const combinedText = lower + " " + transcripts.join(" ").toLowerCase();

  if (combinedText.includes("brake") || combinedText.includes("no brakes") || combinedText.includes("can't stop"))
    safetyFlags.push("Brake system failure suspected — do NOT drive the vehicle");
  if (combinedText.includes("steering") || combinedText.includes("can't steer"))
    safetyFlags.push("Steering system issue — vehicle may be unsafe to operate");
  if (combinedText.includes("fuel leak") || combinedText.includes("smell gas") || combinedText.includes("gasoline"))
    safetyFlags.push("Possible fuel leak — fire hazard, inspect immediately");
  if (combinedText.includes("airbag") || combinedText.includes("srs"))
    safetyFlags.push("Airbag/SRS system — requires professional service");

  const codeMatch = combinedText.match(/p0?(\d{4})/i);
  if (codeMatch) {
    const code = `P${codeMatch[1]}`;
    return {
      content: `OBD-II code **${code}** is a valid diagnostic trouble code per SAE J2012. Without additional context (vehicle make/model/year, freeze frame data, and detailed symptoms), I can confirm this DTC exists in the OBD-II standard but need more information to provide a specific evidence-based diagnosis.\n\nPlease provide your vehicle's year, make, and model, and describe the symptoms you're experiencing.`,
      evidence: {
        level: "verified_fact",
        sources: [{ type: "obdii", reference: `OBD-II DTC ${code} (SAE J2012)` }],
        confidence: 72,
        missingEvidence: ["Vehicle make/model/year", "Freeze frame data", "Detailed symptom description"],
        alternativeExplanations: ["Multiple possible causes — insufficient data to narrow down"],
        nextStep: "Provide your vehicle's year, make, and model along with a detailed description of symptoms. If available, share freeze frame data from your OBD-II scanner.",
        safetyFlags,
      },
    };
  }

  if (combinedText.includes("knock") || combinedText.includes("ticking") || combinedText.includes("tapping")) {
    return {
      content: "Engine knocking or ticking sounds can have several distinct causes. Rod knock (deep, rhythmic knock that increases with RPM) is a serious mechanical issue. Lifter tick (lighter, faster tapping from the valve cover area) is often less severe. Timing chain rattle (metallic rattle on cold start) indicates chain tensioner wear.",
      evidence: {
        level: "professional_inference",
        sources: [{ type: "expert_opinion", reference: "ASE Master Technician diagnostic guidelines" }],
        confidence: transcripts.length > 0 ? 62 : 55,
        missingEvidence: ["RPM dependency", "Cold vs hot occurrence", "Oil level and condition"],
        alternativeExplanations: ["Rod knock", "Hydraulic lifter tick", "Timing chain/tensioner rattle", "Exhaust manifold leak", "Piston slap"],
        nextStep: "Record a 15-second audio clip from under the hood at idle and at 2500 RPM. Note whether the sound changes cold vs. warm. Check oil level and condition.",
        safetyFlags,
      },
    };
  }

  if (combinedText.includes("squeal") || combinedText.includes("squeak") || combinedText.includes("belt")) {
    return {
      content: "Belt squeal is commonly caused by a worn or loose serpentine belt, a failing belt tensioner, or a seized pulley/bearing in the accessory drive system. A quick visual inspection of the belt for cracks, glazing, or fraying is the first step.",
      evidence: {
        level: "strong_evidence",
        sources: [{ type: "industry_standard", reference: "SAE J1459 Serpentine Belt Wear Guidelines" }],
        confidence: 78,
        missingEvidence: ["Visual inspection of belt condition", "Belt tension measurement", "Year/make/model for belt routing"],
        alternativeExplanations: ["Worn serpentine belt", "Failing automatic belt tensioner", "Misaligned pulley", "Contaminated belt", "Seized pulley bearing"],
        nextStep: "Visually inspect the serpentine belt for cracks, glazing, or fraying. With engine OFF, check each pulley for smooth rotation. Spray water on the belt while running — if the squeal stops momentarily, it's a belt/tension issue.",
        safetyFlags,
      },
    };
  }

  if (combinedText.includes("check engine") || combinedText.includes("cel") || combinedText.includes("engine light")) {
    return {
      content: "A check engine light (MIL) means the ECM has detected a fault and stored one or more DTCs. Without reading the codes, this is an unknown condition. The light can indicate anything from a loose gas cap to a serious engine misfire. **Do not ignore a flashing check engine light** — that indicates a catalyst-damaging misfire.",
      evidence: {
        level: "unknown",
        sources: [{ type: "industry_standard", reference: "OBD-II regulations (EPA 40 CFR 86)" }],
        confidence: 40,
        missingEvidence: ["Specific DTC(s)", "Freeze frame data", "Steady or flashing?", "Vehicle make/model/year"],
        alternativeExplanations: ["Loose gas cap", "Oxygen sensor fault", "Catalytic converter efficiency", "Engine misfire", "MAF sensor contamination"],
        nextStep: "Use an OBD-II scanner to read the stored codes. If the light is FLASHING, stop driving immediately. Provide the exact code(s) for a more specific diagnosis.",
        safetyFlags: combinedText.includes("flash") ? [...safetyFlags, "Flashing check engine light — catalyst-damaging misfire likely, do NOT continue driving"] : safetyFlags,
      },
    };
  }

  if (combinedText.includes("brake") && (combinedText.includes("grind") || combinedText.includes("squeal") || combinedText.includes("soft") || combinedText.includes("spongy"))) {
    return {
      content: "Brake symptoms require immediate attention. Brake squeal typically indicates worn pads approaching the wear indicator. Grinding means metal-on-metal contact — pads are completely worn through. A soft or spongy pedal suggests air in the hydraulic system or a fluid leak.",
      evidence: {
        level: "strong_evidence",
        sources: [{ type: "industry_standard", reference: "ASE Brake System Diagnostic Guidelines" }],
        confidence: 85,
        missingEvidence: ["Visual inspection of pad thickness", "Brake fluid level and condition", "Which wheels are affected?"],
        alternativeExplanations: ["Worn brake pads", "Air in brake lines", "Brake fluid leak", "Warped rotors"],
        nextStep: "Safely inspect brake pad thickness. Check brake fluid level in the master cylinder. If the pedal is soft, do NOT drive until the hydraulic system is inspected.",
        safetyFlags: ["BRAKE SYSTEM CONCERN — if pedal is soft/spongy or grinding is present, do NOT drive", ...safetyFlags],
      },
    };
  }

  const mediaNote =
    imageCount > 0 || audioCount > 0
      ? `\n\nI received ${imageCount > 0 ? `${imageCount} image(s)` : ""}${imageCount > 0 && audioCount > 0 ? " and " : ""}${audioCount > 0 ? `${audioCount} audio recording(s)` : ""}.${transcripts.length > 0 ? ` The audio transcript reads: "${transcripts.join(" | ")}"` : ""} To provide a more thorough evidence-based analysis, please describe what these show or contain.`
      : "";

  return {
    content: "Thank you for describing your vehicle concern. Based on what you've shared, I need more specific evidence to provide a reliable diagnosis. In the spirit of evidence-first diagnostics, I won't guess — but I can help guide you toward the right diagnostic path." + mediaNote,
    evidence: {
      level: "unknown",
      sources: [],
      confidence: 30,
      missingEvidence: ["Specific symptoms", "Vehicle make/model/year", "OBD-II codes if check engine light is on", "When did the issue start?", "Any recent repairs?"],
      alternativeExplanations: ["Insufficient data to generate differential diagnosis"],
      nextStep: "Please provide your vehicle's year, make, and model, along with a detailed description of the symptoms. If you have an OBD-II scanner, include any diagnostic trouble codes.",
      safetyFlags,
    },
  };
}

// ─── AI API call ────────────────────────────────────────────────

async function callOpenAI(
  fetchFn: typeof globalThis.fetch,
  apiKey: string,
  userMessage: string,
  history: { role: string; content: string }[],
  imageBase64s: { data: string; mimeType: string; name: string }[],
  audioNames: string[],
  transcripts: string[],
): Promise<DiagnosticResponse> {
  // Build the user message content — may include images for vision
  const userContent: any[] = [{ type: "text", text: userMessage }];

  // Add audio file notes and transcripts to text content
  if (audioNames.length > 0) {
    let audioContext = `\n\n[The user uploaded ${audioNames.length} audio file(s): ${audioNames.join(", ")}.`;
    if (transcripts.length > 0) {
      audioContext += `\n\nWhisper transcription of the audio:\n${transcripts.map((t, i) => `Audio ${i + 1}: "${t}"`).join("\n")}`;
      audioContext += "\n\nUse these transcripts as direct evidence when analyzing the user's vehicle concern. Pay close attention to any described sounds, noises, or symptoms mentioned in the transcript.]";
    } else {
      audioContext += " Analyze based on the user's description. Note that audio analysis from second-hand descriptions has inherent limitations.]";
    }
    userContent.push({ type: "text", text: audioContext });
  }

  // Add images for vision (GPT-4o-mini supports image_url)
  for (const img of imageBase64s) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${img.mimeType};base64,${img.data}`,
        detail: "auto",
      },
    });
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: userContent },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error("AI service unavailable");
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("Empty AI response");

  let parsed: any;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error("Invalid AI response format");
  }

  return sanitizeDiagnosis({
    content: parsed.content || "I was unable to generate a diagnostic response.",
    evidence: {
      level: parsed.evidence?.level || "unknown",
      sources: parsed.evidence?.sources || [],
      confidence: parsed.evidence?.confidence ?? 50,
      missingEvidence: parsed.evidence?.missingEvidence || [],
      alternativeExplanations: parsed.evidence?.alternativeExplanations || [],
      nextStep: parsed.evidence?.nextStep || "Please provide more information.",
      safetyFlags: parsed.evidence?.safetyFlags || [],
    },
  });
}

// ─── Send Message (with AI + Whisper integration) ────────────

export const sendMessage = mutation({
  args: {
    sessionId: v.id("diagnosticSessions"),
    content: v.string(),
    attachments: v.optional(
      v.array(
        v.object({
          type: v.union(v.literal("image"), v.literal("audio"), v.literal("video"), v.literal("document")),
          name: v.string(),
          storageId: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) throw new Error("Session not found");

    // ─── Rate limit check ────────────────────────────────────
    await checkRateLimit(ctx, user._id);

    // ─── Validate inputs ────────────────────────────────────
    const sanitizedContent = sanitizeText(args.content).slice(0, MAX_CONTENT_LENGTH);
    const attachments = args.attachments?.slice(0, MAX_ATTACHMENTS)?.map((a) => ({
      ...a,
      name: sanitizeText(a.name).slice(0, 255),
    }));

    if (!sanitizedContent && (!attachments || attachments.length === 0)) {
      throw new Error("Message cannot be empty");
    }

    const now = Date.now();
    const apiKey = process.env.OPENAI_API_KEY;

    // Insert user message first (without transcripts yet — will patch after transcription)
    const messageId = await ctx.db.insert("diagnosticMessages", {
      sessionId: args.sessionId,
      role: "user",
      content: sanitizedContent,
      attachments: attachments,
      createdAt: now,
    });

    // ─── Transcribe audio attachments via Whisper ──────────────
    const transcripts: string[] = [];
    let attachmentsWithTranscripts = attachments;

    if (apiKey && attachments) {
      const audioAttachments = attachments.filter((a) => a.type === "audio" && a.storageId);
      if (audioAttachments.length > 0) {
        // Clone attachments and widen types — `transcript` is added server-side
        const updatedAttachments = attachments.map((a) => ({ ...a } as Record<string, unknown>));

        for (let i = 0; i < updatedAttachments.length; i++) {
          const att = updatedAttachments[i];
          if (att.type !== "audio" || !att.storageId) continue;

          try {
            // Fetch the audio file from Convex storage
            const fileUrl = await ctx.storage.getUrl(att.storageId as string);
            if (fileUrl) {
              const audioResponse = await fetch(fileUrl);
              if (audioResponse.ok) {
                const audioBuffer = await audioResponse.arrayBuffer();
                const transcript = await transcribeAudio(fetch, apiKey, audioBuffer, att.name as string);
                if (transcript) {
                  transcripts.push(transcript);
                  updatedAttachments[i] = { ...att, transcript };
                }
              }
            }
          } catch (err) {
            console.error(`Failed to transcribe audio:`, (err as Error).message);
            // Continue with other audio files — don't fail the whole message
          }
        }

        attachmentsWithTranscripts = updatedAttachments as typeof attachments;

        // Patch the user message with transcripts stored in attachments
        await ctx.db.patch(messageId, {
          attachments: attachmentsWithTranscripts,
        });
      }
    } else {
      // No API key: just collect audio names (no transcription)
      if (attachments) {
        for (const att of attachments) {
          if (att.type === "audio") {
            transcripts.push(""); // placeholder
          }
        }
      }
    }

    // ─── Build conversation history ──────────────────────────
    const existingMessages = await ctx.db
      .query("diagnosticMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();

    const history = existingMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    // ─── Extract image attachments for vision ─────────────────
    let diagnosis: DiagnosticResponse;
    const imageBase64s: { data: string; mimeType: string; name: string }[] = [];
    const audioNames: string[] = [];

    if (attachments) {
      for (const att of attachments) {
        if (att.type === "audio") {
          audioNames.push(att.name);
        }
        if (att.type === "image" && att.storageId) {
          try {
            const fileUrl = await ctx.storage.getUrl(att.storageId);
            if (fileUrl) {
              const fileResponse = await fetch(fileUrl);
              if (fileResponse.ok) {
                const contentLength = parseInt(fileResponse.headers.get("content-length") || "0", 10);
                if (contentLength > MAX_IMAGE_SIZE_BYTES) continue;

                const arrayBuffer = await fileResponse.arrayBuffer();
                if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) continue;

                const base64 = btoa(
                  String.fromCharCode(...new Uint8Array(arrayBuffer)),
                );
                const mimeType = fileResponse.headers.get("content-type") || "image/jpeg";
                imageBase64s.push({ data: base64, mimeType, name: att.name });
              }
            }
          } catch (err) {
            console.error("Failed to fetch image:", (err as Error).message);
          }
        }
      }
    }

    // ─── Call AI (OpenAI with transcripts, or simulated fallback) ──
    if (apiKey) {
      try {
        diagnosis = await callOpenAI(fetch, apiKey, sanitizedContent, history, imageBase64s, audioNames, transcripts);
      } catch (error) {
        console.error("AI call failed, using simulated engine:", (error as Error).message);
        diagnosis = sanitizeDiagnosis(
          generateSimulatedDiagnosis(sanitizedContent, imageBase64s.length, audioNames.length, transcripts),
        );
      }
    } else {
      diagnosis = sanitizeDiagnosis(
        generateSimulatedDiagnosis(sanitizedContent, imageBase64s.length, audioNames.length, transcripts),
      );
    }

    // ─── Insert assistant message ─────────────────────────────
    await ctx.db.insert("diagnosticMessages", {
      sessionId: args.sessionId,
      role: "assistant",
      content: diagnosis.content,
      evidence: {
        level: diagnosis.evidence.level,
        sources: diagnosis.evidence.sources,
        confidence: diagnosis.evidence.confidence,
        missingEvidence: diagnosis.evidence.missingEvidence,
        alternativeExplanations: diagnosis.evidence.alternativeExplanations,
        nextStep: diagnosis.evidence.nextStep,
        safetyFlags: diagnosis.evidence.safetyFlags,
      },
      createdAt: now + 1,
    });

    // ─── Update session ───────────────────────────────────────
    await ctx.db.patch(args.sessionId, {
      updatedAt: now,
      confidenceSummary: diagnosis.evidence.confidence,
    });

    // Audit log
    await auditLog(ctx, user._id, "message_send", args.sessionId, {
      contentLength: sanitizedContent.length,
      attachmentCount: attachments?.length ?? 0,
      hasImage: imageBase64s.length > 0,
      hasAudio: audioNames.length > 0,
      confidence: diagnosis.evidence.confidence,
    });

    return { confidence: diagnosis.evidence.confidence };
  },
});

// ─── Scheduled cleanup of expired rate limits ──────────────

export const cleanupRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Math.floor(Date.now() / 1000) - RATE_LIMIT_MAX_AGE_SEC;

    // Fetch all rate limit rows
    const allRows = await ctx.db.query("rateLimits").collect();

    let deleted = 0;
    for (const row of allRows) {
      // Parse the window key: "30s:1719600000" → extract timestamp after the colon
      const idx = row.window.lastIndexOf(":");
      if (idx === -1) continue;
      const timestamp = parseInt(row.window.slice(idx + 1), 10);
      if (isNaN(timestamp) || timestamp < cutoff) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }

    return { deleted };
  },
});
