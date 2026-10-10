import { describe, expect, it } from "vitest";
import {
  blankItinerary,
  itinerarySchema,
  itineraryPayload,
  endDate,
  routeStops,
  contrastOnWhite,
} from "@/lib/itineraries/schema";
const id = "10000000-0000-4000-8000-000000000001";
describe("Native itinerary contracts", () => {
  it("preserves exact minor amounts and explicit quantities for financial conversion", () => {
    const input = blankItinerary(id);
    input.pricing = [
      {
        description: "Hotel",
        quantity: "2.125",
        unit_price: "125.99",
        cost: "95.35",
        discount: "2.01",
        tax_rate: "10.5",
        service_id: "",
        supplier_id: "",
      },
    ];
    const payload = itineraryPayload(itinerarySchema.parse(input));
    expect(payload.header.legacy_content.pricing[0]).toEqual({
      description: "Hotel",
      quantity: "2.125",
      unit_price_minor: 12599,
      cost_minor: 9535,
      discount_minor: 201,
      tax_rate: "10.5",
      service_id: null,
      supplier_id: null,
    });
    expect(payload.header.traveler_count).toBe(2);
    expect(payload.days[0].day_number).toBe(1);
  });
  it("calculates travel dates across leap years without local timezone shifts", () => {
    expect(endDate("2028-02-28", 3)).toBe("2028-03-01");
    expect(endDate("2026-12-31", 2)).toBe("2027-01-01");
  });
  it("collapses only consecutive route stops and preserves custom order", () => {
    const input = blankItinerary(id);
    input.days = [
      { ...input.days[0], destination: "Colombo" },
      { ...input.days[0], destination: "Kandy" },
      { ...input.days[0], destination: "Kandy" },
      { ...input.days[0], destination: "Ella" },
    ];
    expect(routeStops(input)).toEqual(["Colombo", "Kandy", "Ella", "Colombo"]);
    expect(
      routeStops({
        ...input,
        route_mode: "custom",
        custom_stops: ["Sigiriya", "Kandy"],
      }),
    ).toEqual(["Colombo", "Sigiriya", "Kandy", "Colombo"]);
  });
  it("rejects invalid dates, light text colors, unsafe image schemes and excessive money precision", () => {
    const input = blankItinerary(id);
    for (const patch of [
      { start_date: "2026-02-30" },
      { primary_color: "#ffffff" },
      { primary_color: "not-a-color" },
      { cover_image: "javascript:alert(1)" },
      { days: [] },
    ])
      expect(itinerarySchema.safeParse({ ...input, ...patch }).success).toBe(
        false,
      );
    expect(contrastOnWhite("#153c32")).toBeGreaterThan(4.5);
    input.pricing = [
      {
        description: "Hotel",
        quantity: "1.0001",
        unit_price: "12.999",
        cost: "0",
        discount: "0",
        tax_rate: "0",
        service_id: "",
        supplier_id: "",
      },
    ];
    expect(itinerarySchema.safeParse(input).success).toBe(false);
  });
});
