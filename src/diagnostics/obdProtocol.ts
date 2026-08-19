export type ObdService = "01_current_data" | "02_freeze_frame" | "03_dtcs" | "04_clear" | "05_o2" | "06_onboard" | "07_pending_dtcs" | "09_vehicle_info";

export const OBD_READ_ONLY_SERVICES: ObdService[] = ["01_current_data", "02_freeze_frame", "03_dtcs", "05_o2", "06_onboard", "07_pending_dtcs", "09_vehicle_info"];

export function normalizeObdCode(code: string) {
  const value = code.trim().toUpperCase();
  return /^[PCBU][0-9A-F]{4}$/.test(value) ? value : null;
}

export function validateReadOnlyService(service: ObdService) {
  if (!OBD_READ_ONLY_SERVICES.includes(service)) throw new Error("Control/clear commands are disabled in the AI diagnostic path");
  return true;
}
