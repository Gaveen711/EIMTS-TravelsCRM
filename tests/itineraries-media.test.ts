import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
vi.mock("server-only", () => ({}));
import {
  storePhoto,
  readPhoto,
  photoMime,
  photoName,
  maxPhotoBytes,
} from "@/lib/itineraries/media";
let temporary: string | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (temporary) {
    const base = resolve(".crm-test-data");
    if (!temporary.startsWith(base + sep))
      throw new Error("Unexpected media cleanup target");
    await rm(temporary, { recursive: true, force: true });
    temporary = undefined;
  }
});
describe("Persistent itinerary photos", () => {
  it("accepts only bounded JPEG/PNG signatures and UUID filenames", () => {
    expect(photoMime(new Uint8Array([255, 216, 255, 0]))).toBe("image/jpeg");
    expect(photoMime(new Uint8Array([60, 115, 118, 103]))).toBeNull();
    expect(photoMime(new Uint8Array(maxPhotoBytes + 1))).toBeNull();
    expect(photoName.test("../passport.jpg")).toBe(false);
  });
  it("persists local development uploads and safely reads only generated photo names", async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(resolve(".crm-test-data"), { recursive: true });
    temporary = await mkdtemp(resolve(".crm-test-data", "media-"));
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CRM_DEFER_AUTH", "true");
    vi.stubEnv("CRM_LOCAL_DATA_DIR", temporary);
    const image = new Uint8Array(
      await sharp({
        create: {
          width: 16,
          height: 16,
          channels: 4,
          background: { r: 21, g: 60, b: 50, alpha: 1 },
        },
      })
        .png()
        .toBuffer(),
    );
    const source = await storePhoto(image);
    expect(source).toMatch(/^\/api\/itineraries\/photos\/[a-f0-9-]+\.png$/);
    const stored = await readPhoto(source.split("/").pop()!);
    expect(stored?.mime).toBe("image/png");
    expect(stored?.bytes.byteLength).toBeGreaterThan(8);
    expect((await readPhoto(source.split("/").pop()!))?.bytes).toEqual(
      stored?.bytes,
    );
    expect(await readPhoto("../anything.png")).toBeNull();
    await expect(
      storePhoto(new Uint8Array([60, 115, 118, 103])),
    ).rejects.toThrow(/JPEG or PNG/);
  });
});
