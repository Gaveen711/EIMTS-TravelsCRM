import Link from "next/link";
import { requirePermission } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
export default async function ItinerariesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("itineraries");
  const params = await searchParams;
  const search =
    typeof params.q === "string"
      ? params.q.slice(0, 100).replace(/[%_,]/g, "")
      : "";
  const page = Math.max(
    1,
    Math.min(100000, parseInt(String(params.page)) || 1),
  );
  const client = await createClient();
  let query = client
    .from("itineraries")
    .select(
      "id,title,destination,start_date,end_date,traveler_count,updated_at",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range((page - 1) * 12, page * 12 - 1);
  if (search) query = query.ilike("title", "%" + search + "%");
  const { data, error, count } = await query;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Brochure studio</p>
          <h1 className="text-3xl font-semibold">Itineraries</h1>
          <p className="mt-2 text-muted-foreground">
            Save every journey. Reuse its services through the sales cycle.
          </p>
        </div>
        <Button asChild>
          <Link href="/itineraries/new">
            <Icon name="plus" />
            Create itinerary
          </Link>
        </Button>
      </header>
      <form className="flex gap-3">
        <input
          name="q"
          aria-label="Search itineraries"
          placeholder="Search trip title"
          defaultValue={search}
          className="min-w-0 flex-1 rounded-lg border bg-background p-2"
        />
        <Button variant="outline">Search</Button>
      </form>
      {error ? (
        <p role="alert">
          Itineraries could not be loaded. Refresh to try again.
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data?.map((record) => (
              <Link
                key={record.id}
                href={"/itineraries/" + record.id}
                className="flex flex-col gap-3 rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <Icon name="map" className="text-2xl text-primary" />
                <h2 className="font-semibold">{record.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {record.destination} · {record.traveler_count} travelers
                </p>
                <p className="text-xs text-muted-foreground">
                  {record.start_date} — {record.end_date}
                </p>
              </Link>
            ))}
          </div>
          {!data?.length && (
            <div className="rounded-xl border p-10 text-center text-muted-foreground">
              {search
                ? "No matching itineraries."
                : "Your next journey starts here. Create your first itinerary."}
            </div>
          )}
          <nav
            aria-label="Itinerary pages"
            className="flex justify-between text-sm"
          >
            <span>
              {count ?? 0} itineraries · Page {page}
            </span>
            <div className="flex gap-4">
              {page > 1 && (
                <Link
                  href={
                    "/itineraries?" +
                    new URLSearchParams({ q: search, page: String(page - 1) })
                  }
                >
                  Previous
                </Link>
              )}
              {page * 12 < (count ?? 0) && (
                <Link
                  href={
                    "/itineraries?" +
                    new URLSearchParams({ q: search, page: String(page + 1) })
                  }
                >
                  Next
                </Link>
              )}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
