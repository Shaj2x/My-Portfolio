import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { homeFor } from "@/lib/roles";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const profile = await getProfile();
  if (profile) redirect(homeFor(profile));

  const { next, error } = await searchParams;
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Sign in</h1>
      <LoginForm next={typeof next === "string" ? next : undefined} linkError={typeof error === "string" ? error : undefined} />
    </>
  );
}
