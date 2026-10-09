import { AuthForm } from "@/components/auth/auth-form";
import { supabaseConfig } from "@/lib/supabase/config";
export default function ResetPasswordPage() { return <div className="auth-card"><span className="eyebrow">A fresh start</span><h2>Set a new password</h2><p className="auth-intro">Choose a unique password with at least 12 characters. Open this page using your recovery email.</p><AuthForm mode="reset" configured={Boolean(supabaseConfig())} /></div>; }
