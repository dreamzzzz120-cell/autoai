import { SHOP_ROLES } from "./schema";

export const FRONT_DESK_ALLOWED_ROLES = new Set([
  SHOP_ROLES.OWNER,
  SHOP_ROLES.MANAGER,
  SHOP_ROLES.ADVISOR,
  SHOP_ROLES.FRONT_DESK,
]);

export const FRONT_DESK_ESCALATION_ROLES = new Set([
  SHOP_ROLES.OWNER,
  SHOP_ROLES.MANAGER,
  SHOP_ROLES.ADVISOR,
]);

export const FRONT_DESK_RULES = Object.freeze({
  neverDiagnose: true,
  neverPromiseRepairOutcome: true,
  neverInventPricing: true,
  neverInventAvailability: true,
  neverAuthorizeRepairs: true,
  neverMarkInvoicePaid: true,
  neverChangeDiagnosticEvidence: true,
  neverBypassSafety: true,
  requireHumanEscalationForSafety: true,
  requireCustomerConfirmationBeforeBooking: true,
  requireExplicitAuthorizationForRepair: true,
  auditEveryWrite: true,
});

export type FrontDeskAction =
  | "create_customer"
  | "update_customer"
  | "request_appointment"
  | "confirm_appointment"
  | "cancel_appointment"
  | "check_in"
  | "create_estimate"
  | "send_estimate"
  | "request_repair_authorization"
  | "escalate_safety"
  | "view_vehicle_history";

const allowedActions: Record<FrontDeskAction, Set<string>> = {
  create_customer: FRONT_DESK_ALLOWED_ROLES,
  update_customer: FRONT_DESK_ALLOWED_ROLES,
  request_appointment: FRONT_DESK_ALLOWED_ROLES,
  confirm_appointment: FRONT_DESK_ALLOWED_ROLES,
  cancel_appointment: FRONT_DESK_ALLOWED_ROLES,
  check_in: FRONT_DESK_ALLOWED_ROLES,
  create_estimate: new Set([SHOP_ROLES.OWNER, SHOP_ROLES.MANAGER, SHOP_ROLES.ADVISOR, SHOP_ROLES.FRONT_DESK]),
  send_estimate: new Set([SHOP_ROLES.OWNER, SHOP_ROLES.MANAGER, SHOP_ROLES.ADVISOR, SHOP_ROLES.FRONT_DESK]),
  request_repair_authorization: new Set([SHOP_ROLES.OWNER, SHOP_ROLES.MANAGER, SHOP_ROLES.ADVISOR, SHOP_ROLES.FRONT_DESK]),
  escalate_safety: FRONT_DESK_ALLOWED_ROLES,
  view_vehicle_history: FRONT_DESK_ALLOWED_ROLES,
};

export function canFrontDeskAction(role: string, action: FrontDeskAction): boolean {
  return allowedActions[action]?.has(role) ?? false;
}

export function requiresHumanEscalation(input: string): boolean {
  return /(brake|steering|fuel leak|fire|smoke|overheat|high[- ]voltage|airbag|unsafe|carbon monoxide|pedal to the floor)/i.test(input);
}

export function sanitizeCustomerMessage(input: string): string {
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, 8000);
}

export function assertBookableWindow(startAt: number, endAt: number, now = Date.now()): void {
  if (!Number.isSafeInteger(startAt) || !Number.isSafeInteger(endAt) || endAt <= startAt) throw new Error("Invalid appointment window");
  if (startAt < now - 60_000) throw new Error("Appointment cannot be created in the past");
  if (endAt - startAt > 24 * 60 * 60 * 1000) throw new Error("Appointment window is too large");
}
