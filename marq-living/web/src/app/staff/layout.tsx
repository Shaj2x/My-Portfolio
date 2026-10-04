import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { StaffNav } from "./staff-nav";

export default async function StaffLayout({ children }: LayoutProps<"/staff">) {
  const profile = await requireRole("staff");
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  const { count: openTickets } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  return (
    <>
      <AppHeader profile={profile} homeHref="/staff" />
      <div className="mx-auto w-full max-w-5xl px-4">
        <StaffNav pendingCount={count ?? 0} openTickets={openTickets ?? 0} isAdmin={profile.role === "admin"} />
        <main className="py-6">{children}</main>
      </div>
    </>
  );
}
