import type { AccountStatus, AppRole } from "@/lib/database.types";

// Pure routing rules for who lands where. Kept free of I/O so they can be
// unit-tested and shared by the proxy, pages and actions.

export const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth/"] as const;

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => (p.endsWith("/") ? path.startsWith(p) : path === p || path.startsWith(p + "/")));
}

export type RoutingProfile = { role: AppRole; status: AccountStatus };

/** Where a signed-in user belongs. */
export function homeFor(profile: RoutingProfile | null): string {
  if (!profile || profile.status !== "approved") return "/pending";
  switch (profile.role) {
    case "tenant":
      return "/home";
    case "driver":
      return "/driver";
    case "staff":
    case "admin":
      return "/staff";
  }
}

/** Which roles may open each area of the app. */
export const AREA_ROLES = {
  tenant: ["tenant"],
  driver: ["driver", "staff", "admin"],
  staff: ["staff", "admin"],
  admin: ["admin"],
} as const satisfies Record<string, readonly AppRole[]>;

export type Area = keyof typeof AREA_ROLES;

export function canAccess(profile: RoutingProfile | null, area: Area): boolean {
  return (
    !!profile &&
    profile.status === "approved" &&
    (AREA_ROLES[area] as readonly AppRole[]).includes(profile.role)
  );
}

/**
 * Sanitize a post-login `next` parameter: only same-origin absolute paths,
 * never protocol-relative ("//evil.com") or backslash tricks.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  if (isPublicPath(next.split("?")[0])) return null;
  return next;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  tenant: "Tenant",
  staff: "Staff",
  driver: "Driver",
  admin: "Admin",
};
