export type DiagnosticTest = {
  id: string;
  domain: string;
  title: string;
  purpose: string;
  requires: string[];
  procedure: string[];
  expected: string[];
  safety: string[];
};

export const DIAGNOSTIC_TESTS: DiagnosticTest[] = [
  { id: "no-start-electrical", domain: "automotive", title: "No-start electrical separation test", purpose: "Separate battery/connection faults from starter-control faults before condemning a component.", requires: ["battery voltage", "vehicle identity"], procedure: ["Verify battery state and terminal integrity", "Measure voltage at rest", "Measure voltage during crank attempt", "Check starter-control command if applicable"], expected: ["Voltage collapse suggests supply/internal battery issue", "Normal supply with absent control shifts suspicion toward control circuit", "Control present with no crank requires starter/ground/mechanical testing"], safety: ["Neutral/park and parking brake", "Keep clear of moving parts"] },
  { id: "overheat-coolant", domain: "automotive", title: "Overheating evidence separation", purpose: "Distinguish coolant loss, circulation, airflow and sensor indications without unnecessary parts replacement.", requires: ["temperature behavior", "coolant level when cold", "vehicle identity"], procedure: ["Do not open a hot pressurized system", "Inspect for visible leaks after safe cool-down", "Compare indicated temperature with independent evidence where available", "Check fan/circulation evidence"], expected: ["External loss supports leak investigation", "Normal coolant with poor circulation requires flow testing", "Conflicting sensor and physical evidence requires sensor/circuit testing"], safety: ["Stop operation for severe overheating", "Avoid hot coolant/steam"] },
  { id: "misfire-dtc", domain: "automotive", title: "Misfire DTC separation", purpose: "Use DTC, freeze-frame and cylinder-specific evidence to separate ignition, fuel, mechanical and control causes.", requires: ["DTC", "freeze-frame", "engine identity"], procedure: ["Record all codes and freeze-frame", "Check whether the fault follows a controlled component swap only when manufacturer procedure permits", "Check spark/fuel/mechanical evidence", "Use live data to confirm the fault under the reported conditions"], expected: ["A code alone does not prove component failure", "A repeatable cylinder-specific change after a controlled test is stronger evidence", "Mechanical evidence overrides assumptions from common failure patterns"], safety: ["Follow manufacturer high-voltage/engine-running precautions"] },
];

export function findDiagnosticTests(domain: string, query: string) {
  const q = `${domain} ${query}`.toLowerCase();
  return DIAGNOSTIC_TESTS.filter((test) => `${test.domain} ${test.title} ${test.purpose}`.toLowerCase().split(" ").some((word) => word.length > 3 && q.includes(word))).slice(0, 5);
}
