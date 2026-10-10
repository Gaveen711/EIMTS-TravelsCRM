import { expect, test } from "vitest";
import { serializeDevelopmentResponse } from "../src/lib/development/serialize";
test("local date columns match hosted PostgREST calendar dates and preserve timestamps", () => {
  const timestamp = new Date("2027-02-12T00:00:00.000Z");
  const value = JSON.parse(
    serializeDevelopmentResponse({
      start_date: timestamp,
      end_date: timestamp,
      created_at: timestamp,
      share_expires_at: timestamp,
      travelers: [{ date_of_birth: timestamp, passport_expiry: null }],
    }),
  );
  expect(value.start_date).toBe("2027-02-12");
  expect(value.end_date).toBe("2027-02-12");
  expect(value.created_at).toBe("2027-02-12T00:00:00.000Z");
  expect(value.share_expires_at).toBe("2027-02-12T00:00:00.000Z");
  expect(value.travelers[0]).toEqual({
    date_of_birth: "2027-02-12",
    passport_expiry: null,
  });
});
test("existing calendar dates and exact numeric strings are unchanged", () => {
  expect(
    JSON.parse(
      serializeDevelopmentResponse({
        date: "2027-02-12",
        total_minor: "9007199254740991",
        quantity: "1.125",
      }),
    ),
  ).toEqual({
    date: "2027-02-12",
    total_minor: "9007199254740991",
    quantity: "1.125",
  });
});
