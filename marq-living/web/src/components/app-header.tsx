import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { Badge, Logo } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/roles";
import type { Profile } from "@/lib/database.types";

export function AppHeader({ profile, homeHref = "/" }: { profile: Profile; homeHref?: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link href={homeHref} aria-label="Marq Living home">
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          {profile.role !== "tenant" ? <Badge tone="brand">{ROLE_LABEL[profile.role]}</Badge> : null}
          <form action={signOut}>
            <button type="submit" className="min-h-11 px-2 text-sm text-ink-2 hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
