import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/roles";
import { Badge, Button, Card } from "@/components/ui";
import type { AppRole } from "@/lib/types";
import { changeRole, reviewAccount } from "../actions";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Team" };

const ASSIGNABLE: AppRole[] = ["staff", "driver", "admin"];

export default async function TeamPage() {
  const me = await requireRole("admin");
  const supabase = await createClient();
  const { data: team, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status")
    .neq("role", "tenant")
    .order("role")
    .order("full_name");
  if (error) throw new Error(error.message);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="mt-1 text-sm text-ink-2">
          Staff, drivers and admins join by invite only. They set a password from the email link.
        </p>
      </div>
      <Card>
        <h2 className="mb-3 font-medium">Invite someone</h2>
        <InviteForm />
      </Card>
      <Card className="p-0">
        <ul className="divide-y divide-line">
          {team.map((m) => {
            const isMe = m.id === me.id;
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {m.full_name} {isMe ? <Badge>You</Badge> : null}{" "}
                    {m.status !== "approved" ? <Badge tone="bad">{m.status}</Badge> : null}
                  </p>
                  <p className="text-sm text-ink-2 break-all">{m.email}</p>
                </div>
                {isMe ? (
                  <Badge tone="brand">{ROLE_LABEL[m.role]}</Badge>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={changeRole} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <label className="sr-only" htmlFor={`role-${m.id}`}>
                        Role for {m.full_name}
                      </label>
                      <select
                        id={`role-${m.id}`}
                        name="role"
                        defaultValue={m.role}
                        className="min-h-11 rounded-lg border border-line bg-surface px-2 text-sm"
                      >
                        {ASSIGNABLE.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" variant="secondary">
                        Save
                      </Button>
                    </form>
                    <form action={reviewAccount}>
                      <input type="hidden" name="id" value={m.id} />
                      {m.status === "approved" ? (
                        <Button type="submit" name="decision" value="suspended" variant="danger">
                          Suspend
                        </Button>
                      ) : (
                        <Button type="submit" name="decision" value="approved" variant="secondary">
                          Reinstate
                        </Button>
                      )}
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
