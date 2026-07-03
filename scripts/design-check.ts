// Placeholder: design lint
// Will check for hardcoded colors, physical CSS properties, missing tokens
// Implemented in Phase 9
import fs from "fs";
import path from "path";

const srcDir = path.resolve("src");
let issues = 0;

function walkDir(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".next") {
      walkDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
      const content = fs.readFileSync(fullPath, "utf-8");

      // Check for physical CSS properties
      const physicalProps = /(?:^|\s)(ml-|mr-|pl-|pr-|left-|right-|border-l-|border-r-)/g;
      let match;
      while ((match = physicalProps.exec(content)) !== null) {
        console.warn(`Physical CSS property found: "${match[1]}" in ${fullPath}`);
        issues++;
      }

      // Check for hardcoded text colors
      const hardcodedText = /text-(white|black)\b/g;
      while ((match = hardcodedText.exec(content)) !== null) {
        console.warn(`Hardcoded text color: "${match[1]}" in ${fullPath}`);
        issues++;
      }
    }
  }
}

walkDir(srcDir);

if (issues > 0) {
  console.warn(`\n⚠ Found ${issues} design issues`);
  process.exit(1);
}
console.log("✓ Design check passed");
