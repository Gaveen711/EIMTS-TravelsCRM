import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const env = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SEED_ADMIN_EMAIL: z.email(),
  SEED_ADMIN_PASSWORD: z.string().min(12).max(128),
  SEED_ADMIN_NAME: z.string().min(1).max(160).default('CRM Administrator'),
}).parse(process.env);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedAdmin() {
  // Paginate instead of assuming the initial admin is in the first page.
  let existing: { id: string } | undefined;
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    existing = data.users.find((user) => user.email?.toLowerCase() === env.SEED_ADMIN_EMAIL.toLowerCase());
    if (existing || data.users.length < 100) break;
  }
  if (existing) {
    const { data: profile, error } = await db.from('profiles').select('role,is_active').eq('id', existing.id).maybeSingle();
    if (error) throw error;
    if (!profile || profile.role !== 'admin' || !profile.is_active) {
      throw new Error('Existing account is not an active administrator. Refusing automatic privilege escalation; use a new bootstrap email.');
    }
    console.log('Initial administrator already exists. Password and profile were left unchanged.');
    return;
  }
  const { data, error } = await db.auth.admin.createUser({
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: env.SEED_ADMIN_NAME },
  });
  if (error || !data.user) throw error ?? new Error('Admin user was not created');
  const { error: profileError } = await db.from('profiles').insert({
    id: data.user.id, full_name: env.SEED_ADMIN_NAME, role: 'admin', is_active: true,
  });
  if (profileError) {
    // Roll back Auth provisioning if the migration/profile insert failed.
    const { error: cleanupError } = await db.auth.admin.deleteUser(data.user.id);
    if (cleanupError) throw new Error('Profile creation and rollback failed. Inspect the bootstrap user in Supabase Auth before retrying.');
    throw profileError;
  }
  console.log('Initial administrator created. Sign in with SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD from your local environment.');
}

seedAdmin().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Admin seeding failed');
  process.exitCode = 1;
});
