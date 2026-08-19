import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const failures = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      const text = readFileSync(path, "utf8");
      if (/export\\s+const\\s+\\w+\\s*=\\s*mutation\\s*\\(/.test(text)) failures.push(`PUBLIC MUTATION: ${path}`);
    }
  }
}

walk("src/convex");

const auth = readFileSync("src/convex/auth.ts", "utf8");
const authPage = readFileSync("src/pages/Auth.tsx", "utf8");
if (/Anonymous/.test(auth) || /anonymous/.test(auth)) failures.push("ANONYMOUS AUTH PROVIDER FOUND: src/convex/auth.ts");
if (/Continue\\s+as\\s+Guest|signIn\\(\\s*[\"']anonymous/.test(authPage)) failures.push("GUEST AUTH UI FOUND: src/pages/Auth.tsx");

if (failures.length) {
  console.error("Security guard failed:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("Security guard passed: no public Convex mutations and no anonymous auth provider/UI.");
