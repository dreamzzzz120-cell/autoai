import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Camera,
  Car,
  FileCheck,
  ImageIcon,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Microscope,
  Music,
  Plus,
  Search,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

// ─── Security Constants ────────────────────────────────────

const MAX_CONTENT_LENGTH = 10_000;
const MAX_ATTACHMENTS = 5;
const MAX_AUDIO_SIZE_MB = 25;
const MAX_IMAGE_SIZE_MB = 10;

/** Strip HTML tags from text for safe rendering. */
function sanitizeText(text: string): string {
  return text
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

// ─── Evidence Level Config ───────────────────────────────────

const evidenceConfig: Record<string, { label: string; className: string; icon: typeof FileCheck }> = {
  verified_fact: { label: "Verified Fact", className: "evidence-verified", icon: FileCheck },
  strong_evidence: { label: "Strong Evidence", className: "evidence-strong", icon: Search },
  professional_inference: { label: "Professional Inference", className: "evidence-inference", icon: Brain },
  unknown: { label: "Unknown", className: "evidence-unknown", icon: Microscope },
};

const sourceTypeLabels: Record<string, string> = {
  obdii: "OBD-II",
  oem_manual: "OEM Manual",
  tsb: "TSB",
  industry_standard: "Industry Standard",
  visual: "Visual",
  audio: "Audio",
  expert_opinion: "Expert Opinion",
};

// ─── Sub-components ──────────────────────────────────────────

function EmptyState({ onCreateSession, isCreating }: { onCreateSession: () => void; isCreating: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        <div className="size-20 rounded-2xl glass-heavy flex items-center justify-center mx-auto mb-6">
          <Wrench className="size-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">
          Mechanic<span className="text-primary">AI</span> Diagnostics
        </h2>
        <p className="text-muted-foreground mb-6">
          Evidence-first automotive diagnostics. Describe your vehicle issue,
          share OBD-II codes, upload images or audio — and get a transparent,
          confidence-rated diagnosis.
        </p>
        <Button
          size="lg"
          className="rounded-2xl shadow-lg shadow-primary/20"
          onClick={onCreateSession}
          disabled={isCreating}
        >
          {isCreating ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Plus className="size-4 mr-2" />
          )}
          New Diagnosis
        </Button>
        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          {[
            { icon: Car, label: "OBD-II Codes" },
            { icon: Camera, label: "Image Analysis" },
            { icon: Mic, label: "Audio Analysis" },
          ].map((item) => (
            <div key={item.label} className="glass-subtle rounded-xl p-3">
              <item.icon className="size-4 text-primary mx-auto mb-1" />
              <span className="text-[10px] text-muted-foreground font-medium">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/** Display image/audio attachments in user messages */
function AttachmentPreview({ attachment }: { attachment: { type: string; name: string; storageId?: string; transcript?: string } }) {
  const safeName = useMemo(() => sanitizeText(attachment.name), [attachment.name]);
  const safeTranscript = useMemo(
    () => (attachment.transcript ? sanitizeText(attachment.transcript) : undefined),
    [attachment.transcript],
  );
  if (attachment.type === "image" && attachment.storageId) {
    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-border/30 max-w-[200px]">
        <img
          src={attachment.storageId}
          alt={attachment.name}
          className="w-full h-auto object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <p className="text-[10px] text-muted-foreground px-2 py-1 truncate">{safeName}</p>
      </div>
    );
  }
  if (attachment.type === "audio") {
    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2 glass-subtle rounded-lg px-3 py-2 max-w-[220px]">
          <Music className="size-4 text-primary shrink-0" />
          <p className="text-[10px] text-muted-foreground truncate">{safeName}</p>
        </div>
        {safeTranscript && (
          <div className="glass-subtle rounded-lg px-3 py-2 max-w-[280px] border-l-2 border-primary/40">
            <p className="text-[9px] font-semibold text-primary uppercase tracking-wide mb-1">Whisper Transcript</p>
            <p className="text-[11px] text-foreground/80 leading-relaxed italic">
              &ldquo;{safeTranscript}&rdquo;
            </p>
          </div>
        )}
      </div>
    );
  }
  return null;
}

function MessageBubble({ msg }: { msg: any }) {
  const isUser = msg.role === "user";
  const evidence = msg.evidence;
  const eConfig = evidence ? evidenceConfig[evidence.level] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      <div className={`max-w-[85%] ${isUser ? "order-1" : "order-1"}`}>
        {/* User message */}
        {isUser && (
          <div className="glass rounded-2xl rounded-br-md px-5 py-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            {msg.attachments?.map((att: any, i: number) => (
              <AttachmentPreview key={i} attachment={att} />
            ))}
          </div>
        )}

        {/* Assistant message */}
        {!isUser && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="size-6 rounded-lg glass-heavy flex items-center justify-center">
                <Brain className="size-3.5 text-primary" />
              </div>
              <span className="text-xs font-semibold text-foreground">
                MechanicAI
              </span>
              {eConfig && (
                <Badge
                  variant="secondary"
                  className={`${eConfig.className} text-[10px] px-2 py-0 h-5`}
                >
                  {eConfig.label}
                </Badge>
              )}
              {evidence?.confidence != null && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {evidence.confidence}% confidence
                </span>
              )}
            </div>

            <div className="glass-heavy rounded-2xl rounded-bl-md px-5 py-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap [&>strong]:font-semibold [&>strong]:text-foreground">
                {msg.content.split("**").map((part: string, i: number) =>
                  i % 2 === 1 ? (
                    <strong key={i}>{part}</strong>
                  ) : (
                    part
                  ),
                )}
              </p>
            </div>

            {/* Evidence metadata */}
            {evidence && (
              <div className="glass-subtle rounded-xl p-3 space-y-2 text-xs">
                {evidence.sources && evidence.sources.length > 0 && (
                  <div>
                    <span className="font-semibold text-foreground">Sources:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {evidence.sources.map((s: any, i: number) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/50 border border-border/50 text-[10px]"
                        >
                          <FileCheck className="size-2.5 text-primary" />
                          {sourceTypeLabels[s.type] || s.type}: {s.reference}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {evidence.safetyFlags && evidence.safetyFlags.length > 0 && (
                  <div className="p-2 rounded-lg bg-red-50/50 border border-red-200/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="size-3 text-destructive" />
                      <span className="font-semibold text-destructive">Safety Warning</span>
                    </div>
                    {evidence.safetyFlags.map((flag: string, i: number) => (
                      <p key={i} className="text-[11px] text-red-700 leading-relaxed">
                        • {flag}
                      </p>
                    ))}
                  </div>
                )}

                {evidence.missingEvidence && evidence.missingEvidence.length > 0 && (
                  <div>
                    <span className="font-semibold text-muted-foreground">Missing evidence:</span>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {evidence.missingEvidence.map((item: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-primary mt-0.5">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {evidence.alternativeExplanations && evidence.alternativeExplanations.length > 0 && (
                  <div>
                    <span className="font-semibold text-muted-foreground">Alternative explanations:</span>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {evidence.alternativeExplanations.map((item: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-primary mt-0.5">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {evidence.nextStep && (
                  <div className="p-2 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="size-3 text-primary" />
                      <span className="font-semibold text-primary">Recommended next step</span>
                    </div>
                    <p className="text-[11px] text-foreground/80 leading-relaxed">
                      {evidence.nextStep}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Types for media uploads ─────────────────────────────────

interface MediaFile {
  file: File;
  id: string;
  type: "image" | "audio";
  previewUrl?: string;
}

function ChatArea({
  session,
  onSendMessage,
  isSending,
}: {
  session: any;
  onSendMessage: (
    content: string,
    attachments: { type: "image" | "audio"; name: string; storageId: string }[],
  ) => void;
  isSending: boolean;
}) {
  const [input, setInput] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.diagnostics.generateUploadUrl);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.messages, mediaFiles]);

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      mediaFiles.forEach((mf) => {
        if (mf.previewUrl) URL.revokeObjectURL(mf.previewUrl);
      });
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "audio") => {
    const files = e.target.files;
    if (!files) return;

    const maxSize = type === "audio" ? MAX_AUDIO_SIZE_MB * 1024 * 1024 : MAX_IMAGE_SIZE_MB * 1024 * 1024;
    const label = type === "audio" ? "Audio" : "Image";

    let added = 0;
    const newFiles: MediaFile[] = [];
    for (let i = 0; i < files.length && mediaFiles.length + newFiles.length < MAX_ATTACHMENTS; i++) {
      const file = files[i];

      // Validate file size
      if (file.size > maxSize) {
        console.warn(`${label} file "${file.name}" exceeds ${type === "audio" ? MAX_AUDIO_SIZE_MB : MAX_IMAGE_SIZE_MB}MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        continue;
      }

      // Validate MIME type
      if (type === "image" && !file.type.startsWith("image/")) continue;
      if (type === "audio" && !file.type.startsWith("audio/")) continue;

      const mf: MediaFile = {
        file,
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        type,
        previewUrl: type === "image" ? URL.createObjectURL(file) : undefined,
      };
      newFiles.push(mf);
      added++;
    }

    if (newFiles.length > 0) {
      setMediaFiles((prev) => [...prev, ...newFiles]);
    }
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const removeMedia = (id: string) => {
    setMediaFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasText = input.trim().length > 0;
    const hasMedia = mediaFiles.length > 0;
    if ((!hasText && !hasMedia) || isSending) return;

    // Upload media files to Convex storage
    const uploadedAttachments: { type: "image" | "audio"; name: string; storageId: string }[] = [];

    for (const mf of mediaFiles) {
      try {
        const { uploadUrl } = await generateUploadUrl({
          contentType: mf.file.type,
          fileName: mf.file.name,
        });

        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": mf.file.type },
          body: mf.file,
        });

        if (!uploadResponse.ok) {
          console.error("Upload failed:", uploadResponse.status);
          continue;
        }

        // The storage ID is returned in the response
        const { storageId } = await uploadResponse.json();
        uploadedAttachments.push({
          type: mf.type,
          name: mf.file.name,
          storageId,
        });
      } catch (err) {
        console.error("Failed to upload file:", err);
      }
    }

    // Clean up previews
    mediaFiles.forEach((mf) => {
      if (mf.previewUrl) URL.revokeObjectURL(mf.previewUrl);
    });
    setMediaFiles([]);

    onSendMessage(input.trim() || " ", uploadedAttachments);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Session header */}
      <div className="glass-subtle border-b border-border/40 px-6 py-3 flex items-center gap-3 shrink-0">
        <div className="size-8 rounded-lg glass flex items-center justify-center">
          <MessageSquare className="size-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold truncate">{session.title}</h2>
          {session.vehicleInfo && (
            <p className="text-[11px] text-muted-foreground truncate">
              {[session.vehicleInfo.year, session.vehicleInfo.make, session.vehicleInfo.model]
                .filter(Boolean)
                .join(" ") || "No vehicle info"}
            </p>
          )}
        </div>
        {session.confidenceSummary != null && (
          <Badge variant="secondary" className="ml-auto text-[10px] px-2 py-0 h-5">
            Latest: {session.confidenceSummary}% confidence
          </Badge>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef}>
        <div className="max-w-3xl mx-auto">
          {session.messages?.length === 0 && (
            <div className="text-center py-12">
              <Sparkles className="size-8 text-primary/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Describe your vehicle issue or upload images/audio to begin the diagnostic process.
              </p>
            </div>
          )}
          {session.messages?.map((msg: any) => (
            <MessageBubble key={msg._id} msg={msg} />
          ))}
          {isSending && (
            <div className="flex justify-start mb-4">
              <div className="glass rounded-2xl rounded-bl-md px-5 py-3 flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Analyzing evidence...
                </span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Media preview area */}
      <AnimatePresence>
        {mediaFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-border/40 px-4 py-3"
          >
            <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
              {mediaFiles.map((mf) => (
                <motion.div
                  key={mf.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="relative group"
                >
                  {mf.type === "image" && mf.previewUrl ? (
                    <div className="relative">
                      <img
                        src={mf.previewUrl}
                        alt={mf.file.name}
                        className="h-20 w-20 object-cover rounded-lg border border-border/40"
                      />
                      <button
                        type="button"
                        onClick={() => removeMedia(mf.id)}
                        className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-20 w-32 glass-subtle rounded-lg border border-border/40 flex items-center justify-center gap-1.5 relative">
                      <Music className="size-4 text-primary" />
                      <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                        {mf.file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMedia(mf.id)}
                        className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-[9px] text-muted-foreground text-center mt-0.5 truncate max-w-[80px]">
                    {mf.type === "image" ? "📷 Image" : "🎤 Audio"}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="border-t border-border/40 p-4 shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="glass rounded-2xl flex items-center gap-2 px-4 py-2 focus-within:ring-2 focus-within:ring-ring/50 transition-all duration-200">
            {/* Image upload button */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e, "image")}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-xl shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isSending}
                >
                  <Camera className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload images</TooltipContent>
            </Tooltip>

            {/* Audio upload button */}
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e, "audio")}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-xl shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => audioInputRef.current?.click()}
                  disabled={isSending}
                >
                  <Mic className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload audio</TooltipContent>
            </Tooltip>

            {/* Text input */}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_CONTENT_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder="Describe symptoms, share OBD-II codes, or upload images/audio..."
              maxLength={MAX_CONTENT_LENGTH}
              className="flex-1 bg-transparent border-none outline-none text-sm py-2 text-foreground placeholder:text-muted-foreground/60"
              disabled={isSending}
            />

            {/* Send button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="submit"
                  size="icon"
                  className="size-9 rounded-xl shrink-0"
                  disabled={(!input.trim() && mediaFiles.length === 0) || isSending}
                >
                  {isSending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send message</TooltipContent>
            </Tooltip>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Upload images of engine components, fluid leaks, or damage. Upload audio of engine noises, knocks, or squeals.
            {mediaFiles.length > 0 && ` ${mediaFiles.length} file(s) attached.`}
          </p>
        </form>
      </div>
    </div>
  );
}

// ─── Sidebar (unchanged) ──────────────────────────────────────

function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  isCreating,
  sidebarOpen,
  setSidebarOpen,
}: {
  sessions: any[] | undefined;
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  isCreating: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-72 flex flex-col
          glass-heavy border-r border-border/40
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl glass flex items-center justify-center">
              <Wrench className="size-4 text-primary" />
            </div>
            <span className="font-bold text-sm">
              Mechanic<span className="text-primary">AI</span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="px-3 pb-2">
          <Button
            className="w-full rounded-xl gap-2 shadow-lg shadow-primary/15"
            onClick={onCreateSession}
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            New Diagnosis
          </Button>
        </div>

        <Separator className="mx-3 bg-border/40" />

        <ScrollArea className="flex-1 glass-scroll px-2 py-2">
          {sessions === undefined && (
            <div className="space-y-3 p-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          )}
          {sessions?.length === 0 && (
            <div className="text-center py-8">
              <MessageSquare className="size-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No sessions yet</p>
            </div>
          )}
          <AnimatePresence>
            {sessions?.map((session) => (
              <motion.div
                key={session._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="mb-1"
              >
                <button
                  onClick={() => {
                    onSelectSession(session._id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 group flex items-start gap-3 ${
                    activeSessionId === session._id
                      ? "glass shadow-sm"
                      : "hover:glass-subtle"
                  }`}
                >
                  <div className="size-8 rounded-lg glass-subtle flex items-center justify-center shrink-0 mt-0.5">
                    <Car className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{session.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(session.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      {session.confidenceSummary != null &&
                        ` · ${session.confidenceSummary}%`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session._id);
                    }}
                  >
                    <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                  </Button>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </ScrollArea>

        <div className="p-3 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive rounded-xl"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          >
            <LogOut className="size-4" />
            Sign Out
          </Button>
        </div>
      </aside>
    </>
  );
}

// ─── Main Dashboard Component ─────────────────────────────────

type AttachmentMeta = { type: "image" | "audio"; name: string; storageId: string };

export default function Dashboard() {
  const [activeSessionId, setActiveSessionId] = useState<Id<"diagnosticSessions"> | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sessions = useQuery(api.diagnostics.listSessions);
  const activeSession = useQuery(
    api.diagnostics.getSession,
    activeSessionId ? { sessionId: activeSessionId } : "skip",
  );

  const createSession = useMutation(api.diagnostics.createSession);
  const deleteSession = useMutation(api.diagnostics.deleteSession);
  const sendMessage = useMutation(api.diagnostics.sendMessage);

  useEffect(() => {
    if (!activeSessionId && sessions && sessions.length > 0) {
      setActiveSessionId(sessions[0]._id);
    }
  }, [sessions, activeSessionId]);

  const handleCreateSession = async () => {
    try {
      const id = await createSession({
        title: `Diagnosis ${new Date().toLocaleDateString()}`,
      });
      setActiveSessionId(id);
    } catch (e) {
      console.error("Failed to create session:", e);
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession({ sessionId: id as Id<"diagnosticSessions"> });
      if (activeSessionId === id) {
        setActiveSessionId(null);
      }
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  };

  const handleSendMessage = async (content: string, attachments: AttachmentMeta[]) => {
    if (!activeSessionId) return;
    setIsSending(true);
    try {
      await sendMessage({
        sessionId: activeSessionId,
        content,
        attachments: attachments.length > 0
          ? attachments.map((a) => ({
              type: a.type,
              name: a.name,
              storageId: a.storageId,
            }))
          : undefined,
      });
    } catch (e) {
      console.error("Failed to send message:", e);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId?.toString() ?? null}
        onSelectSession={(id) => setActiveSessionId(id as Id<"diagnosticSessions">)}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
        isCreating={false}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden glass-subtle border-b border-border/40 px-4 py-2 flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-lg glass flex items-center justify-center">
              <Wrench className="size-3.5 text-primary" />
            </div>
            <span className="font-bold text-sm">
              Mechanic<span className="text-primary">AI</span>
            </span>
          </div>
        </div>

        {activeSession ? (
          <ChatArea
            session={activeSession}
            onSendMessage={handleSendMessage}
            isSending={isSending}
          />
        ) : (
          <EmptyState
            onCreateSession={handleCreateSession}
            isCreating={false}
          />
        )}
      </div>
    </div>
  );
}
