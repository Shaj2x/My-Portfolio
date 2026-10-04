/** Current time. Wrapped so server components can read the clock explicitly. */
export function nowMs(): number {
  return Date.now();
}
