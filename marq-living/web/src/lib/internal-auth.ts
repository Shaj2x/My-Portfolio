import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Checks `Authorization: Bearer <secret>` against an env var, in constant time. */
export function hasBearer(request: Request, envName: "CRON_SECRET" | "INTERNAL_API_SECRET"): boolean {
  const secret = process.env[envName];
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
