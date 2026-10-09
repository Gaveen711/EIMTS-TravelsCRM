"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from "@/lib/auth/validation";
import { loginAction, forgotPasswordAction, resetPasswordAction, type AuthResult } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Icon } from "@/components/icon";
type Mode = "login" | "forgot" | "reset";
const schema = z.object({ email: z.string().optional(), password: z.string().optional(), confirmPassword: z.string().optional() });
type Values = z.infer<typeof schema>;
export function AuthForm({ mode, next = "/dashboard", configured, local = false }: { mode: Mode; next?: string; configured: boolean; local?: boolean }) {
  const [feedback, setFeedback] = useState<AuthResult>({});
  const [showPassword, setShowPassword] = useState(false);
  const modeSchema = schema.superRefine((values, context) => {
    const parsed = (mode === "login" ? (local ? z.object({ email: z.string().min(1, "Enter your username."), password: z.string().min(1, "Enter your password.") }) : loginSchema) : mode === "forgot" ? forgotPasswordSchema : resetPasswordSchema).safeParse(values);
    if (!parsed.success) parsed.error.issues.forEach((issue) => context.addIssue({ code: "custom", path: issue.path, message: issue.message }));
  });
  const form = useForm<Values>({ resolver: zodResolver(modeSchema), defaultValues: { email: "", password: "", confirmPassword: "" } });
  const submit = form.handleSubmit(async (values) => {
    setFeedback({});
    try { setFeedback(await (mode === "login" ? loginAction(values, next) : mode === "forgot" ? forgotPasswordAction(values) : resetPasswordAction(values))); }
    catch (error) { if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error; setFeedback({ error: "We couldn't connect. Please try again in a moment." }); }
  });
  return <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
    {!configured && !local && <Alert><Icon name="info-circle" /><AlertTitle>Workspace setup required</AlertTitle><AlertDescription>Connect your Supabase project to enable sign-in. Your administrator can follow README.md.</AlertDescription></Alert>}
    <FieldGroup>{local && <p className="text-sm text-muted-foreground">Local preview · Database features require Supabase configuration.</p>}
      {mode !== "reset" && <Field data-invalid={Boolean(form.formState.errors.email)}><FieldLabel htmlFor="email">{local ? "Username" : "Email address"}</FieldLabel><Input id="email" type={local ? "text" : "email"} autoComplete={local ? "username" : "email"} placeholder={local ? "admin" : "you@agency.com"} aria-invalid={Boolean(form.formState.errors.email)} aria-describedby={form.formState.errors.email ? "email-error" : undefined} {...form.register("email")} /><FieldError id="email-error" errors={[form.formState.errors.email]} /></Field>}
      {mode !== "forgot" && <Field data-invalid={Boolean(form.formState.errors.password)}><div className="flex items-center justify-between gap-3"><FieldLabel htmlFor="password">{mode === "reset" ? "New password" : "Password"}</FieldLabel><button type="button" onClick={() => setShowPassword(!showPassword)} className="text-xs text-muted-foreground underline underline-offset-4" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div><Input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "reset" ? "At least 12 characters" : "Enter your password"} aria-invalid={Boolean(form.formState.errors.password)} aria-describedby={form.formState.errors.password ? "password-error" : undefined} {...form.register("password")} /><FieldError id="password-error" errors={[form.formState.errors.password]} /></Field>}
      {mode === "reset" && <Field data-invalid={Boolean(form.formState.errors.confirmPassword)}><FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel><Input id="confirmPassword" type="password" autoComplete="new-password" aria-invalid={Boolean(form.formState.errors.confirmPassword)} {...form.register("confirmPassword")} /><FieldError errors={[form.formState.errors.confirmPassword]} /></Field>}
    </FieldGroup>
    {mode === "login" && <Link href="/forgot-password" className="self-end text-sm text-primary underline-offset-4 hover:underline">Forgot your password?</Link>}
    {(feedback.error || feedback.success) && <Alert variant={feedback.error ? "destructive" : "default"} role="status" aria-live="polite"><AlertTitle>{feedback.error ? "Please try again" : "Check your inbox"}</AlertTitle><AlertDescription>{feedback.error || feedback.success}</AlertDescription></Alert>}
    <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Please wait…" : mode === "login" ? "Sign in to your workspace" : mode === "forgot" ? "Send recovery link" : "Update password"}<Icon name="arrow-right" data-icon="inline-end" /></Button>
    {mode !== "login" && <Link href="/login" className="text-center text-sm text-muted-foreground underline underline-offset-4">Back to sign in</Link>}
  </form>;
}
