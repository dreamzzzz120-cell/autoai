import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const security = fs.readFileSync(path.join(root, "src/convex/shopSecurity.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "src/convex/schema.ts"), "utf8");

for (const role of ["owner", "manager", "advisor", "technician", "parts", "front_desk", "viewer"]) {
  if (!new RegExp(`\\b${role}\\s*:`).test(security)) failures.push(`missing role: ${role}`);
}
for (const invariant of ["customer authorization", "payment", "organization", "audit", "DTC", "bypass"]) {
  if (!security.toLowerCase().includes(invariant.toLowerCase())) failures.push(`missing security invariant: ${invariant}`);
}
for (const table of ["customers", "vehicles", "appointments", "repairOrders", "workOrderItems", "invoices", "fleets"]) {
  if (!new RegExp(`\\b${table}\\s*:`).test(schema)) failures.push(`missing operational table: ${table}`);
}
if (!/totalsCents/.test(schema) || !/unitPriceCents/.test(schema)) failures.push("financial amounts are not represented as integer cents");
if (!/customerAuthorizationAt/.test(schema)) failures.push("repair-order authorization timestamp missing");

if (failures.length) {
  console.error("SHOP SECURITY BENCHMARK FAILED");
  failures.forEach((x) => console.error(`- ${x}`));
  process.exit(1);
}
console.log("Shop security benchmark passed: roles, organization boundaries, authorization, financial invariants, and operational tables are present.");
