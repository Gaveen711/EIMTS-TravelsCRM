import "server-only";
import { cookies } from 'next/headers';
import { localLoginEnabled, verifyLocalSession, localCookie } from './local';
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { canAccess, canManage, isRole, type Permission } from "./permissions";
export const requireProfile = cache(async () => {
  if (localLoginEnabled()) {
    if (!verifyLocalSession((await cookies()).get(localCookie)?.value)) redirect("/login");
    return { id: "00000000-0000-4000-8000-000000000001", email: "admin@local.invalid", full_name: "Admin", role: "admin" as const };
  }
  if (!supabaseConfig()) redirect("/login?reason=setup");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role, is_active").eq("id", user.id).single();
  if (!profile?.is_active || !isRole(profile.role)) redirect("/login?reason=access");
  return { id: user.id, email: user.email, full_name: profile.full_name as string, role: profile.role };
});
export async function requirePermission(permission: Permission) {
  const profile = await requireProfile();
  if (!canAccess(profile.role, permission)) redirect("/dashboard?reason=permission");
  return profile;
}
export async function requireManagePermission(permission: Permission) {
  const profile = await requireProfile();
  if (!canManage(profile.role, permission)) throw new Error("You do not have permission to change these records.");
  return profile;
}
