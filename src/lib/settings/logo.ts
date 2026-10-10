import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
export function logoMime(bytes: Uint8Array) {
  if (
    bytes[0] === 0x89 &&
    Buffer.from(bytes.slice(1, 8)).equals(
      Buffer.from([80, 78, 71, 13, 10, 26, 10]),
    )
  )
    return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" &&
    Buffer.from(bytes.slice(8, 12)).toString() === "WEBP"
  )
    return "image/webp";
  return null;
}
export async function storeDevelopmentLogo(bytes: Uint8Array) {
  const name = createHash("sha256").update(bytes).digest("hex") + ".image",
    directory = resolve(
      process.env.CRM_LOCAL_DATA_DIR || ".crm-data",
      "company-logos",
    );
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, name), bytes);
  return name;
}
export async function readDevelopmentLogo(name: string) {
  if (!/^[a-f0-9]{64}\.image$/.test(name)) throw new Error("Invalid logo");
  return readFile(
    resolve(
      process.env.CRM_LOCAL_DATA_DIR || ".crm-data",
      "company-logos",
      name,
    ),
  );
}
