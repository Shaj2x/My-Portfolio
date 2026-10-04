import "server-only";

// Server-side client for the analytics service (time-series lives there).
// Returns null when the service isn't configured or reachable, so pages can
// show a clear "not connected" state instead of failing.
export async function analytics<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const base = process.env.ANALYTICS_URL;
  if (!base) return null;
  const url = new URL(path, base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url, {
      headers: { "x-api-key": process.env.ANALYTICS_API_KEY ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("analytics", path, res.status);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error("analytics unreachable", path, err);
    return null;
  }
}

export async function analyticsPost<T>(path: string, body: unknown): Promise<T | null> {
  const base = process.env.ANALYTICS_URL;
  if (!base) return null;
  try {
    const res = await fetch(new URL(path, base), {
      method: "POST",
      headers: { "x-api-key": process.env.ANALYTICS_API_KEY ?? "", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export type Live = {
  as_of: string; total_kw: number; peak_limit_kw: number | null;
  systems: { system: string; name: string; kw: number }[];
  channels: { device_id: string; channel: number; device: string; label: string; system: string; kw: number; current_a: number; ts: string }[];
};
export type Series = { systems: { system: string; name: string }[]; points: ({ t: string; total: number } & Record<string, number | string>)[] };
export type Summary = {
  total_kwh: number; total_cost: number; carbon_kg: number; peak_kw: number; peak_at: string | null; plan: string;
  by_system: { system: string; name: string; kwh: number; cost: number }[];
  by_period: { period: string; kwh: number; cost: number; cents_per_kwh: number }[];
};
export type Savings = {
  rooms: { room: string; name: string; baseline_kwh: number; actual_kwh: number; saved_kwh: number; saved_cost: number; saved_pct: number }[];
  total_saved_kwh: number; total_saved_cost: number; carbon_avoided_kg: number;
};

// Fixed system → colour slot (entity, not rank).
export const SYSTEM_SLOT: Record<string, string> = {
  common: "var(--series-1)", laundry: "var(--series-2)", ev: "var(--series-3)",
  theatre: "var(--series-4)", game_room: "var(--series-5)", shuttle: "var(--series-6)", other: "var(--ink-2)",
};
export const SYSTEM_ORDER = ["common", "laundry", "ev", "theatre", "game_room", "shuttle", "other"];

export const PERIOD_LABEL: Record<string, string> = {
  ultra_low: "Ultra-low overnight", weekend_off_peak: "Weekend off-peak", off_peak: "Off-peak", mid_peak: "Mid-peak", on_peak: "On-peak",
};

export const money = (v: number) => v.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

export type Forecast = {
  points: { t: string; predicted_kw: number; lower_kw: number; upper_kw: number; actual_kw: number | null }[];
  limit_kw: number; model: string | null; mape_pct: number | null;
  recommendations: { t: string; label: string; forecast_upper_kw: number; limit_kw: number; over_kw: number; actions: string[] }[];
};
export type Electrification = {
  stats: { runs: number; distance_km_p50: number; distance_km_p90: number; duration_min_p90: number; idle_min_p90: number; stops_p90: number };
  assumptions: Record<string, number>;
  kwh_per_run: number; kwh_per_run_winter: number; runs_per_day: Record<string, number>; daily_kwh_winter: number; worst_day: string;
  blocks: { departures: string[]; kwh_winter: number }[]; hardest_block_kwh: number; required_battery_kwh: number;
  recommended_pack_kwh: number; charge_windows: Record<string, string | number>[]; min_soc_pct: number; feasible: boolean; notes: string[];
};
