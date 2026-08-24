import fs from "node:fs";

const policy = fs.readFileSync("src/convex/frontDeskSecurity.ts", "utf8");
const failures = [];
const required = [
  "neverDiagnose",
  "neverPromiseRepairOutcome",
  "neverInventPricing",
  "neverInventAvailability",
  "neverAuthorizeRepairs",
  "neverMarkInvoicePaid",
  "neverChangeDiagnosticEvidence",
  "neverBypassSafety",
  "requireHumanEscalationForSafety",
  "auditEveryWrite",
];
for (const marker of required) if (!policy.includes(marker)) failures.push(`front-desk control missing: ${marker}`);
for (const role of ["OWNER", "MANAGER", "ADVISOR", "FRONT_DESK", "TECHNICIAN", "PARTS", "VIEWER"]) {
  if (!policy.includes(`SHOP_ROLES.${role}`)) failures.push(`role boundary missing: ${role}`);
}
for (const term of ["brake", "steering", "fuel leak", "high[- ]voltage", "carbon monoxide"]) {
  if (!policy.includes(term)) failures.push(`safety escalation pattern missing: ${term}`);
}
if (failures.length) {
  console.error("FRONT DESK SECURITY BENCHMARK FAILED");
  failures.forEach((x) => console.error(`- ${x}`));
  process.exit(1);
}
console.log("Front desk security benchmark passed.");
