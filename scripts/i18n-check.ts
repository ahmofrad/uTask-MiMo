// Placeholder: i18n completeness check
// Will be implemented in Phase 8
import fs from "fs";
import path from "path";

const faPath = path.resolve("src/messages/fa-IR.json");
const enPath = path.resolve("src/messages/en-US.json");

const fa = JSON.parse(fs.readFileSync(faPath, "utf-8"));
const en = JSON.parse(fs.readFileSync(enPath, "utf-8"));

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      return flattenKeys(value as Record<string, unknown>, fullKey);
    }
    return [fullKey];
  });
}

const enKeys = new Set(flattenKeys(en));
const faKeys = new Set(flattenKeys(fa));

let missing = false;
for (const key of enKeys) {
  if (!faKeys.has(key)) {
    console.error(`Missing fa-IR translation: ${key}`);
    missing = true;
  }
}

if (missing) {
  process.exit(1);
}
console.log("✓ All fa-IR translations present");
