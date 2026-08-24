import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const required = [
  "src/convex/schema.ts",
  "src/convex/diagnosticGuardrails.ts",
  "src/convex/diagnosticPolicy.ts",
  "src/convex/diagnosticTestLibrary.ts",
  "src/convex/diagnosticTestMatrix.ts",
  "src/convex/diagnosticKnowledge.ts",
  "src/convex/obd.ts",
  "src/convex/aiBudget.ts",
  "src/convex/shopSecurity.ts",
  "scripts/security-guard.mjs",
  "scripts/diagnostic-benchmark.mjs",
  "scripts/diagnostic-adversarial-gate.mjs",
  "scripts/shop-security-benchmark.mjs",
  "tests/diagnostic/vehicle-fixtures.json",
  "tests/diagnostic/adversarial-cases.json",
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) failures.push(`missing production control: ${file}`);

const schema = fs.readFileSync(path.join(root, "src/convex/schema.ts"), "utf8");
for (const table of ["organizations", "organizationMembers", "locations", "customers", "vehicles", "fleets", "appointments", "repairOrders", "workOrderItems", "invoices", "diagnosticSessions", "diagnosticMessages", "auditLogs", "uploadClaims"]) {
  if (!new RegExp(`\\b${table}\\s*:`).test(schema)) failures.push(`schema missing required table: ${table}`);
}

const security = fs.readFileSync(path.join(root, "src/convex/shopSecurity.ts"), "utf8");
for (const marker of ["organization", "authorization", "customer authorization", "payment", "DTC", "bypass", "audit"]) {
  if (!security.toLowerCase().includes(marker.toLowerCase())) failures.push(`shop security policy missing: ${marker}`);
}

const guardrails = fs.readFileSync(path.join(root, "src/convex/diagnosticGuardrails.ts"), "utf8").toLowerCase();
for (const marker of ["verified", "unknown", "stop work", "safety", "do not", "bypass"]) {
  if (!guardrails.includes(marker)) failures.push(`diagnostic guardrail missing: ${marker}`);
}

const obd = fs.readFileSync(path.join(root, "src/diagnostics/obdProtocol.ts"), "utf8").toLowerCase();
if (!obd.includes("read_only_services") || !obd.includes("clear")) failures.push("OBD control boundary missing");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (pkg.scripts?.build !== "npm run security:guard && npm run diagnostic:benchmark && npm run diagnostic:adversarial && npm run production:gate && tsc -b && vite build") failures.push("production gate is not enforced by the build script");

if (failures.length) {
  console.error("PRODUCTION READINESS GATE FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Production readiness gate passed: architecture, safety, shop authorization, diagnostic boundaries, and required test controls are present.");
