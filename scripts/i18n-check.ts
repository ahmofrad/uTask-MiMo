import fs from "fs";
import path from "path";

const faPath = path.resolve("src/messages/fa-IR.json");
const enPath = path.resolve("src/messages/en-US.json");
const schemaPath = path.resolve("prisma/schema.prisma");

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

// Every AuditAction enum value must resolve to an `audit.actions.*` string in
// both locales. The task activity timeline calls t(`audit.actions.${action}`)
// unconditionally, so an untranslated enum value throws MISSING_MESSAGE in
// production instead of degrading gracefully. Guard it here so the gate fails
// in CI the moment a new action lands without its translations.
const schema = fs.readFileSync(schemaPath, "utf-8");
const enumBlock = schema.match(/enum AuditAction \{([^}]*)\}/);
if (!enumBlock) {
  console.error("Could not find AuditAction enum in prisma/schema.prisma");
  process.exit(1);
}
const enumBody = enumBlock[1] ?? "";
const enumValues = enumBody
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => /^[a-z_]+$/.test(line));

const enActions = en.audit?.actions as Record<string, unknown> | undefined;
const faActions = fa.audit?.actions as Record<string, unknown> | undefined;

for (const locale of ["en-US", "fa-IR"] as const) {
  const actions = locale === "en-US" ? enActions : faActions;
  if (!actions) {
    console.error(`Missing audit.actions section in ${locale}`);
    process.exit(1);
  }
  for (const value of enumValues) {
    if (typeof actions[value] !== "string") {
      console.error(`Missing audit.actions.${value} translation in ${locale}`);
      missing = true;
    }
  }
}

if (missing) {
  process.exit(1);
}
console.log("✓ All fa-IR translations present");
console.log("✓ All AuditAction enum values translated in en-US and fa-IR");
