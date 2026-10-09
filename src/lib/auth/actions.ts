"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { loginSchema, forgotPasswordSchema, resetPasswordSchema, safeNextPath } from "./validation";
import { isRole } from "./permissions";
export type AuthResult = { error?: string; success?: string };
const setupError = { error: "Your workspace needs Supabase configuration. Follow the setup steps in README.md." };
export async function loginAction(input: unknown, next: string): Promise<AuthResult> {
  const result = loginSchema.safeParse(input);
  if (!result.success) return { error: "Enter a valid email address and password." };
  if (!supabaseConfig()) return setupError;
  try {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(result.data);
  if (error || !data.user) return { error: "We couldn't sign you in. Check your email and password and try again." };
  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", data.user.id).single();
  if (!profile?.is_active || !isRole(profile.role)) { await supabase.auth.signOut(); return { error: "Your account does not have workspace access. Contact your administrator." }; }
  } catch { return { error: "We couldn't connect to your workspace. Please try again later." }; }
  redirect(safeNextPath(next));
}
export async function forgotPasswordAction(input: unknown): Promise<AuthResult> {
  const result = forgotPasswordSchema.safeParse(input);
  if (!result.success) return { error: "Enter a valid email address." };
  if (!supabaseConfig()) return setupError;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return { error: "Password recovery is not configured yet. Contact your administrator." };
  try {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(result.data.email, { redirectTo: `${appUrl.replace(/\/$/, "")}/auth/callback?next=/reset-password` });
  if (error) return { error: "We couldn't request a recovery email. Please try again later or contact your administrator." };
  return { success: "If this email has an account, you will receive a password recovery link. Check your inbox and spam folder." };
  } catch { return { error: "We couldn't request a recovery email. Please try again later." }; }
}
export async function resetPasswordAction(input: unknown): Promise<AuthResult> {
  const result = resetPasswordSchema.safeParse(input);
  if (!result.success) return { error: "Use matching passwords with at least 12 characters." };
  if (!supabaseConfig()) return setupError;
  try {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  if (error || !user || cookieStore.get("crm-recovery")?.value !== user.id) return { error: "Your recovery link is missing or expired. Request a new link." };
  const updated = await supabase.auth.updateUser({ password: result.data.password });
  if (updated.error) return { error: "We couldn't update your password. Request a new recovery link and try again." };
  cookieStore.delete("crm-recovery");
  await supabase.auth.signOut();
  } catch { return { error: "We couldn't update your password. Please try again later." }; }
  redirect("/login?reason=password-updated");
}
export async function logoutAction() {
  if (supabaseConfig()) { const supabase = await createClient(); const { error } = await supabase.auth.signOut(); if (error) throw new Error("Sign out failed. Please try again."); }
  (await cookies()).delete("crm-recovery");
  redirect("/login");
}
