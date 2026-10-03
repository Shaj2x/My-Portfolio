// Public Supabase settings. Read lazily so a missing value fails with a clear
// message at request time instead of breaking the build.
export function supabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set (see web/.env.example)");
  return v;
}

export function supabasePublishableKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!v) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set (see web/.env.example)");
  return v;
}

// Server-only. Bypasses RLS: use only for admin operations after checking the
// caller's role, never with input you haven't validated.
export function supabaseSecretKey(): string {
  const v = process.env.SUPABASE_SECRET_KEY;
  if (!v) throw new Error("SUPABASE_SECRET_KEY is not set (needed to invite staff)");
  return v;
}
