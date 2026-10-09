import { z } from "zod";
export const loginSchema = z.object({ email: z.string().trim().max(254).pipe(z.email("Enter a valid email address.")), password: z.string().min(1, "Enter your password.").max(128) });
export const forgotPasswordSchema = loginSchema.pick({ email: true });
export const resetPasswordSchema = z.object({ password: z.string().min(12, "Use at least 12 characters.").max(128), confirmPassword: z.string() }).refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "Passwords must match." });
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/dashboard";
  try { const decoded = decodeURIComponent(value); if (decoded.startsWith("//") || /[\\\r\n]/.test(decoded)) return "/dashboard";
    const url = new URL(decoded, "https://workspace.invalid");
    if (url.origin !== "https://workspace.invalid" || /^\/(login|forgot-password|reset-password|auth)(\/|$)/.test(url.pathname)) return "/dashboard";
    return url.pathname + url.search;
  } catch { return "/dashboard"; }
}
