"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dispatchNotifications } from "@/lib/notify";
import { fieldErrors } from "@/lib/validation";
import { localToUtc } from "@/lib/format";
import type { FormState } from "@/app/(auth)/actions";

export async function markAnnouncementsRead(ids: string[]) {
  const me = await requireUser();
  const valid = ids.filter((id) => z.string().uuid().safeParse(id).success).slice(0, 100);
  if (!valid.length) return;
  await (await createClient())
    .from("announcement_reads")
    .upsert(valid.map((id) => ({ announcement_id: id, user_id: me.id })), { onConflict: "announcement_id,user_id", ignoreDuplicates: true });
}

const postSchema = z
  .object({
    title: z.string().trim().min(1, "Add a title").max(160),
    body: z.string().trim().min(1, "Write the announcement").max(5000),
    category: z.enum(["maintenance", "events", "safety", "general"]),
    audience: z.enum(["building", "floors", "units"]),
    floors: z.string().trim().optional(),
    units: z.string().trim().optional(),
    urgent: z.boolean(),
    publishDate: z.string().optional(),
    publishTime: z.string().optional(),
    expiresDate: z.string().optional(),
  })
  .transform((v, ctx) => {
    const floors = (v.floors ?? "").split(/[\s,]+/).filter(Boolean).map(Number);
    const units = (v.units ?? "").split(/[\s,]+/).filter(Boolean).map((u) => u.toUpperCase());
    if (v.audience === "floors" && (!floors.length || floors.some((f) => !Number.isInteger(f) || f < 1 || f > 40)))
      ctx.addIssue({ code: "custom", path: ["floors"], message: "List floors 1–40, e.g. 5, 7" });
    if (v.audience === "units" && (!units.length || units.some((u) => !/^[0-9]{3,4}$/.test(u))))
      ctx.addIssue({ code: "custom", path: ["units"], message: "List units, e.g. 502, 1204" });
    const publishAt = v.publishDate ? localToUtc(v.publishDate, v.publishTime || "08:00") : null;
    const expiresAt = v.expiresDate ? localToUtc(v.expiresDate, "23:59") : null;
    if (publishAt && expiresAt && expiresAt <= publishAt) ctx.addIssue({ code: "custom", path: ["expiresDate"], message: "Expiry must be after publishing" });
    return { ...v, floors, units, publishAt, expiresAt };
  });

export async function createAnnouncement(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireRole("staff");
  const raw = Object.fromEntries(["title", "body", "category", "audience", "floors", "units", "publishDate", "publishTime", "expiresDate"].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = postSchema.safeParse({ ...raw, urgent: formData.get("urgent") === "on" });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const v = parsed.data;
  const { error } = await (await createClient()).from("announcements").insert({
    title: v.title,
    body: v.body,
    category: v.category,
    audience: v.audience,
    target_floors: v.audience === "floors" ? v.floors : [],
    target_units: v.audience === "units" ? v.units : [],
    urgent: v.urgent,
    publish_at: (v.publishAt ?? new Date()).toISOString(),
    expires_at: v.expiresAt?.toISOString() ?? null,
    created_by: me.id,
  });
  if (error) return { message: error.message, values: raw };
  if (v.urgent) after(() => dispatchNotifications().catch((e) => console.error(e)));
  revalidatePath("/staff/announcements");
  return { done: true, message: v.publishAt && v.publishAt > new Date() ? "Scheduled." : v.urgent ? "Posted and pushed." : "Posted." };
}

export async function deleteAnnouncement(formData: FormData) {
  await requireRole("staff");
  const id = z.string().uuid().parse(formData.get("id"));
  await (await createClient()).from("announcements").delete().eq("id", id);
  revalidatePath("/staff/announcements");
}
