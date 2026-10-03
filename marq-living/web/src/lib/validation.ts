import { z } from "zod";

// Mirrors the CHECK constraints on public.profiles so users get a clear
// message before the database rejects the row.
export const UNIT_RE = /^[0-9]{3,4}$/;
export const ROOM_LETTER_RE = /^[A-F]$/;
export const MAX_FLOOR = 40;

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const password = z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters");

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter your name").max(120, "Name is too long"),
    email,
    password,
    unit: z.string().trim().regex(UNIT_RE, "Unit is 3–4 digits, e.g. 1204"),
    roomLetter: z
      .string()
      .trim()
      .toUpperCase()
      .regex(ROOM_LETTER_RE, "Room letter is A–F"),
    floor: z.coerce
      .number({ message: "Enter your floor" })
      .int("Floor is a whole number")
      .min(1, "Floor is 1 or higher")
      .max(MAX_FLOOR, `Floor is ${MAX_FLOOR} or lower`),
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const inviteSchema = z.object({
  email,
  fullName: z.string().trim().min(1, "Enter a name").max(120),
  role: z.enum(["staff", "driver", "admin"]),
});

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

/** Flatten zod issues to { field: firstMessage } for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
