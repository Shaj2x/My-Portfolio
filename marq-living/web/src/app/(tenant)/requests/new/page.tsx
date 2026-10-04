import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { NewRequestForm } from "./new-request-form";

export const metadata: Metadata = { title: "New request" };

export default async function NewRequestPage() {
  const me = await requireRole("tenant");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">New request</h1>
      <NewRequestForm userId={me.id} />
    </div>
  );
}
