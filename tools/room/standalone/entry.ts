import { createRoomScene, LIGHTING_PRESETS, type LightingSettings, type RoomView, type TimeMode, type Weather } from "../../../src/components/room/createRoomScene";
import { RADIO_STATION } from "../../../src/components/room/createAudio";
import { loadMemory, recordVisit, saveMemory } from "../../../src/components/room/roomMemory";
const $ = (id: string) => document.getElementById(id)!;
const viewBtn = $("toggle") as HTMLButtonElement;
const scopeBtn = $("scope") as HTMLButtonElement;
const lampBtn = $("lamp") as HTMLButtonElement;
const lightsBtn = $("lights") as HTMLButtonElement;
const panel = $("panel");
const muteBtn = $("mute") as HTMLButtonElement;
const radioBtn = $("radio") as HTMLButtonElement;
const onair = $("onair") as HTMLButtonElement;
const memory = loadMemory();
let muted = memory.muted ?? false;
let weather: Weather = memory.weather ?? "rain";
let timeMode: TimeMode = memory.timeMode ?? "auto";
const leaveBtn = $("leave") as HTMLButtonElement;
const hint = $("hint");
const sub = $("sub");
const label = $("label");
const HINTS: Record<RoomView, string> = {
  doorway: "Move your cursor to lean in · click the light switch, the radio, the lamp (L), the telescope (T), or the cat",
  explore: "Drag to look around · scroll to zoom · click the light switch, the radio, the lamp (L), the telescope (T), or the cat",
  telescope: "Drag to aim · scroll to zoom · Esc to step back",
};
let view: RoomView = "doorway";
let roomView: Exclude<RoomView, "telescope"> = "doorway";
const render = () => {
  const inScope = view === "telescope";
  viewBtn.hidden = scopeBtn.hidden = lampBtn.hidden = lightsBtn.hidden = radioBtn.hidden = inScope;
  if (inScope) openPanel(false);
  leaveBtn.hidden = !inScope;
  label.hidden = !inScope;
  viewBtn.textContent = view === "doorway" ? "Step inside" : "Back to the doorway";
  hint.textContent = HINTS[view];
  sub.textContent = inScope ? "Western University, London ON" : "still building.";
};
// ---------- lighting panel ----------
const FAIRY = [
  ["Warm white", "#ffb36b"], ["Amber", "#ff8a3d"], ["Western purple", "#9b5cff"], ["Ice blue", "#6fd3ff"],
  ["Pink", "#ff6fa8"], ["Daylight", "#fff4e6"], ["Rainbow", "rainbow"],
] as const;
let lighting: LightingSettings = { ...LIGHTING_PRESETS["Late night"], ...memory.lighting };
let apply: (next: Partial<LightingSettings>) => void = () => {};
const openPanel = (open: boolean) => {
  panel.hidden = !open;
  lightsBtn.setAttribute("aria-expanded", String(open));
};
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = "") => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const presetRow = $("presets");
for (const name of Object.keys(LIGHTING_PRESETS)) {
  const b = el("button", "chip-s", name);
  b.type = "button";
  b.dataset.preset = name;
  b.addEventListener("click", () => apply(LIGHTING_PRESETS[name]));
  presetRow.append(b);
}
const sliders: Record<string, { input: HTMLInputElement; out: HTMLElement; fmt: (v: number) => string }> = {};
const pct = (v: number) => (v <= 0 ? "Off" : Math.round(v * 100) + "%");
const addSlider = (key: "ceiling" | "lamp" | "fairy" | "warmth", label: string, min: number, max: number, fmt = pct, cls = "") => {
  const row = el("label", "row-s");
  const head = el("span", "row-h");
  const out = el("span", "val");
  head.append(el("span", "", label), out);
  const input = el("input", cls) as HTMLInputElement;
  Object.assign(input, { type: "range", min: String(min), max: String(max), step: "0.01" });
  input.setAttribute("aria-label", label);
  input.addEventListener("input", () => apply({ [key]: Number(input.value) }));
  row.append(head, input);
  $("sliders").append(row);
  sliders[key] = { input, out, fmt };
};
addSlider("ceiling", "Ceiling light", 0, 1);
addSlider("lamp", "Bedside lamp", 0, 1.5);
addSlider("fairy", "Fairy lights", 0, 1.5);
const sw = el("div", "swatches");
sw.setAttribute("role", "radiogroup");
sw.setAttribute("aria-label", "Fairy light colour");
for (const [name, value] of FAIRY) {
  const b = el("button", "swatch");
  b.type = "button";
  b.title = name;
  b.setAttribute("aria-label", name);
  b.setAttribute("role", "radio");
  b.dataset.color = value;
  b.style.background = value === "rainbow" ? "conic-gradient(#ff5f6d,#ffc371,#7cff6b,#4fd6ff,#9b5cff,#ff5fd0,#ff5f6d)" : value;
  b.addEventListener("click", () => apply({ fairyColor: value, fairy: lighting.fairy || 1 }));
  sw.append(b);
}
$("sliders").append(sw);
addSlider("warmth", "Colour temperature", -1, 1, (v) => (Math.abs(v) < 0.05 ? "Neutral" : v < 0 ? "Cool" : "Warm"), "temp");
const segmented = <T extends string>(hostId: string, opts: [T, string][], get: () => T, set: (v: T) => void) => {
  const host = $(hostId);
  const btns = opts.map(([value, label]) => {
    const b = el("button", "seg", label);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.addEventListener("click", () => set(value));
    host.append(b);
    return [value, b] as const;
  });
  return () => btns.forEach(([v, b]) => b.setAttribute("aria-checked", String(get() === v)));
};
let setWeatherScene: (w: Weather) => void = () => {};
let setTimeScene: (m: TimeMode) => void = () => {};
const syncTime = segmented<TimeMode>("times", [["auto", "Your time"], ["day", "Day"], ["sunset", "Sunset"], ["night", "Night"]], () => timeMode, (m) => setTimeScene(m));
const syncWeather = segmented<Weather>("weathers", [["rain", "Rain"], ["snow", "Snow"], ["clear", "Clear"]], () => weather, (w) => setWeatherScene(w));
const candle = $("candle") as HTMLInputElement;
candle.addEventListener("change", () => apply({ candle: candle.checked }));
const same = (a: LightingSettings, b: LightingSettings) =>
  a.fairyColor === b.fairyColor && a.candle === b.candle &&
  (["ceiling", "fairy", "lamp", "warmth"] as const).every((k) => Math.abs(a[k] - b[k]) < 0.02);
