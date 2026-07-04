import fs from "fs";
import path from "path";

const srcDir = path.resolve("src");
let issues = 0;

const skipDirs = new Set(["node_modules", ".next", "__pycache__"]);

// Known token-safe class overrides (e.g. dynamic classes from CVA)
const allowedHardcoded = new Set([
  "text-white", "text-black", "text-fg-inverse",
]);

function walkDir(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) walkDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";

        // Check for physical CSS properties
        const physicalProps = /(?:^|\s)(ml-|mr-|pl-|pr-|left-|right-|border-l-|border-r-)(?!\[)/g;
        let match;
        while ((match = physicalProps.exec(line)) !== null) {
          if (line.includes("import ") || line.includes("http")) continue;
          const prop = match[1] ?? "";
          console.warn(`${fullPath}:${i + 1}  Physical CSS property: "${prop}"`);
          issues++;
        }

        // Check for hardcoded text colors
        const hardcodedColors = /text-(white|black|gray-\d+|slate-\d+|zinc-\d+|neutral-\d+|stone-\d+|red-\d+|orange-\d+|amber-\d+|yellow-\d+|lime-\d+|green-\d+|emerald-\d+|teal-\d+|cyan-\d+|sky-\d+|blue-\d+|indigo-\d+|violet-\d+|purple-\d+|fuchsia-\d+|pink-\d+|rose-\d+)\b/g;
        while ((match = hardcodedColors.exec(line)) !== null) {
          if (match[0] && allowedHardcoded.has(match[0])) continue;
          const col = match[0] ?? "";
          console.warn(`${fullPath}:${i + 1}  Hardcoded text color: "${col}"`);
          issues++;
        }

        // Check for hardcoded background colors
        const hardcodedBg = /bg-(gray-\d+|slate-\d+|zinc-\d+|red-\d+|green-\d+|blue-\d+)\b/g;
        while ((match = hardcodedBg.exec(line)) !== null) {
          const col = match[0] ?? "";
          console.warn(`${fullPath}:${i + 1}  Hardcoded bg color: "${col}"`);
          issues++;
        }
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
