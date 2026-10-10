import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(resolve(path, entry.name))
      : [resolve(path, entry.name)],
  );
}
const names = new Set(["question-circle"]);
for (const path of walk("src").filter((path) => /\.tsx?$/.test(path))) {
  const code = readFileSync(path, "utf8");
  for (const match of code.matchAll(
    /(?:name|icon):?\s*(?:=\s*)?["']([a-z][a-z0-9-]+)["']/g,
  ))
    names.add(match[1]);
}
const explicit = readFileSync("src/components/workspace-nav.tsx", "utf8");
for (const match of explicit.matchAll(/:\s*"([a-z][a-z0-9-]+)"/g))
  names.add(match[1]);
let content = '<svg xmlns="http://www.w3.org/2000/svg">';
let count = 0;
for (const name of [...names].sort()) {
  let svg;
  try {
    svg = readFileSync(
      resolve("node_modules/bootstrap-icons/icons", name + ".svg"),
      "utf8",
    );
  } catch {
    continue;
  }
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");
  content += `<symbol id="${name}" viewBox="0 0 16 16">${inner}</symbol>`;
  count++;
}
content += "</svg>";
mkdirSync("public", { recursive: true });
writeFileSync("public/icons.svg", content);
console.log(
  `Generated ${count} Bootstrap SVG icons (${Buffer.byteLength(content)} bytes).`,
);
