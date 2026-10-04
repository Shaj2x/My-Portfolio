"use client";

import { useId, useMemo, useState } from "react";

// Small SVG charts with hover tooltips, legends and a table view. Series
// colours come from the validated --series-* tokens, assigned in a fixed
// order by the caller (entity → slot), never by rank.

export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)"];

const fmtTime = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", weekday: "short", hour: "numeric", minute: "2-digit" });

type Point = { t: string } & Record<string, number | string>;

/** Stacked area of kW by series over time, with an optional reference line (e.g. peak limit). */
export function StackedArea({
  points, series, height = 220, limit, unit = "kW",
}: {
  points: Point[];
  series: { key: string; name: string; color: string }[];
  height?: number;
  limit?: { value: number; label: string } | null;
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const W = 720, H = height, padL = 40, padR = 8, padT = 10, padB = 24;
  const stacks = useMemo(() => points.map((p) => {
    let acc = 0;
    return series.map((s) => {
      const y0 = acc;
      acc += Number(p[s.key] ?? 0);
      return [y0, acc] as const;
    });
  }), [points, series]);
  const dataMax = Math.max(1, ...stacks.map((st) => st.at(-1)?.[1] ?? 0));
  // Keep the data readable: only stretch the axis to the limit when the load
  // gets within reach of it; otherwise state the limit instead of drawing it.
  const limitOnScale = !!limit && limit.value <= dataMax * 2.5;
  const maxY = Math.max(dataMax, limitOnScale ? limit!.value : 0) * 1.08;
  const x = (i: number) => padL + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - v / maxY) * (H - padT - padB);
  const ticks = niceTicks(maxY);

  if (!points.length) return <p className="text-sm text-ink-2">No readings in this period yet.</p>;

  const areas = series.map((s, si) => {
    const top = points.map((_, i) => `${x(i)},${y(stacks[i][si][1])}`);
    const bottom = points.map((_, i) => `${x(i)},${y(stacks[i][si][0])}`).reverse();
    return <polygon key={s.key} points={[...top, ...bottom].join(" ")} fill={s.color} stroke="var(--surface)" strokeWidth={1} opacity={0.9} />;
  });

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - padL) / (W - padL - padR)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };
  const hp = hover !== null ? points[hover] : null;
  const total = hp ? series.reduce((a, s) => a + Number(hp[s.key] ?? 0), 0) : 0;

  return (
    <figure className="flex flex-col gap-2">
      <Legend items={series} />
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" role="img" aria-labelledby={`${id}-t`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          <title id={`${id}-t`}>{`Load by system, ${unit}`}</title>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--ink-2)">{t}</text>
            </g>
          ))}
          {areas}
          {limit && limitOnScale ? (
            <g>
              <line x1={padL} x2={W - padR} y1={y(limit.value)} y2={y(limit.value)} stroke="var(--bad)" strokeWidth={2} strokeDasharray="6 4" />
              <text x={W - padR} y={y(limit.value) - 5} textAnchor="end" fontSize={11} fill="var(--ink-2)">{limit.label}</text>
            </g>
          ) : limit ? (
            <text x={W - padR} y={padT + 10} textAnchor="end" fontSize={11} fill="var(--ink-2)">{`${limit.label} — well above this range`}</text>
          ) : null}
          {[0, Math.floor(points.length / 2), points.length - 1].map((i) => (
            <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize={11} fill="var(--ink-2)">
              {fmtTime.format(new Date(points[i].t))}
            </text>
          ))}
          {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--ink)" strokeWidth={1} /> : null}
        </svg>
        {hp ? (
          <div className="pointer-events-none absolute top-1 z-10 min-w-40 rounded-lg border border-line bg-surface p-2 text-xs shadow"
            style={{ left: `${Math.min(70, (x(hover!) / W) * 100)}%` }}>
            <p className="mb-1 text-ink-2">{fmtTime.format(new Date(hp.t))}</p>
            <p className="font-semibold tabular-nums">{total.toFixed(1)} {unit} total</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center gap-2 tabular-nums">
                <span className="inline-block h-0.5 w-3" style={{ background: s.color }} />
                <strong>{Number(hp[s.key] ?? 0).toFixed(2)}</strong> <span className="text-ink-2">{s.name}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-ink-2">View as table</summary>
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-xs tabular-nums">
            <thead><tr><th className="text-left">Time</th>{series.map((s) => <th key={s.key} className="text-right">{s.name}</th>)}<th className="text-right">Total</th></tr></thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.t} className="border-t border-line">
                  <td>{fmtTime.format(new Date(p.t))}</td>
                  {series.map((s) => <td key={s.key} className="text-right">{Number(p[s.key] ?? 0).toFixed(2)}</td>)}
                  <td className="text-right">{series.reduce((a, s) => a + Number(p[s.key] ?? 0), 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((s) => (
        <li key={s.name} className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

/** Horizontal bars with direct value labels (magnitude, one hue). */
export function BarList({ rows, unit, color = "var(--series-1)", decimals = 1, currency = false }: {
  rows: { label: string; value: number; note?: string }[];
  unit: string;
  color?: string;
  // Options rather than a formatter function: this renders on the client and
  // server components can't pass functions to it.
  decimals?: number;
  currency?: boolean;
}) {
  const format = (v: number) =>
    currency ? v.toLocaleString("en-CA", { style: "currency", currency: "CAD" }) : v.toFixed(decimals);
  const max = Math.max(...rows.map((r) => r.value), 0.0001);
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm" title={`${r.label}: ${format(r.value)} ${unit}`}>
          <span className="truncate">{r.label}</span>
          <span className="h-3 rounded-r" style={{ width: `${Math.max(1, (r.value / max) * 100)}%`, background: color }} />
          <span className="tabular-nums">
            <strong>{format(r.value)}</strong> <span className="text-ink-2">{unit}</span>
            {r.note ? <span className="ml-1 text-xs text-ink-2">{r.note}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Current value against a limit. Turns warning/critical with an icon and label, never colour alone. */
export function Meter({ value, limit, unit }: { value: number; limit: number | null; unit: string }) {
  const pct = limit ? Math.min(100, (value / limit) * 100) : 0;
  const level = !limit ? "ok" : pct >= 95 ? "critical" : pct >= 80 ? "warning" : "ok";
  return (
    <div className="flex flex-col gap-2">
      <p className="text-4xl font-semibold tabular-nums">
        {value.toFixed(1)} <span className="text-base font-normal text-ink-2">{unit}</span>
      </p>
      {limit ? (
        <>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={value} aria-label="Load against peak limit">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: level === "ok" ? "var(--series-1)" : level === "warning" ? "var(--warn)" : "var(--bad)" }} />
          </div>
          <p className="text-sm text-ink-2">
            {level === "ok" ? "" : level === "warning" ? "⚠ Approaching " : "⛔ At "}
            {pct.toFixed(0)}% of the {limit.toFixed(0)} {unit} peak limit
          </p>
        </>
      ) : null}
    </div>
  );
}

function niceTicks(max: number): number[] {
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find((s) => max / s <= 5) ?? 1000;
  const out = [];
  for (let v = 0; v <= max; v += step) out.push(v);
  return out;
}

/** Forecast line with its 80% band, actuals, and a reference limit. */
export function ForecastChart({ points, limit, height = 220 }: {
  points: { t: string; predicted_kw: number; lower_kw: number; upper_kw: number; actual_kw: number | null }[];
  limit: number | null;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = height, padL = 40, padR = 8, padT = 10, padB = 24;
  if (!points.length) return <p className="text-sm text-ink-2">No forecast yet. It runs nightly at 9:30 pm, or use “Run forecast now”.</p>;
  const dataMax = Math.max(1, ...points.map((p) => Math.max(p.upper_kw, p.actual_kw ?? 0)));
  const limitOnScale = !!limit && limit <= dataMax * 2.5;
  const maxY = Math.max(dataMax, limitOnScale ? limit! : 0) * 1.1;
  const x = (i: number) => padL + (i / Math.max(points.length - 1, 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / maxY) * (H - padT - padB);
  const band = [...points.map((p, i) => `${x(i)},${y(p.upper_kw)}`), ...points.map((p, i) => `${x(i)},${y(p.lower_kw)}`).reverse()].join(" ");
  const line = (vals: (number | null)[]) => {
    let d = "";
    vals.forEach((v, i) => {
      if (v === null) return;
      d += `${d && vals[i - 1] !== null ? "L" : "M"}${x(i)},${y(v)}`;
    });
    return d;
  };
  const hp = hover !== null ? points[hover] : null;
  return (
    <figure className="flex flex-col gap-2">
      <Legend items={[{ name: "Forecast (80% band)", color: "var(--series-1)" }, { name: "Actual", color: "var(--series-2)" }]} />
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" role="img" aria-label="Load forecast versus actual"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const i = Math.round((((e.clientX - r.left) / r.width) * W - padL) / (W - padL - padR) * (points.length - 1));
            setHover(Math.max(0, Math.min(points.length - 1, i)));
          }}
          onPointerLeave={() => setHover(null)}>
          {niceTicks(maxY).map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" />
              <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--ink-2)">{t}</text>
            </g>
          ))}
          <polygon points={band} fill="var(--series-1)" opacity={0.15} />
          <path d={line(points.map((p) => p.predicted_kw))} fill="none" stroke="var(--series-1)" strokeWidth={2} />
          <path d={line(points.map((p) => p.actual_kw))} fill="none" stroke="var(--series-2)" strokeWidth={2} />
          {limit && limitOnScale ? (
            <g>
              <line x1={padL} x2={W - padR} y1={y(limit)} y2={y(limit)} stroke="var(--bad)" strokeWidth={2} strokeDasharray="6 4" />
              <text x={W - padR} y={y(limit) - 5} textAnchor="end" fontSize={11} fill="var(--ink-2)">Peak limit {limit} kW</text>
            </g>
          ) : limit ? (
            <text x={W - padR} y={padT + 10} textAnchor="end" fontSize={11} fill="var(--ink-2)">{`Peak limit ${limit} kW — well above this range`}</text>
          ) : null}
          {[0, Math.floor(points.length / 2), points.length - 1].map((i) => (
            <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize={11} fill="var(--ink-2)">
              {fmtTime.format(new Date(points[i].t))}
            </text>
          ))}
          {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--ink)" /> : null}
        </svg>
        {hp ? (
          <div className="pointer-events-none absolute top-1 z-10 rounded-lg border border-line bg-surface p-2 text-xs shadow" style={{ left: `${Math.min(70, (x(hover!) / W) * 100)}%` }}>
            <p className="mb-1 text-ink-2">{fmtTime.format(new Date(hp.t))}</p>
            <p className="flex items-center gap-2 tabular-nums"><span className="inline-block h-0.5 w-3" style={{ background: "var(--series-1)" }} /><strong>{hp.predicted_kw.toFixed(1)} kW</strong> <span className="text-ink-2">forecast ({hp.lower_kw.toFixed(0)}–{hp.upper_kw.toFixed(0)})</span></p>
            {hp.actual_kw !== null ? <p className="flex items-center gap-2 tabular-nums"><span className="inline-block h-0.5 w-3" style={{ background: "var(--series-2)" }} /><strong>{hp.actual_kw.toFixed(1)} kW</strong> <span className="text-ink-2">actual</span></p> : null}
          </div>
        ) : null}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-ink-2">View as table</summary>
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-xs tabular-nums">
            <thead><tr><th className="text-left">Time</th><th className="text-right">Forecast</th><th className="text-right">Low</th><th className="text-right">High</th><th className="text-right">Actual</th></tr></thead>
            <tbody>{points.map((p) => (
              <tr key={p.t} className="border-t border-line"><td>{fmtTime.format(new Date(p.t))}</td><td className="text-right">{p.predicted_kw.toFixed(1)}</td><td className="text-right">{p.lower_kw.toFixed(1)}</td><td className="text-right">{p.upper_kw.toFixed(1)}</td><td className="text-right">{p.actual_kw?.toFixed(1) ?? "—"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
