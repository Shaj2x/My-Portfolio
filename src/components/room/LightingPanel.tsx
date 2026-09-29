import * as SliderPrimitive from "@radix-ui/react-slider";
import { X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { LIGHTING_PRESETS, type LightingSettings } from "./createRoomScene";

const FAIRY_COLORS = [
  { name: "Warm white", value: "#ffb36b" },
  { name: "Amber", value: "#ff8a3d" },
  { name: "Western purple", value: "#9b5cff" },
  { name: "Ice blue", value: "#6fd3ff" },
  { name: "Pink", value: "#ff6fa8" },
  { name: "Daylight", value: "#fff4e6" },
  { name: "Rainbow", value: "rainbow" },
];

function Dimmer({
  label,
  value,
  max,
  min = 0,
  onChange,
  track,
  format = (v) => (v <= 0 ? "Off" : `${Math.round(v * 100)}%`),
}: {
  label: string;
  value: number;
  max: number;
  min?: number;
  onChange: (v: number) => void;
  track?: string;
  format?: (v: number) => string;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-white/80">{label}</span>
        <span className="font-mono text-xs tabular-nums text-white/50">{format(value)}</span>
      </div>
      <SliderPrimitive.Root
        className="relative flex h-5 w-full touch-none select-none items-center"
        value={[value]}
        max={max}
        min={min}
        step={0.01}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
      >
        <SliderPrimitive.Track className={cn("relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/15", track)}>
          {!track && <SliderPrimitive.Range className="absolute h-full bg-amber-300/90" />}
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-amber-200 bg-amber-100 shadow-[0_0_12px_rgba(255,190,110,0.6)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 active:scale-110" />
      </SliderPrimitive.Root>
    </div>
  );
}

const same = (a: LightingSettings, b: LightingSettings) =>
  a.fairyColor === b.fairyColor &&
  a.candle === b.candle &&
  (["ceiling", "fairy", "lamp", "warmth"] as const).every((k) => Math.abs(a[k] - b[k]) < 0.02);

export function LightingPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: LightingSettings;
  onChange: (next: Partial<LightingSettings>) => void;
  onClose: () => void;
}) {
  const activePreset = Object.entries(LIGHTING_PRESETS).find(([, p]) => same(p, settings))?.[0];
  return (
    <div
      role="dialog"
      aria-label="Lighting"
      className="pointer-events-auto max-h-full w-full max-w-[340px] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0d0b0a]/75 p-5 text-white shadow-2xl backdrop-blur-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-300/70">Light switch</p>
          <h2 className="text-lg font-semibold">Lighting</h2>
        </div>
        <button onClick={onClose} className="rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close lighting">
          <X size={18} />
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {Object.entries(LIGHTING_PRESETS).map(([name, preset]) => (
          <button
            key={name}
            onClick={() => onChange(preset)}
            aria-pressed={activePreset === name}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              activePreset === name
                ? "border-amber-300/60 bg-amber-300/15 text-amber-100"
                : "border-white/10 text-white/70 hover:border-white/25 hover:text-white",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        <Dimmer label="Ceiling light" value={settings.ceiling} max={1} onChange={(v) => onChange({ ceiling: v })} />
        <Dimmer label="Bedside lamp" value={settings.lamp} max={1.5} onChange={(v) => onChange({ lamp: v })} />
        <Dimmer label="Fairy lights" value={settings.fairy} max={1.5} onChange={(v) => onChange({ fairy: v })} />

        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Fairy light colour">
          {FAIRY_COLORS.map((c) => (
            <button
              key={c.value}
              role="radio"
              aria-checked={settings.fairyColor === c.value}
              title={c.name}
              aria-label={c.name}
              onClick={() => onChange({ fairyColor: c.value, fairy: settings.fairy || 1 })}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                settings.fairyColor === c.value ? "border-white scale-110" : "border-white/15",
              )}
              style={{
                background:
                  c.value === "rainbow" ? "conic-gradient(#ff5f6d, #ffc371, #7cff6b, #4fd6ff, #9b5cff, #ff5fd0, #ff5f6d)" : c.value,
                boxShadow: settings.fairyColor === c.value && c.value !== "rainbow" ? `0 0 14px ${c.value}` : undefined,
              }}
            />
          ))}
        </div>

        <Dimmer
          label="Colour temperature"
          value={settings.warmth}
          min={-1}
          max={1}
          onChange={(v) => onChange({ warmth: v })}
          track="bg-gradient-to-r from-sky-300/70 via-white/40 to-amber-400/80"
          format={(v) => (Math.abs(v) < 0.05 ? "Neutral" : v < 0 ? "Cool" : "Warm")}
        />

        <label className="flex items-center justify-between text-sm">
          <span className="text-white/80">Candle</span>
          <Switch
            checked={settings.candle}
            onCheckedChange={(v) => onChange({ candle: v })}
            className="data-[state=checked]:bg-amber-400 data-[state=unchecked]:bg-white/15"
          />
        </label>
      </div>
    </div>
  );
}
