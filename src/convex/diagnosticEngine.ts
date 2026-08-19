import { DIAGNOSTIC_KNOWLEDGE } from "./diagnosticKnowledge";
import { DIAGNOSTIC_POLICY } from "./diagnosticPolicy";

/**
 * Canonical prompt assembled in one place so every future diagnostic provider
 * receives the same safety/evidence rules.
 */
export const UNIVERSAL_DIAGNOSTIC_SYSTEM_PROMPT = `${DIAGNOSTIC_POLICY}\n\n${DIAGNOSTIC_KNOWLEDGE}`;
