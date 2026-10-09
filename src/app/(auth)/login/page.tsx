import { AuthForm } from "@/components/auth/auth-form";
import { supabaseConfig } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/auth/validation";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const params = await searchParams;
  const messages: Record<string, string> = { access: "Your account is inactive or has no assigned role. Contact your administrator.", "password-updated": "Your password was updated. Sign in with your new password.", "recovery-expired": "This recovery link is invalid or expired. Request a new link." };
  return <div className="auth-card"><span className="eyebrow">Your agency, connected</span><h2>Welcome back</h2><p className="auth-intro">Sign in to manage your next great journey.</p>{params.reason && messages[params.reason] && <Alert className="mb-6"><AlertTitle>Account update</AlertTitle><AlertDescription>{messages[params.reason]}</AlertDescription></Alert>}<AuthForm mode="login" next={safeNextPath(params.next)} configured={Boolean(supabaseConfig())} /></div>;
}
