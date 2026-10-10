"use server";
import { revalidatePath } from "next/cache";
import { requireManagePermission } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { itineraryPayload, itinerarySchema } from "./schema";
import { z } from "zod";
export async function saveItinerary(input: unknown, id?: string) {
  await requireManagePermission("itineraries");
  const parsed = itinerarySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (id && !z.uuid().safeParse(id).success)
    return { error: "Invalid itinerary." };
  try {
    const client = await createClient();
    const payload = itineraryPayload(parsed.data);
    const { data, error } = await client.rpc("save_itinerary", {
      p_itinerary: payload.header,
      p_days: payload.days,
      p_id: id ?? null,
    });
    if (error)
      return {
        error:
          "The itinerary could not be saved. Check the customer and try again.",
      };
    revalidatePath("/itineraries");
    if (id) revalidatePath("/itineraries/" + id);
    return { id: data as string };
  } catch {
    return { error: "Unable to connect. Your edits remain in this form." };
  }
}
export async function duplicateItinerary(id: string) {
  await requireManagePermission("itineraries");
  if (!z.uuid().safeParse(id).success) return { error: "Invalid itinerary." };
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("duplicate_itinerary", {
      p_id: id,
    });
    if (error) return { error: "The itinerary could not be duplicated." };
    revalidatePath("/itineraries");
    return { id: data as string };
  } catch {
    return { error: "Unable to connect. Please try again." };
  }
}
export async function setItineraryShare(id: string, enabled: boolean) {
  await requireManagePermission("itineraries");
  if (!z.uuid().safeParse(id).success || typeof enabled !== "boolean")
    return { error: "Invalid share request." };
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("set_itinerary_share", {
      p_id: id,
      p_enabled: enabled,
    });
    if (error) return { error: "Sharing could not be updated." };
    revalidatePath("/itineraries/" + id);
    return { token: data as string | null };
  } catch {
    return { error: "Unable to connect. Please try again." };
  }
}