const syncPanel = () => {
  for (const [k, { input, out, fmt }] of Object.entries(sliders)) {
    const v = lighting[k as "ceiling"];
    if (document.activeElement !== input) input.value = String(v);
    out.textContent = fmt(v);
  }
  sw.querySelectorAll<HTMLButtonElement>(".swatch").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.color === lighting.fairyColor)));
  presetRow.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.setAttribute("aria-pressed", String(same(LIGHTING_PRESETS[b.dataset.preset!], lighting))));
  candle.checked = lighting.candle;
  syncTime();
  syncWeather();
};
const syncMute = () => {
  muteBtn.textContent = muted ? "Sound off" : "Sound on";
  muteBtn.setAttribute("aria-pressed", String(!muted));
};
syncMute();
syncPanel();
lightsBtn.addEventListener("click", () => openPanel(panel.hidden));
$("pclose").addEventListener("click", () => openPanel(false));

try {
  const h = createRoomScene($("stage"), {
    onLampChange: (on) => {
      lampBtn.setAttribute("aria-pressed", String(on));
      lampBtn.textContent = on ? "Lamp on" : "Lamp off";
    },
    onViewChange: (v) => {
      view = v;
      if (v !== "telescope") roomView = v;
      render();
    },
    initial: { lighting: memory.lighting, weather, timeMode, muted },
    onLightingChange: (next) => {
      lighting = next;
      saveMemory({ lighting: next });
      syncPanel();
    },
    onConditionsChange: (c) => {
      weather = c.weather;
      timeMode = c.timeMode;
      saveMemory({ weather, timeMode });
      syncPanel();
    },
    onRadioChange: (on) => {
      radioBtn.setAttribute("aria-pressed", String(on));
      radioBtn.textContent = on ? "Radio on" : "Radio";
      onair.hidden = !on;
    },
    onLightSwitch: () => openPanel(true),
    onClockChange: (label) => {
      document.querySelector(".clock b")!.textContent = label;
    },
    onScopeTarget: (t) => {
      label.classList.toggle("on", !!t);
      if (t) {
        $("lname").textContent = t.name;
        $("ldetail").textContent = t.detail;
      }
    },
  });
  apply = (next) => h.setLighting(next);
  setWeatherScene = (w) => h.setWeather(w);
  setTimeScene = (m) => h.setTimeMode(m);
  const toggleMute = () => {
    muted = !muted;
    h.setMuted(muted);
    saveMemory({ muted });
    syncMute();
  };
  muteBtn.addEventListener("click", toggleMute);
  radioBtn.addEventListener("click", () => h.toggleRadio());
  onair.addEventListener("click", () => h.toggleRadio());
  $("station").textContent = RADIO_STATION.name + " · " + RADIO_STATION.show;
  // welcome-back note
  const msg = recordVisit();
  if (msg) {
    const note = $("note");
    $("notetext").textContent = msg;
    setTimeout(() => {
      note.hidden = false;
      setTimeout(() => (note.hidden = true), 10000);
    }, 1800);
    note.addEventListener("click", () => (note.hidden = true));
  }
  viewBtn.addEventListener("click", () => h.setView(view === "doorway" ? "explore" : "doorway"));
  scopeBtn.addEventListener("click", () => h.setView("telescope"));
  leaveBtn.addEventListener("click", () => h.setView(roomView));
  lampBtn.addEventListener("click", () => h.toggleLamp());
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "l") h.toggleLamp();
    else if (k === "m") toggleMute();
    else if (k === "t") h.setView(view === "telescope" ? roomView : "telescope");
    else if (k === "escape" && !panel.hidden) openPanel(false);
    else if (k === "escape" && view === "telescope") h.setView(roomView);
  });
  render();
} catch (e) {
  $("err").hidden = false;
}
