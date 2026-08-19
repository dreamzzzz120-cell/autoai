export type DiagnosticDomain =
  | "automotive"
  | "diesel"
  | "motorcycle"
  | "powersports"
  | "marine"
  | "heavy_equipment"
  | "agriculture"
  | "small_engine"
  | "industrial"
  | "generator"
  | "pump"
  | "compressor"
  | "ev_hybrid"
  | "unknown";

export type DiagnosticRisk = "routine" | "caution" | "safety_critical" | "stop_work";

export type DiagnosticGate = {
  risk: DiagnosticRisk;
  requiresMachineIdentity: boolean;
  requiresDirectEvidence: boolean;
  requiresDiscriminatingTest: boolean;
  prohibitsPartsReplacementClaim: boolean;
};

const SAFETY_PATTERNS = [
  /brake|braking|pedal goes to floor|no brakes/i,
  /steering|wheel separation|loose wheel|lug nut/i,
  /fuel leak|gas leak|fuel smell|diesel leak|fire|smoke/i,
  /overheat|overheating|no oil pressure|low oil pressure|oil starvation/i,
  /uncontrolled acceleration|stuck throttle|runaway engine/i,
  /high voltage|high-voltage|traction battery|orange cable|ev battery/i,
  /hydraulic.*leak|high pressure hydraulic|injection injury/i,
  /propeller|jet pump|carbon monoxide|co poisoning/i,
  /rotating machinery|unguarded shaft|entanglement/i,
];

const STOP_PATTERNS = [
  /active fire|vehicle on fire|machine on fire/i,
  /electrocut|electric shock|arc flash/i,
  /fuel spraying|fuel spraying under pressure/i,
  /propeller.*turning|shaft.*turning.*hands/i,
  /crushed|trapped|amputation/i,
];

export function classifyDiagnosticRisk(text: string): DiagnosticRisk {
  if (STOP_PATTERNS.some((pattern) => pattern.test(text))) return "stop_work";
  if (SAFETY_PATTERNS.some((pattern) => pattern.test(text))) return "safety_critical";
  return "routine";
}

export function buildDiagnosticGate(input: {
  text: string;
  machineIdentified: boolean;
  hasDirectEvidence: boolean;
}): DiagnosticGate {
  const risk = classifyDiagnosticRisk(input.text);

  return {
    risk,
    requiresMachineIdentity: !input.machineIdentified,
    requiresDirectEvidence: risk === "safety_critical" || !input.hasDirectEvidence,
    requiresDiscriminatingTest: risk !== "stop_work",
    prohibitsPartsReplacementClaim: risk !== "routine" || !input.hasDirectEvidence,
  };
}

export const DIAGNOSTIC_HARD_RULES = [
  "Never convert a symptom into a failed component without a verification path.",
  "Never fabricate an OEM specification, wiring pinout, TSB, recall, service procedure, part number, torque value, fluid specification, or citation.",
  "A source is VERIFIED only when the application retrieved it or the user supplied it; otherwise mark it UNVERIFIED.",
  "A DTC identifies a monitored fault condition; it does not by itself prove which component failed.",
  "Prefer measurements and tests that distinguish competing hypotheses.",
  "If the machine identity is uncertain, do not provide vehicle-specific specifications or procedures.",
  "If evidence conflicts, preserve the conflict and request the smallest high-value test that resolves it.",
  "Safety-critical findings override convenience, cost, and diagnostic completeness.",
  "For high voltage, pressurized systems, rotating machinery, fuel systems, and marine propulsion, require appropriate isolation and qualified procedures before hands-on work.",
  "Never claim certainty merely because the diagnosis is common or statistically frequent.",
  "Never instruct a user to bypass a safety interlock, defeat a protective device, or perform unsafe energized work.",
  "When evidence is insufficient, the correct result is UNKNOWN plus the next evidence request.",
] as const;
