import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fixturePath = path.join(root, "tests/diagnostic/vehicle-fixtures.json");
const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf8")).fixtures;

const failures = [];
const requiredSourceFiles = [
  "src/convex/diagnosticGuardrails.ts",
  "src/convex/diagnosticPolicy.ts",
  "src/convex/diagnosticTestLibrary.ts",
  "src/convex/diagnosticTestMatrix.ts",
  "src/convex/diagnosticKnowledge.ts",
  "src/convex/obd.ts",
  "src/convex/aiBudget.ts",
];

for (const file of requiredSourceFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing required diagnostic component: ${file}`);
}

const sourceFiles = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "_generated") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) sourceFiles.push(full);
  }
}
walk(path.join(root, "src"));

for (const file of sourceFiles) {
  const text = fs.readFileSync(file, "utf8");
  if (/\banonymous\s*:\s*true\b/i.test(text) || /Continue as Guest/i.test(text)) {
    failures.push(`guest access marker found in ${path.relative(root, file)}`);
  }
}

function assertFixture(fixture) {
  const { obd, requiredBehavior } = fixture;
  const validDtc = (code) => /^[PCBU][0-9A-F]{4}$/.test(code);
  for (const code of obd.dtcs) {
    if (!validDtc(code)) failures.push(`${fixture.id}: invalid DTC fixture ${code}`);
  }

  const text = requiredBehavior.join(" ").toLowerCase();
  if (obd.dtcs.length && !text.includes("discriminating")) failures.push(`${fixture.id}: DTC fixture must require a discriminating test`);
  if (obd.dtcs.length && /failed (ecu|injector|coil)/i.test(text) && !text.includes("do not")) failures.push(`${fixture.id}: unsafe component certainty in fixture`);
  if (fixture.groundTruth.includes("overheating") && !text.includes("stopping")) failures.push(`${fixture.id}: overheating fixture must require stop/inspection behavior`);
}

for (const fixture of fixtures) assertFixture(fixture);

const policy = fs.readFileSync(path.join(root, "src/convex/diagnosticPolicy.ts"), "utf8");
const guardrails = fs.readFileSync(path.join(root, "src/convex/diagnosticGuardrails.ts"), "utf8");
const requiredPolicyMarkers = ["evidence", "safety", "unknown"];
for (const marker of requiredPolicyMarkers) {
  if (!policy.toLowerCase().includes(marker)) failures.push(`diagnosticPolicy.ts missing required concept: ${marker}`);
}
if (!/STOP|stop/i.test(guardrails)) failures.push("diagnostic guardrails do not contain a stop-work path");

if (failures.length) {
  console.error("Diagnostic benchmark FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Diagnostic benchmark PASSED: ${fixtures.length} ground-truth fixtures and ${sourceFiles.length} source files checked.`);
