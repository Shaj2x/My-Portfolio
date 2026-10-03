"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fieldErrors, inviteSchema } from "@/lib/validation";
import { siteOrigin } from "@/lib/site";
import type { FormState } from "@/app/(auth)/actions";

const reviewSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approved", "rejected", "suspended"]),
  note: z.string().trim().max(500).optional(),
});

// Runs as the staff member (RLS + the profile guard apply), so the database
// is what decides whether they may review this account.
export async function reviewAccount(formData: FormData) {
  await requireRole("staff");
  const input = reviewSchema.parse({
    id: formData.get("id"),
    decision: formData.get("decision"),
    note: formData.get("note") || undefined,
  });

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_tenant", {
    target: input.id,
    decision: input.decision,
    note: input.note ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/staff", "layout");
}

const roleSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["tenant", "staff", "driver", "admin"]),
});

export async function changeRole(formData: FormData) {
  await requireRole("admin");
  const input = roleSchema.parse({ id: formData.get("id"), role: formData.get("role") });

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", { target: input.id, new_role: input.role });
  if (error) throw new Error(error.message);

  revalidatePath("/staff", "layout");
}

// Staff, drivers and admins don't self-register: an admin invites them. The
// invite sets auth.users.invited_at, which the sign-up trigger trusts to
// create the account with the invited role, already approved.
export async function inviteMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  const values = {
    email: String(formData.get("email") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    role: String(formData.get("role") ?? ""),
  };
  const parsed = inviteSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const { email, fullName, role } = parsed.data;
  const { error } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, invited_role: role, invited_by: admin.id },
    redirectTo: `${await siteOrigin()}/account/password`,
  });
  if (error) {
    if (error.code === "email_exists") {
      return {
        errors: { email: "That email already has an account. Change its role in the list below instead." },
        values,
      };
    }
    console.error("invite failed", error.code, error.message);
    return { message: "The invite couldn't be sent. Try again.", values };
  }

  revalidatePath("/staff/team");
  return { done: true, message: `Invite sent to ${email}.` };
}
