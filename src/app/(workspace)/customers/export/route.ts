import { requirePermission } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { exportCsv } from "@/lib/customers/csv";
import type { Customer } from "@/lib/customers/schema";

export async function GET(request: Request) {
  await requirePermission("customers");
  let csv: string;
  try {
    if (new URL(request.url).searchParams.get("template") === "1")
      csv = exportCsv([]);
    else {
      const client = await createClient();
      const rows: Customer[] = [];
      const cutoff = new Date().toISOString();
      let total = 1;
      while (rows.length < total) {
        const result = await client
          .from("customers")
          .select("*", { count: "exact" })
          .lte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .order("id")
          .range(rows.length, rows.length + 499);
        if (result.error || result.count === null)
          return new Response("Customers could not be exported. Try again.", {
            status: 503,
          });
        total = result.count;
        if (total > 5000)
          return new Response(
            "Export supports up to 5,000 customers. Ask your administrator for a database export.",
            { status: 422 },
          );
        if (!result.data?.length && rows.length < total)
          return new Response(
            "Customer data changed during export. Please try again.",
            { status: 409 },
          );
        rows.push(...(result.data ?? []));
      }
      csv = exportCsv(rows);
    }
  } catch {
    return new Response("Unable to export customers. Try again.", {
      status: 503,
    });
  }
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=customers.csv",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
