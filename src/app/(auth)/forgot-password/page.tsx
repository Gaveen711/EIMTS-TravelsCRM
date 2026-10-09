import { AuthForm } from "@/components/auth/auth-form";
import { supabaseConfig } from "@/lib/supabase/config";
export default function ForgotPasswordPage() { return <div className="auth-card"><span className="eyebrow">Account recovery</span><h2>Forgot your password?</h2><p className="auth-intro">Enter your team email and we’ll send a recovery link.</p><AuthForm mode="forgot" configured={Boolean(supabaseConfig())} /></div>; }
