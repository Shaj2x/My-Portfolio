"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ruleSchema } from "@/lib/rules";
import type { Json } from "@/lib/database.types";

export async function saveRule(id: string | null, input: unknown): Promise<{ error?: string; ok?: boolean }> {
  const me = await requireRole("admin");
  const v = ruleSchema.safeParse(input);
  if (!v.success) return { error: v.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const r = v.data;
  const row = {
    name: r.name, description: r.description ?? null, priority: r.priority, enabled: r.enabled,
    trigger: r.trigger as Json, conditions: r.conditions as Json, actions: r.actions as Json, updated_by: me.id,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("automation_rules").update(row).eq("id", z.string().uuid().parse(id))
    : await supabase.from("automation_rules").insert({ ...row, created_by: me.id });
  if (error) return { error: error.message };
  revalidatePath("/staff/rules");
  return { ok: true };
}

export async function toggleRule(fd: FormData) {
  await requireRole("admin");
  await (await createClient()).from("automation_rules")
    .update({ enabled: fd.get("enabled") === "true" }).eq("id", z.string().uuid().parse(fd.get("id")));
  revalidatePath("/staff/rules");
}

export async function deleteRule(fd: FormData) {
  await requireRole("admin");
  await (await createClient()).from("automation_rules").delete().eq("id", z.string().uuid().parse(fd.get("id")));
  revalidatePath("/staff/rules");
}
