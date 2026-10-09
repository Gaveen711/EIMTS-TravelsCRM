import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/auth/validation";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const recovery = request.nextUrl.searchParams.get("next") === "/reset-password";
  if (supabaseConfig() && code) {
    try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      if (recovery) (await cookies()).set("crm-recovery", data.user.id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
      const response = NextResponse.redirect(new URL(recovery ? "/reset-password" : safeNextPath(request.nextUrl.searchParams.get("next")), request.url));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    } catch { /* Invalid links and provider failures return to sign in safely. */ }
  }
  return NextResponse.redirect(new URL("/login?reason=recovery-expired", request.url));
}
