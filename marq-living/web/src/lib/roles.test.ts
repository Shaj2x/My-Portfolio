import { describe, expect, it } from "vitest";
import { canAccess, homeFor, isPublicPath, safeNext } from "./roles";

describe("homeFor", () => {
  it("sends unapproved users to the status page", () => {
    expect(homeFor(null)).toBe("/pending");
    expect(homeFor({ role: "tenant", status: "pending" })).toBe("/pending");
    expect(homeFor({ role: "staff", status: "suspended" })).toBe("/pending");
    expect(homeFor({ role: "admin", status: "rejected" })).toBe("/pending");
  });

  it("sends approved users to their area", () => {
    expect(homeFor({ role: "tenant", status: "approved" })).toBe("/home");
    expect(homeFor({ role: "driver", status: "approved" })).toBe("/driver");
    expect(homeFor({ role: "staff", status: "approved" })).toBe("/staff");
    expect(homeFor({ role: "admin", status: "approved" })).toBe("/staff");
  });
});

describe("canAccess", () => {
  const approved = (role: "tenant" | "staff" | "driver" | "admin") => ({ role, status: "approved" as const });

  it("keeps tenants out of staff, driver and admin areas", () => {
    expect(canAccess(approved("tenant"), "tenant")).toBe(true);
    expect(canAccess(approved("tenant"), "staff")).toBe(false);
    expect(canAccess(approved("tenant"), "driver")).toBe(false);
    expect(canAccess(approved("tenant"), "admin")).toBe(false);
  });

  it("lets staff drive but not administer", () => {
    expect(canAccess(approved("staff"), "staff")).toBe(true);
    expect(canAccess(approved("staff"), "driver")).toBe(true);
    expect(canAccess(approved("staff"), "admin")).toBe(false);
  });

  it("limits drivers to the driver screen", () => {
    expect(canAccess(approved("driver"), "driver")).toBe(true);
    expect(canAccess(approved("driver"), "staff")).toBe(false);
  });

  it("gives admins everything except the tenant area", () => {
    expect(canAccess(approved("admin"), "admin")).toBe(true);
    expect(canAccess(approved("admin"), "staff")).toBe(true);
    expect(canAccess(approved("admin"), "tenant")).toBe(false);
  });

  it("denies anyone not approved", () => {
    expect(canAccess({ role: "admin", status: "suspended" }, "admin")).toBe(false);
    expect(canAccess({ role: "tenant", status: "pending" }, "tenant")).toBe(false);
    expect(canAccess(null, "tenant")).toBe(false);
  });
});

describe("isPublicPath", () => {
  it("matches auth pages and email-link routes only", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/signup")).toBe(true);
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/staff")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/account/password")).toBe(false);
  });
});

describe("safeNext", () => {
  it("allows same-origin paths", () => {
    expect(safeNext("/staff/approvals")).toBe("/staff/approvals");
    expect(safeNext("/staff/residents?floor=5")).toBe("/staff/residents?floor=5");
  });

  it("rejects open redirects and loops", () => {
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext("/login")).toBeNull();
    expect(safeNext("")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});
