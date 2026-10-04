"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export function StaffNav({ pendingCount, openTickets = 0, isAdmin }: { pendingCount: number; openTickets?: number; isAdmin: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/staff", label: "Overview" },
    { href: "/staff/approvals", label: "Approvals", count: pendingCount },
    { href: "/staff/residents", label: "Residents" },
    { href: "/staff/shuttle", label: "Shuttle" },
    { href: "/staff/announcements", label: "News" },
    { href: "/staff/tickets", label: "Tickets", count: openTickets },
    { href: "/staff/amenities", label: "Amenities" },
    { href: "/staff/energy", label: "Energy" },
    { href: "/staff/rooms", label: "Rooms" },
    ...(isAdmin ? [{ href: "/staff/team", label: "Team" }] : []),
  ];
  return (
    <nav aria-label="Staff" className="-mx-4 overflow-x-auto border-b border-line px-4">
      <ul className="flex gap-1">
        {items.map((item) => {
          const active = item.href === "/staff" ? path === "/staff" : path.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm",
                  active ? "border-brand font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink",
                )}
              >
                {item.label}
                {item.count ? (
                  <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-white">{item.count}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
