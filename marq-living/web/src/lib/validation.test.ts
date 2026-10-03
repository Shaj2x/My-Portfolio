import { describe, expect, it } from "vitest";
import { fieldErrors, inviteSchema, newPasswordSchema, signUpSchema } from "./validation";

const valid = {
  fullName: "  Alice Tenant ",
  email: " Alice@Example.COM ",
  password: "correct-horse",
  unit: "1204",
  roomLetter: "b",
  floor: "12",
};

describe("signUpSchema", () => {
  it("normalizes a valid sign-up", () => {
    const r = signUpSchema.parse(valid);
    expect(r).toEqual({
      fullName: "Alice Tenant",
      email: "alice@example.com",
      password: "correct-horse",
      unit: "1204",
      roomLetter: "B",
      floor: 12,
    });
  });

  it("matches the database's unit, room and floor rules", () => {
    const errs = (patch: Partial<typeof valid>) => {
      const r = signUpSchema.safeParse({ ...valid, ...patch });
      return r.success ? {} : fieldErrors(r.error);
    };
    expect(errs({ unit: "12" })).toHaveProperty("unit");
    expect(errs({ unit: "12A" })).toHaveProperty("unit");
    expect(errs({ roomLetter: "G" })).toHaveProperty("roomLetter");
    expect(errs({ roomLetter: "AB" })).toHaveProperty("roomLetter");
    expect(errs({ floor: "0" })).toHaveProperty("floor");
    expect(errs({ floor: "41" })).toHaveProperty("floor");
    expect(errs({ floor: "2.5" })).toHaveProperty("floor");
    expect(errs({ password: "short" })).toHaveProperty("password");
    expect(errs({ email: "nope" })).toHaveProperty("email");
    expect(errs({ fullName: "   " })).toHaveProperty("fullName");
  });
});

describe("inviteSchema", () => {
  it("only invites staff, drivers and admins", () => {
    expect(inviteSchema.safeParse({ email: "a@b.co", fullName: "A", role: "driver" }).success).toBe(true);
    expect(inviteSchema.safeParse({ email: "a@b.co", fullName: "A", role: "tenant" }).success).toBe(false);
  });
});

describe("newPasswordSchema", () => {
  it("requires matching passwords", () => {
    expect(newPasswordSchema.safeParse({ password: "abcdefgh", confirm: "abcdefgh" }).success).toBe(true);
    const r = newPasswordSchema.safeParse({ password: "abcdefgh", confirm: "abcdefgx" });
    expect(r.success ? {} : fieldErrors(r.error)).toHaveProperty("confirm");
  });
});
