"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const ITEMS = [
  { href: "/home", label: "Home", icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/shuttle", label: "Shuttle", icon: "M5 17h14M6 17V7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v10M6 12h12M8 20v-3M16 20v-3" },
  { href: "/announcements", label: "News", icon: "M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5" },
  { href: "/requests", label: "Requests", icon: "M5 4h14v12H9l-4 4zM9 9h6M9 12h4" },
  { href: "/book", label: "Book", icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" },
] as const;

export function TenantNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {ITEMS.map((item) => {
          const active = path === item.href || path.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
                  active ? "font-semibold text-brand" : "text-ink-2",
                )}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
