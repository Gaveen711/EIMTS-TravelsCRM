import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
export const loadCompany = cache(async () => {
  const db = await createClient();
  const { data, error } = await db
    .from("settings")
    .select("company_name,logo_path,default_currency")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error("Company details could not be loaded. Try again.");
  return data;
});
