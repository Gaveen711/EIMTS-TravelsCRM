export function renderEmailTemplate(
  template: string,
  values: Record<"customer" | "document" | "total" | "due_date", string>,
) {
  return template.replace(
    /\{\{(customer|document|total|due_date)\}\}/g,
    (_, key: keyof typeof values) => values[key],
  );
}
export function emailHtml(text: string) {
  return text
    .replace(
      /[&<>"']/g,
      (value) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[value]!,
    )
    .replace(/\r?\n/g, "<br>");
}
