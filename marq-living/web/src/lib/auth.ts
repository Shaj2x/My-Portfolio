import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccess, homeFor, type Area } from "@/lib/roles";
import type { Profile } from "@/lib/database.types";

/**
 * The signed-in user's profile, or null when signed out. Verified against
 * Supabase Auth (getClaims checks the JWT), then read through RLS.
 * Cached per request.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return null;

  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).single();
  if (error) {
    // A signed-in user without a profile means the sign-up trigger failed.
    console.error("profile lookup failed", error.message);
    return null;
  }
  return data;
});

/** Signed in, any status. For the pending screen and account settings. */
export async function requireUser(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

/**
 * Signed in, approved, and allowed in `area`. Everyone else is sent to the
 * page that fits them. Use in every page and Server Action of that area —
 * layouts alone don't re-run on client navigation.
 */
export async function requireRole(area: Area): Promise<Profile> {
  const profile = await requireUser();
  if (!canAccess(profile, area)) redirect(homeFor(profile));
  return profile;
}
