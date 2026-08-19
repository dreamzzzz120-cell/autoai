export type TestStep = {
  id: string;
  purpose: string;
  safety: "visual" | "non_intrusive" | "hands_on" | "energized";
  resultA: string;
  resultB: string;
  resultUnknown: string;
};

/**
 * Generic diagnostic test matrix. Vehicle/manufacturer-specific values must
 * come from verified evidence; these entries intentionally describe method,
 * not invented specifications.
 */
export const DIAGNOSTIC_TEST_MATRIX: Record<string, TestStep[]> = {
  no_start: [
    {
      id: "power_supply",
      purpose: "Determine whether adequate system power is present before blaming a downstream component.",
      safety: "non_intrusive",
      resultA: "Power supply is present; continue downstream.",
      resultB: "Power supply is absent or abnormal; investigate battery, connections, grounds, fuses, or main power distribution.",
      resultUnknown: "Do not replace downstream components until power integrity is established.",
    },
    {
      id: "crank_condition",
      purpose: "Separate no-crank from crank-but-no-start behavior.",
      safety: "visual",
      resultA: "Engine/motor cranks normally; evaluate enable, fuel/air, ignition/injection, compression, timing, or control evidence as applicable.",
      resultB: "Engine/motor does not crank normally; prioritize power, starter/drive, interlock, mechanical seizure, or control causes.",
      resultUnknown: "Request an exact description/video or measured observation.",
    },
  ],
  overheating: [
    {
      id: "coolant_loss",
      purpose: "Determine whether loss of working fluid is contributing to thermal failure.",
      safety: "visual",
      resultA: "Visible loss or evidence of leakage; isolate source before continuing.",
      resultB: "No visible loss; evaluate circulation, airflow, control, heat rejection, sensor accuracy, and internal causes.",
      resultUnknown: "Do not open a hot pressurized cooling system.",
    },
  ],
  electrical_fault: [
    {
      id: "power_ground_integrity",
      purpose: "Separate supply/ground faults from downstream load faults.",
      safety: "non_intrusive",
      resultA: "Supply and ground are credible; continue circuit isolation.",
      resultB: "Supply/ground is abnormal; repair the distribution fault before condemning the load.",
      resultUnknown: "Do not substitute parts as a diagnostic method.",
    },
  ],
  noise: [
    {
      id: "condition_correlation",
      purpose: "Determine whether the noise correlates with RPM, vehicle speed, load, steering, braking, temperature, or operating mode.",
      safety: "visual",
      resultA: "Correlation narrows the subsystem; perform the safest discriminating observation next.",
      resultB: "No reproducible correlation; capture conditions and consider intermittent causes.",
      resultUnknown: "Request a recording plus exact operating conditions.",
    },
  ],
};
