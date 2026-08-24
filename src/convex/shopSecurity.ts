import type { ShopRole } from "./schema";

export const SHOP_PERMISSIONS = {
  owner: ["org:read", "org:write", "members:write", "billing:write", "diagnostics:write", "customers:write", "vehicles:write", "appointments:write", "repair_orders:write", "invoices:write", "fleet:write"],
  manager: ["org:read", "members:write", "diagnostics:write", "customers:write", "vehicles:write", "appointments:write", "repair_orders:write", "invoices:write", "fleet:write"],
  advisor: ["org:read", "diagnostics:write", "customers:write", "vehicles:write", "appointments:write", "repair_orders:write", "invoices:write"],
  technician: ["org:read", "diagnostics:write", "customers:read", "vehicles:read", "appointments:read", "repair_orders:write"],
  parts: ["org:read", "customers:read", "vehicles:read", "repair_orders:read", "repair_orders:write"],
  front_desk: ["org:read", "customers:write", "vehicles:write", "appointments:write", "repair_orders:read", "invoices:read"],
  viewer: ["org:read", "customers:read", "vehicles:read", "appointments:read", "repair_orders:read", "invoices:read", "diagnostics:read"],
} as const satisfies Record<ShopRole, readonly string[]>;

export type ShopPermission = (typeof SHOP_PERMISSIONS)[ShopRole][number];

export function hasShopPermission(role: ShopRole, permission: ShopPermission): boolean {
  return SHOP_PERMISSIONS[role].includes(permission);
}

export function assertPositiveMoneyCents(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000_000_00) throw new Error(`${field} must be a safe non-negative integer amount in cents`);
  return value;
}

export function assertPositiveQuantity(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) throw new Error("Quantity must be positive and bounded");
  return value;
}

export function assertValidVehicleYear(year: number): number {
  if (!Number.isInteger(year) || year < 1886 || year > new Date().getUTCFullYear() + 2) throw new Error("Invalid vehicle year");
  return year;
}

export function normalizeVin(vin: string): string {
  const normalized = vin.trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)) throw new Error("Invalid VIN");
  return normalized;
}

export function assertAppointmentWindow(startAt: number, endAt: number): void {
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) throw new Error("Invalid appointment window");
  const maxDuration = 24 * 60 * 60 * 1000;
  if (endAt - startAt > maxDuration) throw new Error("Appointment window is too long");
}

export function assertNoUnsafeAutonomousRepairAction(action: string): void {
  const blocked = /clear\s*(dtc|codes)|erase|program\s*ecu|flash|unlock|bypass|disable\s*(airbag|abs|esp|interlock)|actuat(e|or)|energize|write\s*command/i;
  if (blocked.test(action)) throw new Error("Autonomous vehicle control or safety-system bypass is disabled");
}

export const SHOP_SECURITY_INVARIANTS = [
  "Every organization-scoped record must be authorized through organization membership before read or write.",
  "A technician cannot modify billing, membership, or organization settings.",
  "A viewer is read-only.",
  "Customer authorization must be recorded before a repair order leaves estimate state.",
  "AI diagnostic output is never itself customer authorization or proof of component failure.",
  "Vehicle identity confidence must remain visible and must not be silently upgraded by AI.",
  "Payments are represented as state and must be reconciled with the payment provider; never trust a client-supplied paid flag.",
  "No autonomous vehicle-control, DTC-clear, ECU-programming, safety-interlock bypass, or energized-work commands are exposed through the AI path.",
  "Financial amounts are integer cents and must be bounded and validated server-side.",
  "All destructive or security-sensitive actions require authenticated server-side authorization and an audit event.",
] as const;
