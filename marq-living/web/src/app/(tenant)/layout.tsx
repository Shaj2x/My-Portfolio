import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { TenantNav } from "@/components/tenant-nav";
import { AlertBanner } from "@/components/alert-banner";
import { nowMs } from "@/lib/clock";

export default async function TenantLayout({ children }: LayoutProps<"/">) {
  const profile = await requireRole("tenant");
  const supabase = await createClient();
  const { data: alerts } = await supabase
    .from("notifications")
    .select("id, title, body, url, kind, created_at")
    .eq("urgent", true)
    .is("read_at", null)
    .gte("created_at", new Date(nowMs() - 24 * 3600 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <>
      <AppHeader profile={profile} homeHref="/home" />
      <AlertBanner userId={profile.id} initial={alerts ?? []} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5">{children}</main>
      <TenantNav />
    </>
  );
}
