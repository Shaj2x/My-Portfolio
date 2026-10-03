import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/roles";

// Landing point for links in auth emails (confirm sign-up, invite, password
// reset) using the PKCE code flow.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next")) ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("code exchange failed", error.code, error.message);
  }

  const login = new URL("/login", origin);
  login.searchParams.set("error", searchParams.get("error_description") ?? "That link is invalid or has expired.");
  return NextResponse.redirect(login);
}
