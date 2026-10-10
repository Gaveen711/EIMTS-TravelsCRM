import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const html = await readFile("legacy-itinerary/brochure-studio.html", "utf8");
const marker = html.indexOf("bV=[");
const end = html.indexOf("}]});", marker) + 2;
if (marker < 0 || end <= marker)
  throw new Error("Legacy photo metadata not found.");
const part = html.slice(marker + 4, end);
const library = [];
await mkdir("public/itinerary-photos", { recursive: true });
for (const object of part.matchAll(/\{id:"[^"]+"[^}]*\}/g)) {
  const item = {};
  for (const field of object[0].matchAll(/(\w+):("(?:\\.|[^"\\])*"|\d+)/g))
    item[field[1]] = JSON.parse(field[2]);
  const key = '"/photos/' + item.filename + '":["image/jpeg","';
  const start = html.indexOf(key);
  if (start < 0) throw new Error("Missing photo " + item.filename);
  const dataStart = start + key.length;
  const dataEnd = html.indexOf('"]', dataStart);
  const bytes = Buffer.from(html.slice(dataStart, dataEnd), "base64");
  await sharp(bytes)
    .rotate()
    .resize({
      width: 1400,
      height: 1000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(path.join("public/itinerary-photos", item.filename));
  library.push({
    id: item.id,
    name: item.title,
    destination: item.location,
    src: "/itinerary-photos/" + item.filename,
    credit:
      item.author +
      " · " +
      item.license +
      " · Resized and cropped for brochure display",
    source: item.sourceUrl,
    license_url: item.licenseUrl,
  });
}
await writeFile(
  "src/lib/itineraries/photo-library.ts",
  "// Preserved source photographs with attribution from the supplied legacy tool.\nexport const photoLibrary = " +
    JSON.stringify(library, null, 2) +
    " as const;\n",
);
console.log(
  "Preserved " + library.length + " optimized destination photographs.",
);
