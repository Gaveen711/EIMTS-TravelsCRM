/** PostgREST returns SQL DATE columns as calendar dates, not timestamps. */
const calendarDateKeys = new Set([
  "start_date",
  "end_date",
  "date",
  "valid_until",
  "issue_date",
  "due_date",
  "payment_date",
  "date_of_birth",
  "passport_expiry",
]);
export function serializeDevelopmentResponse(value: unknown) {
  return JSON.stringify(value, (key, item) =>
    calendarDateKeys.has(key) &&
    typeof item === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(item)
      ? item.slice(0, 10)
      : item,
  );
}
