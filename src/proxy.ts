import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { localLoginEnabled, verifyLocalSession, localCookie } from '@/lib/auth/local';
const publicPaths = new Set(["/login", "/forgot-password", "/reset-password", "/auth/callback"]);
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = supabaseConfig();
  const isPublic = publicPaths.has(request.nextUrl.pathname);
  const toLogin = (reason?: string) => {
    const url = request.nextUrl.clone(); url.pathname = "/login"; url.search = "";
    if (reason) url.searchParams.set("reason", reason);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  };
  if (localLoginEnabled()) {
    response.headers.set("Cache-Control", "private, no-store");
    return isPublic || verifyLocalSession(request.cookies.get(localCookie)?.value) ? response : toLogin();
  }
  if (!config) return isPublic ? response : toLogin("setup");
  const supabase = createServerClient(config.url, config.key, { cookies: { getAll: () => request.cookies.getAll(), setAll(values) { values.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); response.headers.set("Cache-Control", "private, no-store"); } } });
  const { data, error } = await supabase.auth.getClaims();
  if ((!data?.claims || error) && !isPublic) return toLogin();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"] };
