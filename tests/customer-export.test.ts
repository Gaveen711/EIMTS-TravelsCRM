import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/authorize", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { requirePermission } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { GET } from "@/app/(workspace)/customers/export/route";
import { emptyCustomer } from "@/lib/customers/schema";
const range = vi.fn();
const query = { select: vi.fn(), lte: vi.fn(), order: vi.fn(), range };
const from = vi.fn(() => query);
beforeEach(() => {
  vi.clearAllMocks();
  query.select.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  query.order.mockReturnValue(query);
  vi.mocked(createClient).mockResolvedValue({ from } as unknown as Awaited<
    ReturnType<typeof createClient>
  >);
  vi.mocked(requirePermission).mockResolvedValue({
    id: "fixture",
    full_name: "Staff",
    role: "admin",
    email: "staff@example.test",
  });
});
const rows = (start: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    ...emptyCustomer,
    name: "Customer " + (start + i),
    tags: [],
  }));
describe("customer CSV export", () => {
  it("exports all records even when API response caps are smaller than requested ranges", async () => {
    range
      .mockResolvedValueOnce({ data: rows(0, 100), count: 215, error: null })
      .mockResolvedValueOnce({ data: rows(100, 100), count: 215, error: null })
      .mockResolvedValueOnce({ data: rows(200, 15), count: 215, error: null });
    const response = await GET(
      new Request("http://localhost/customers/export"),
    );
    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain("Customer 214");
    expect(csv.split("\r\n")).toHaveLength(216);
    expect(range.mock.calls).toEqual([
      [0, 499],
      [100, 599],
      [200, 699],
    ]);
  });
  it("fails explicitly instead of silently truncating oversized exports", async () => {
    range.mockResolvedValueOnce({ data: rows(0, 1), count: 5001, error: null });
    expect(
      (await GET(new Request("http://localhost/customers/export"))).status,
    ).toBe(422);
  });
  it("requires customer access before reading any records", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(
      new Error("Permission denied"),
    );
    await expect(
      GET(new Request("http://localhost/customers/export")),
    ).rejects.toThrow("Permission denied");
    expect(from).not.toHaveBeenCalled();
  });
});
