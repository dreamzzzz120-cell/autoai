import fs from "node:fs";

const failures = [];
const requiredEnv = ["VITE_CONVEX_URL"];
for (const key of requiredEnv) {
  if (!process.env[key]) failures.push(`missing required deployment environment variable: ${key}`);
}

const forbidden = [
  ["VITE_CONVEX_URL", /localhost|127\.0\.0\.1/],
  ["VITE_CONVEX_URL", /\.convex\.cloud$/],
];
for (const [key, pattern] of forbidden) {
  const value = process.env[key] ?? "";
  if (value && pattern.test(value) && /localhost|127\.0\.0\.1/.test(value)) failures.push(`${key} points at a local endpoint`);
}

if (process.env.NODE_ENV === "production" && process.env.VITE_ALLOW_DEMO_MODE === "true") {
  failures.push("demo mode is forbidden in production");
}

if (!fs.existsSync("src/convex/auth.ts")) failures.push("authentication implementation missing");
if (!fs.existsSync("src/convex/shopSecurity.ts")) failures.push("shop security implementation missing");

if (failures.length) {
  console.error("RUNTIME PRODUCTION ATTESTATION FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Runtime production attestation prerequisites passed.");
