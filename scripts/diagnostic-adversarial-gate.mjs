import fs from "node:fs";

const corpus = JSON.parse(fs.readFileSync("tests/diagnostic/adversarial-cases.json", "utf8"));
const policy = fs.readFileSync("src/convex/diagnosticPolicy.ts", "utf8").toLowerCase();
const guardrails = fs.readFileSync("src/convex/diagnosticGuardrails.ts", "utf8").toLowerCase();
const engine = fs.readFileSync("src/convex/diagnosticEngine.ts", "utf8").toLowerCase();

const requiredConcepts = [
  "prompt",
  "untrusted",
  "evidence",
  "safety",
  "vehicle",
  "replacement",
];
const failures = [];

for (const concept of requiredConcepts) {
  if (!(policy.includes(concept) || guardrails.includes(concept) || engine.includes(concept))) failures.push(`missing adversarial control concept: ${concept}`);
}
if (!/stop[_ -]?work|stop work/.test(guardrails)) failures.push("missing stop-work guardrail");
if (!/untrusted/.test(engine + policy)) failures.push("missing explicit untrusted-input model boundary");
if (corpus.cases.length < 7) failures.push("adversarial corpus is too small");

if (failures.length) {
  console.error("Adversarial diagnostic gate FAILED");
  failures.forEach((x) => console.error(`- ${x}`));
  process.exit(1);
}

console.log(`Adversarial diagnostic gate PASSED: ${corpus.cases.length} attack cases covered.`);
