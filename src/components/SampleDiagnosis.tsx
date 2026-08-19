import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Car,
  FileCheck,
  Microscope,
  Search,
  Shield,
  Zap,
  ChevronDown,
  FileText,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  Play,
} from "lucide-react";

interface TimelineStage {
  icon: typeof FileCheck;
  label: string;
  title: string;
  detail: string;
  evidence: string;
  confidence?: number;
  badge?: { text: string; className: string };
}

const SCENARIO: TimelineStage[] = [
  {
    icon: Car,
    label: "Stage 1",
    title: "Complaint Received",
    detail:
      '"Engine runs rough on cold starts, especially in the morning. Check engine light came on yesterday. No recent repairs."\n\nVehicle: 2019 Honda Accord 1.5T, 72,400 miles.',
    evidence: "Customer description via voice input",
    badge: { text: "Voice Input", className: "evidence-verified" },
  },
  {
    icon: Search,
    label: "Stage 2",
    title: "Scan Data Analyzed",
    detail:
      "OBD-II code P0302 stored — Cylinder 2 Misfire Detected.\n\nFreeze frame data shows misfire occurring at idle (780 RPM), coolant temperature 28°C (cold start), fuel system in closed loop.",
    evidence: "OBD-II DTC P0302 (SAE J2012)",
    confidence: 30,
    badge: { text: "OBD-II", className: "evidence-verified" },
  },
  {
    icon: Microscope,
    label: "Stage 3",
    title: "Sensors Verified",
    detail:
      "O2 sensor (B1S1) voltage: 0.45V oscillating — normal.\nMAF sensor: 3.2 g/s at idle — within spec (2.8–3.5 g/s).\nLong-term fuel trim: +2.3% — normal range.\nShort-term fuel trim: +1.1% — normal.\n\nNo sensor anomalies detected.",
    evidence: "Live sensor data via OBD-II scanner",
    confidence: 45,
  },
  {
    icon: FileText,
    label: "Stage 4",
    title: "OEM Manual Consulted",
    detail:
      "Honda Service Manual (2018–2022 Accord): P0302 diagnostic procedure recommends:\n1. Inspect ignition coil connector\n2. Swap coil with known-good cylinder\n3. Check spark plug condition and gap\n4. Perform compression test if misfire persists\n\nOEM torque spec for spark plugs: 22 N·m (16 lb-ft)",
    evidence: "Honda OEM Service Manual, Section 11-4",
    confidence: 60,
    badge: { text: "OEM Manual", className: "evidence-strong" },
  },
  {
    icon: FileCheck,
    label: "Stage 5",
    title: "TSBs Checked",
    detail:
      "TSB #21-047 found: \"Cold Start Misfire DTC P0302 — Ignition Coil Intermittent Failure.\"\n\nApplicable to 2018–2022 Accord 1.5T engines. Manufacturer confirms known issue with ignition coil insulation breakdown causing intermittent misfire on cold starts. Repair: replace affected coil (P/N 30520-6A0-A01).",
    evidence: "Honda TSB #21-047 (May 2021)",
    confidence: 82,
    badge: { text: "TSB Match", className: "evidence-verified" },
  },
  {
    icon: Brain,
    label: "Stage 6",
    title: "Similar Failures Compared",
    detail:
      "Pattern analysis of 1,247 similar P0302 cases on 1.5T engines:\n- 78% resolved by ignition coil replacement\n- 14% resolved by spark plug replacement\n- 5% resolved by injector cleaning\n- 3% required further diagnosis\n\nVehicle mileage (72,400) falls within known failure window (60k–90k).",
    evidence: "ASE Master Technician pattern database",
    confidence: 88,
    badge: { text: "Pattern Match", className: "evidence-inference" },
  },
  {
    icon: Wrench,
    label: "Stage 7",
    title: "Root Cause Identified",
    detail:
      "Primary cause: Failing ignition coil on cylinder 2 (94% confidence).\n\nEvidence chain:\n✓ TSB #21-047 confirms known coil issue on this engine\n✓ P0302 is cylinder-specific (not random misfire)\n✓ Occurs only on cold starts (insulation breakdown when cool)\n✓ Mileage falls within known failure window\n✓ All sensors report normal values (no fuel/air issues)\n\nRejected causes:\n✗ Spark plugs (not in failure mileage window, would cause consistent misfire)\n✗ Fuel injector (fuel trims are normal)\n✗ Compression issue (would cause consistent misfire, not cold-start only)",
    evidence: "Multi-source correlation analysis",
    confidence: 94,
    badge: { text: "94% Confidence", className: "evidence-verified" },
  },
  {
    icon: Zap,
    label: "Stage 8",
    title: "Recommended Tests",
    detail:
      "Least invasive diagnostic test first:\n\n1. Swap ignition coil from cylinder 2 with cylinder 1\n2. Clear DTCs and start engine cold\n3. If P0301 appears (misfire follows the coil), coil is confirmed faulty\n4. If P0302 returns, perform compression test on cylinder 2\n\nSafety note: Vehicle is safe to drive but misfire should be addressed promptly to prevent catalytic converter damage.",
    evidence: "Honda diagnostic procedure + ASE best practices",
    badge: { text: "Next Step", className: "evidence-strong" },
  },
  {
    icon: Shield,
    label: "Stage 9",
    title: "Confidence Score Calculated",
    detail:
      "Final confidence: 94%\n\nWeighted evidence breakdown:\n• TSB confirmation: 35% weight\n• Known failure pattern: 25% weight\n• OBD-II data specificity: 20% weight\n• Sensor correlation: 10% weight\n• OEM manual alignment: 10% weight\n\nMissing evidence (for 100% certainty):\n• Physical coil swap test confirmation\n• Oscilloscope waveform of coil primary circuit",
    evidence: "Evidence-weighted confidence model",
    confidence: 94,
    badge: { text: "Final", className: "evidence-verified" },
  },
];

