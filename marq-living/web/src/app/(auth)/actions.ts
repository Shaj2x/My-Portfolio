"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, signInSchema, signUpSchema } from "@/lib/validation";
import { safeNext } from "@/lib/roles";
import { siteOrigin } from "@/lib/site";
import { z } from "zod";

export type FormState = {
  errors?: Record<string, string>;
  message?: string;
  done?: boolean;
  values?: Record<string, string>;
};

function formValues(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { message: "Confirm your email first — check your inbox for the link.", values };
    }
    return { message: "Email or password is incorrect.", values };
  }

  redirect(safeNext(String(formData.get("next") ?? "")) ?? "/");
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["fullName", "email", "unit", "roomLetter", "floor"]);
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    unit: formData.get("unit"),
    roomLetter: formData.get("roomLetter"),
    floor: formData.get("floor"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const { fullName, email, password, unit, roomLetter, floor } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
      // Read by the handle_new_user trigger. Role and status are never taken
      // from here; every sign-up starts as a pending tenant.
      data: { full_name: fullName, unit, room_letter: roomLetter, floor: String(floor) },
    },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return { errors: { email: "An account with this email already exists. Sign in instead." }, values };
    }
    if (error.code === "weak_password") {
      return { errors: { password: error.message }, values };
    }
    console.error("sign-up failed", error.code, error.message);
    return { message: "We couldn't create your account. Check your details and try again.", values };
  }

  // Email confirmation off (local dev): session exists, go straight in.
  if (data.session) redirect("/pending");

  return { done: true, message: email };
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: signInSchema.shape.email }).safeParse({ email: formData.get("email") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/account/password`,
  });
  if (error) console.error("password reset failed", error.code, error.message);
  // Same answer either way so this can't be used to probe for accounts.
  return { done: true, message: parsed.data.email };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
