import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import {
  developmentWorkspace,
  developmentAdminId,
} from "@/lib/development/config";
import { canAccess, canManage, isRole, type Permission } from "./permissions";
export const requireProfile = cache(async () => {
  if (developmentWorkspace())
    return {
      id: developmentAdminId,
      email: undefined,
      full_name: "Travel consultant",
      role: "admin" as const,
    };
  if (!supabaseConfig()) redirect("/access-required");
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/access-required");
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,full_name,role,is_active")
    .eq("id", user.id)
    .single();
  if (!profile?.is_active || !isRole(profile.role))
    redirect("/access-required");
  return {
    id: user.id,
    email: user.email,
    full_name: profile.full_name as string,
    role: profile.role,
  };
});
export async function requirePermission(permission: Permission) {
  const profile = await requireProfile();
  if (!canAccess(profile.role, permission))
    redirect("/dashboard?reason=permission");
  return profile;
}
export async function requireManagePermission(permission: Permission) {
  const profile = await requireProfile();
  if (!canManage(profile.role, permission))
    throw new Error("You do not have permission to change these records.");
  return profile;
}