export default function SampleDiagnosis() {
  const [expandedStage, setExpandedStage] = useState<number | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const toggleStage = (idx: number) => {
    setExpandedStage(expandedStage === idx ? null : idx);
  };

  return (
    <section className="relative py-20 md:py-28 px-4" id="try-demo">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="glass-subtle mb-4 px-4 py-1.5">
            <Zap className="size-3.5 mr-1.5" />
            Interactive Demo
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            See exactly how MechanicAI
            <br />
            <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
              reaches a diagnosis
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            No black box. Every step is documented, sourced, and transparent.
            Click each stage to reveal the evidence.
          </p>
        </motion.div>

        {/* Demo card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="glass-heavy rounded-3xl overflow-hidden"
        >
          {/* Demo header */}
          <div className="glass-subtle border-b border-border/40 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-xl glass-heavy flex items-center justify-center">
                <Car className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">2019 Honda Accord 1.5T</p>
                <p className="text-[11px] text-muted-foreground">
                  Check Engine Light — P0302
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5">
              94% confidence
            </Badge>
          </div>

          {/* Timeline */}
          <div className="p-4 md:p-6">
            {!hasStarted ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <div className="size-16 rounded-2xl glass flex items-center justify-center mx-auto mb-4">
                  <Brain className="size-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Walk through a real diagnosis
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  See the 9-stage evidence timeline that turns a customer
                  complaint into a 94%-confidence diagnosis with OEM sources,
                  TSBs, sensor data, and pattern analysis.
                </p>
                <button
                  onClick={() => {
                    setHasStarted(true);
                    setExpandedStage(0);
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-medium text-sm shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all duration-300"
                >
                  <Play className="size-4" />
                  Begin Diagnosis
                </button>
              </motion.div>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[23px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-primary/40 via-blue-400/30 to-emerald-400/20" />

                <div className="space-y-2">
                  {SCENARIO.map((stage, idx) => {
                    const isExpanded = expandedStage === idx;
                    const isLast = idx === SCENARIO.length - 1;
                    const isPast = expandedStage !== null && idx <= expandedStage;

                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05, duration: 0.3 }}
                      >
                        <button
                          onClick={() => toggleStage(idx)}
                          className={`w-full text-left rounded-2xl transition-all duration-300 ${
                            isExpanded
                              ? "glass shadow-md"
                              : "glass-subtle hover:glass"
                          }`}
                        >
                          {/* Stage header */}
                          <div className="flex items-center gap-4 px-4 py-3">
                            {/* Circle indicator */}
                            <div
                              className={`relative z-10 size-[30px] rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                                isExpanded
                                  ? isLast
                                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                                    : "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                                  : isPast
                                    ? "bg-primary/20 text-primary"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {isExpanded || isPast ? (
                                <CheckCircle2 className="size-4" />
                              ) : (
                                <span className="text-[10px] font-bold">
                                  {idx + 1}
                                </span>
                              )}
                            </div>

                            {/* Title row */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-semibold text-primary/60 uppercase tracking-wider">
                                  {stage.label}
                                </span>
                                {stage.badge && (
                                  <span
                                    className={`${stage.badge.className} text-[9px] px-1.5 py-0 rounded-full font-medium`}
                                  >
                                    {stage.badge.text}
                                  </span>
                                )}
                                {stage.confidence != null && (
                                  <span className="text-[10px] text-muted-foreground ml-auto">
                                    {stage.confidence}%
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium mt-0.5">
                                {stage.title}
                              </p>
                            </div>

                            <ChevronDown
                              className={`size-4 text-muted-foreground shrink-0 transition-transform duration-300 ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </div>

                          {/* Expanded detail */}
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 pl-[62px] space-y-3">
                                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                                    {stage.detail}
                                  </p>
                                  <div className="flex items-center gap-2 text-[11px] text-primary/70">
                                    <FileText className="size-3" />
                                    <span className="font-medium">
                                      Evidence:{" "}
                                    </span>
                                    <span>{stage.evidence}</span>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </button>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Reset button */}
                {expandedStage === SCENARIO.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center mt-6"
                  >
                    <p className="text-xs text-muted-foreground mb-3">
                      That&apos;s how MechanicAI works —&nbsp;
                      <span className="text-primary font-medium">
                        transparent reasoning at every step.
                      </span>
                    </p>
                    <button
                      onClick={() => {
                        setHasStarted(false);
                        setExpandedStage(null);
                      }}
                      className="text-xs text-primary/60 hover:text-primary transition-colors underline underline-offset-2"
                    >
                      Replay demo
                    </button>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Trust callout below timeline */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center"
        >
          <div className="inline-flex items-center gap-2 glass-subtle rounded-full px-4 py-2">
            <Shield className="size-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">
              <strong className="text-foreground">Never hallucinates.</strong>{" "}
              Every conclusion is backed by verifiable sources — or it says
              &ldquo;I don&apos;t know.&rdquo;
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
