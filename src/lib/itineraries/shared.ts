import "server-only";
import { createClient as supabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { itineraryForm } from "./read";
import { developmentWorkspace } from "@/lib/development/config";
import type { DayRecord, ItineraryRecord } from "./schema";
export async function getSharedItinerary(token: string, includeBrand = false) {
  const config = supabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client =
    !developmentWorkspace() && config && key
      ? supabaseClient(config.url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : await createClient();
  const { data, error } = await client
    .from("itineraries")
    .select("*")
    .eq("share_token", token)
    .single();
  if (
    error ||
    !data ||
    !data.share_expires_at ||
    Date.parse(data.share_expires_at) <= Date.now()
  )
    return null;
  const { data: days, error: dayError } = await client
    .from("itinerary_days")
    .select("*")
    .eq("itinerary_id", data.id)
    .order("day_number");
  if (dayError) return null;
  const input = itineraryForm(data as ItineraryRecord, days as DayRecord[]);
  input.customer_id = "00000000-0000-4000-8000-000000000000";
  input.pricing = input.pricing.map((item) => ({
    ...item,
    cost: "0",
    supplier_id: "",
    service_id: "",
  }));
  const publicPhoto = (source: string) =>
    source.startsWith("/api/itineraries/photos/")
      ? "/share/" + token + "/photo/" + source.split("/").pop()
      : source;
  input.cover_image = publicPhoto(input.cover_image);
  input.days = input.days.map((day) => ({
    ...day,
    image_url: publicPhoto(day.image_url),
  }));
  // Fetch only public company identity, and only for the public page, not every photo request.
  const companyName = includeBrand
    ? (
        await client
          .from("settings")
          .select("company_name")
          .eq("id", 1)
          .maybeSingle()
      ).data?.company_name?.trim() || "Emerald Isle Travels"
    : undefined;
  return { ...input, companyName };
}
