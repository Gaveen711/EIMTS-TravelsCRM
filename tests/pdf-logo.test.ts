import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
const dependencies = vi.hoisted(() => ({
  development: vi.fn(),
  read: vi.fn(),
  download: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/development/config", () => ({
  developmentWorkspace: dependencies.development,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    storage: { from: () => ({ download: dependencies.download }) },
  }),
}));
vi.mock("@/lib/settings/logo", async (original) => ({
  ...(await original<typeof import("@/lib/settings/logo")>()),
  readDevelopmentLogo: dependencies.read,
}));
import { loadPdfLogo } from "@/lib/settings/pdf-logo";
const localPath = "a".repeat(64) + ".image";
const storagePath = "company/12345678-1234-1234-1234-123456789abc.png";
async function image() {
  return sharp({
    create: { width: 640, height: 320, channels: 4, background: "#146753" },
  })
    .png()
    .toBuffer();
}
beforeEach(() => {
  vi.clearAllMocks();
  dependencies.development.mockReturnValue(true);
});
describe("Bounded PDF company logo loading", () => {
  it("rejects remote URLs, traversal and unsupported paths before reading any bytes", async () => {
    for (const mode of [true, false]) {
      dependencies.development.mockReturnValue(mode);
      for (const path of [
        null,
        "https://example.com/logo.png",
        "../company/logo.png",
        "company/logo.svg",
      ])
        expect(await loadPdfLogo(path)).toBeNull();
    }
    expect(dependencies.read).not.toHaveBeenCalled();
    expect(dependencies.download).not.toHaveBeenCalled();
  });
  it("normalizes and shrinks an owned image to a PNG data URI", async () => {
    dependencies.read.mockResolvedValue(await image());
    const result = await loadPdfLogo(localPath);
    expect(result).toMatch(/^data:image\/png;base64,/);
    const metadata = await sharp(
      Buffer.from(result!.split(",")[1], "base64"),
    ).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(160);
    expect(metadata.height).toBe(80);
  });
  it("fails gracefully for corrupt, missing and oversized local images", async () => {
    dependencies.read.mockRejectedValueOnce(new Error("Missing"));
    expect(await loadPdfLogo(localPath)).toBeNull();
    dependencies.read.mockResolvedValueOnce(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
    );
    expect(await loadPdfLogo(localPath)).toBeNull();
    dependencies.read.mockResolvedValueOnce(Buffer.alloc(2097153));
    expect(await loadPdfLogo(localPath)).toBeNull();
  });
  it("downloads a guarded private storage object and tolerates provider failure", async () => {
    dependencies.development.mockReturnValue(false);
    dependencies.download.mockResolvedValueOnce({
      data: new Blob([new Uint8Array(await image())]),
      error: null,
    });
    expect(await loadPdfLogo(storagePath)).toMatch(/^data:image\/png;base64,/);
    expect(dependencies.download).toHaveBeenCalledWith(storagePath);
    dependencies.download.mockResolvedValueOnce({
      data: null,
      error: new Error("Missing"),
    });
    expect(await loadPdfLogo(storagePath)).toBeNull();
  });
});
