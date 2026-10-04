"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation";
import type { FormState } from "@/app/(auth)/actions";

const CATEGORIES = ["maintenance", "noise", "package", "lockout", "amenity", "shuttle", "other"] as const;

const ticketSchema = z.object({
  category: z.enum(CATEGORIES, { message: "Pick a category" }),
  subject: z.string().trim().min(1, "Add a short summary").max(160),
  description: z.string().trim().max(4000).default(""),
  photoPath: z.string().max(300).optional(),
});

export async function createTicket(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireRole("tenant");
  const values = Object.fromEntries(["category", "subject", "description"].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = ticketSchema.safeParse({ ...values, photoPath: formData.get("photoPath") || undefined });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const v = parsed.data;
  // The photo must be in the tenant's own storage folder (RLS enforces this too).
  if (v.photoPath && !v.photoPath.startsWith(`${me.id}/`)) return { message: "Photo upload failed. Try again.", values };

  const { data, error } = await (await createClient())
    .from("tickets")
    .insert({ tenant_id: me.id, unit: me.unit, category: v.category, subject: v.subject, description: v.description, photo_path: v.photoPath ?? null })
    .select("id")
    .single();
  if (error) return { message: error.message, values };
  revalidatePath("/requests");
  redirect(`/requests/${data.id}`);
}

const messageSchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(1, "Write a message").max(4000),
  internal: z.boolean(),
});

export async function postTicketMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  const parsed = messageSchema.safeParse({
    ticketId: formData.get("ticketId"),
    body: formData.get("body"),
    internal: formData.get("internal") === "on",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const isStaff = me.role === "staff" || me.role === "admin";
  const { error } = await (await createClient()).from("ticket_messages").insert({
    ticket_id: parsed.data.ticketId,
    author_id: me.id,
    body: parsed.data.body,
    internal: isStaff && parsed.data.internal,
  });
  if (error) return { message: error.code === "42501" ? "This request is closed. Open a new one." : error.message };
  revalidatePath(`/requests/${parsed.data.ticketId}`);
  revalidatePath(`/staff/tickets/${parsed.data.ticketId}`);
  return { done: true };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedTo: z.string().uuid().or(z.literal("")).optional(),
});

export async function updateTicket(formData: FormData) {
  await requireRole("staff");
  const v = updateSchema.parse({
    id: formData.get("id"),
    status: formData.get("status") || undefined,
    priority: formData.get("priority") || undefined,
    assignedTo: formData.get("assignedTo") ?? undefined,
  });
  const patch: { status?: typeof v.status; priority?: typeof v.priority; assigned_to?: string | null } = {};
  if (v.status) patch.status = v.status;
  if (v.priority) patch.priority = v.priority;
  if (v.assignedTo !== undefined) patch.assigned_to = v.assignedTo || null;
  const { error } = await (await createClient()).from("tickets").update(patch).eq("id", v.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/staff/tickets/${v.id}`);
  revalidatePath("/staff/tickets");
}
