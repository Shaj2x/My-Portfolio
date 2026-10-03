import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

// Entry point: send each user to their area.
export default async function Index() {
  const profile = await getProfile();
  redirect(profile ? homeFor(profile) : "/login");
}
