export type VehicleObservation = {
  key: string;
  value: number | string | boolean;
  unit?: string;
  observedAt: number;
  source: "obdii" | "uds" | "j1939" | "doip" | "oem" | "inferred";
  verified: boolean;
};

export type VehicleCapability = {
  id: string;
  label: string;
  status: "verified" | "unsupported" | "not_tested";
  source?: string;
};

export type VehicleSnapshot = {
  observedAt: number;
  vin?: string;
  protocol?: string;
  capabilities: VehicleCapability[];
  observations: VehicleObservation[];
  dtcs: string[];
};

export type VehicleAlert = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  firstObservedAt: number;
  lastObservedAt: number;
};

const ALERT_THRESHOLDS = {
  coolantHighC: 115,
  batteryLowV: 11.8,
  engineLoadHighPct: 95,
  fuelTrimHighPct: 15,
  fuelTrimLowPct: -15,
};

function latestByKey(observations: VehicleObservation[]) {
  const map = new Map<string, VehicleObservation>();
  for (const observation of observations) map.set(observation.key, observation);
  return map;
}

export function detectVehicleAlerts(snapshot: VehicleSnapshot): VehicleAlert[] {
  const latest = latestByKey(snapshot.observations);
  const now = Date.now();
  const alerts: VehicleAlert[] = [];
  const add = (id: string, severity: VehicleAlert["severity"], title: string, detail: string) => alerts.push({ id, severity, title, detail, firstObservedAt: now, lastObservedAt: now });

  const coolant = latest.get("coolantC");
  if (coolant && typeof coolant.value === "number" && coolant.value >= ALERT_THRESHOLDS.coolantHighC) add("coolant-high", "critical", "Coolant temperature is high", `Observed ${coolant.value.toFixed(0)} °C. This is an observed value, not a diagnosis.`);

  const voltage = latest.get("controlModuleVoltageV");
  if (voltage && typeof voltage.value === "number" && voltage.value < ALERT_THRESHOLDS.batteryLowV) add("voltage-low", "warning", "Vehicle voltage is low", `Observed ${voltage.value.toFixed(1)} V at the diagnostic interface.`);

  const load = latest.get("engineLoadPct");
  if (load && typeof load.value === "number" && load.value >= ALERT_THRESHOLDS.engineLoadHighPct) add("load-high", "info", "Engine load is very high", `Observed ${load.value.toFixed(0)}% engine load.`);

  const stft = latest.get("shortFuelTrimBank1Pct");
  const ltft = latest.get("longFuelTrimBank1Pct");
  for (const item of [stft, ltft]) {
    if (item && typeof item.value === "number" && item.value >= ALERT_THRESHOLDS.fuelTrimHighPct) add(`trim-high-${item.key}`, "warning", "Positive fuel trim is elevated", `${item.key} observed at ${item.value.toFixed(1)}%. Confirm with vehicle-specific testing before concluding a fault.`);
    if (item && typeof item.value === "number" && item.value <= ALERT_THRESHOLDS.fuelTrimLowPct) add(`trim-low-${item.key}`, "warning", "Negative fuel trim is elevated", `${item.key} observed at ${item.value.toFixed(1)}%. Confirm with vehicle-specific testing before concluding a fault.`);
  }

  for (const dtc of snapshot.dtcs) add(`dtc-${dtc}`, "warning", `Diagnostic trouble code ${dtc}`, "The vehicle reported this code; a DTC does not by itself prove a failed component.");
  return alerts;
}

export function buildDiagnosticEvidence(snapshot: VehicleSnapshot, alerts: VehicleAlert[]) {
  const observed = snapshot.observations.filter((x) => x.verified).slice(0, 100);
  const lines = [
    "REAL VEHICLE TELEMETRY — observed from connected interface",
    `Observed at: ${new Date(snapshot.observedAt).toISOString()}`,
    `Protocol/interface: ${snapshot.protocol || "unknown"}`,
    snapshot.vin ? `VIN reported by vehicle/interface: ${snapshot.vin}` : "VIN: not exposed by current interface",
    `DTCs: ${snapshot.dtcs.length ? snapshot.dtcs.join(", ") : "none observed"}`,
    "",
    ...observed.map((o) => `${o.key}: ${o.value}${o.unit ? ` ${o.unit}` : ""} [source=${o.source}; verified=${o.verified}]`),
    "",
    ...alerts.map((a) => `ALERT ${a.severity.toUpperCase()}: ${a.title} — ${a.detail}`),
    "",
    "AutoAI must treat these as observations. They are not automatically proof of component failure.",
  ];
  return lines.join("\n");
}

export function capabilityMatrix(): VehicleCapability[] {
  return [
    { id: "obdii-live", label: "OBD-II standardized live data", status: "not_tested", source: "OBD-II service 01" },
    { id: "obdii-dtc", label: "OBD-II stored DTCs", status: "not_tested", source: "OBD-II service 03" },
    { id: "obdii-vin", label: "VIN / vehicle identification", status: "not_tested", source: "OBD-II service 09" },
    { id: "uds", label: "UDS ECU diagnostics", status: "not_tested", source: "Vehicle interface dependent" },
    { id: "can", label: "Raw CAN / CAN-FD", status: "not_tested", source: "Hardware/interface dependent" },
    { id: "j1939", label: "J1939 heavy-duty diagnostics", status: "not_tested", source: "Hardware/interface dependent" },
    { id: "doip", label: "DoIP / automotive Ethernet", status: "not_tested", source: "Hardware/interface dependent" },
    { id: "oem", label: "OEM proprietary ECU data", status: "not_tested", source: "OEM authorization/interface dependent" },
  ];
}
