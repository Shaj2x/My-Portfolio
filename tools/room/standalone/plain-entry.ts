import { RADIO_STATION } from "../../../src/components/room/createAudio";
import { playlistEmbed } from "../../../src/components/room/playlist";
import { createPlainRoom, CEILING_TONES, DESK_TONES, LAMP_COLORS, LAMP_DEFAULT, SUNSET_STYLES, type LampSettings, type PlainRoomView } from "../../../src/components/room/createPlainRoom";

const $ = (id: string) => document.getElementById(id)!;
const lampBtn = $("lamp") as HTMLButtonElement;
const settingsBtn = $("settings") as HTMLButtonElement;
const panel = $("panel");
const onBox = $("lamp-on") as HTMLInputElement;
const slider = $("lamp-brightness") as HTMLInputElement;
const ceilingBox = $("light-ceiling") as HTMLInputElement;
const sunsetBox = $("light-sunset") as HTMLInputElement;
const deskBox = $("light-desk") as HTMLInputElement;
const deskSlider = $("desk-brightness") as HTMLInputElement;
const dval = $("dval");
const bval = $("bval");
const colors = $("colors");
const label = $("label");
const hint = $("hint");

// the lamp's settings are remembered in this browser only; storage can be unavailable, so it's optional
const KEY = "portfolio-room-plain:lamp";
let lamp: LampSettings = LAMP_DEFAULT;
try {
  lamp = { ...LAMP_DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
} catch {
  // defaults
}

const swatches: HTMLButtonElement[] = [];
const toneChips: HTMLButtonElement[] = [];
const styleChips: HTMLButtonElement[] = [];
const chip = (name: string, background: string, onClick: () => void) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "swatch";
  const dot = document.createElement("i");
  dot.style.background = background;
  b.append(dot, name);
  b.addEventListener("click", onClick);
  return b;
};
for (const [name, hex] of DESK_TONES) {
  const b = chip(name, hex, () => room.setLamp({ deskTone: hex, desk: true }));
  b.dataset.tone = hex;
  $("tones").append(b);
  toneChips.push(b);
}
const ceilChips: HTMLButtonElement[] = [];
for (const [name, hex] of CEILING_TONES) {
  const b = chip(name, hex, () => room.setLamp({ ceilingTone: hex, ceiling: true }));
  b.dataset.tone = hex;
  $("ceiltones").append(b);
  ceilChips.push(b);
}
for (const [name, stops] of Object.entries(SUNSET_STYLES)) {
  const b = chip(name, `radial-gradient(circle, ${stops.join(", ")})`, () => room.setLamp({ sunsetStyle: name, sunset: true }));
  b.dataset.style = name;
  $("styles").append(b);
  styleChips.push(b);
}
for (const [name, hex] of LAMP_COLORS) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "swatch";
  b.dataset.color = hex;
  const dot = document.createElement("i");
  dot.style.background = hex;
  b.append(dot, name);
  b.addEventListener("click", () => room.setLamp({ color: hex, on: true }));
  colors.append(b);
  swatches.push(b);
}
const showLamp = (s: LampSettings) => {
  lamp = s;
  lampBtn.setAttribute("aria-pressed", String(s.on));
  onBox.checked = s.on;
  ceilingBox.checked = s.ceiling;
  sunsetBox.checked = s.sunset;
  deskBox.checked = s.desk;
  deskSlider.value = String(Math.round(s.deskBrightness * 100));
  dval.textContent = `${Math.round(s.deskBrightness * 100)}%`;
  for (const b of ceilChips) b.setAttribute("aria-pressed", String(b.dataset.tone === s.ceilingTone));
  for (const b of toneChips) b.setAttribute("aria-pressed", String(b.dataset.tone === s.deskTone));
  for (const b of styleChips) b.setAttribute("aria-pressed", String(b.dataset.style === s.sunsetStyle));
  slider.value = String(Math.round(s.brightness * 100));
  bval.textContent = `${Math.round(s.brightness * 100)}%`;
  for (const b of swatches) b.setAttribute("aria-pressed", String(b.dataset.color === s.color));
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // not remembered
  }
};

let view: PlainRoomView = "photo";
let lastRoomView: Exclude<PlainRoomView, "binoculars"> = "photo";
const viewButtons = document.querySelectorAll<HTMLButtonElement>("[data-view]");
const muteBtn = $("mute") as HTMLButtonElement;
const onair = $("onair") as HTMLButtonElement;
const hoverEl = $("hover");
$("station").textContent = RADIO_STATION.name;
$("show").textContent = RADIO_STATION.show;
let muted = false;
try {
  muted = localStorage.getItem("portfolio-room-plain:muted") === "1";
} catch {
  // not remembered
}
const showMuted = () => {
  muteBtn.textContent = muted ? "Sound off (M)" : "Sound on (M)";
  try {
    localStorage.setItem("portfolio-room-plain:muted", muted ? "1" : "0");
  } catch {
    // not remembered
  }
};
// a hosted preview can't embed other sites' players, so the speaker links out to the playlist instead
const playlist = playlistEmbed();
const playlistLink = $("playlist") as HTMLAnchorElement;
if (playlist) {
  playlistLink.href = playlist.open;
  playlistLink.textContent = `Open my playlist on ${playlist.service}`;
}
const room = createPlainRoom($("stage"), {
  onSpeaker: playlist
    ? () => {
        playlistLink.hidden = !playlistLink.hidden;
        room.setSpeakerPlaying(!playlistLink.hidden);
      }
    : undefined,
  muted,
  onLightSwitch: () => openPanel(true),
  onRadioChange: (on) => (onair.hidden = !on),
  onHover: (label) => {
    hoverEl.hidden = !label;
    hoverEl.textContent = label ?? "";
  },
  initialLamp: lamp,
  onLampChange: showLamp,
  onViewChange: (v) => {
    view = v;
    if (v !== "binoculars") lastRoomView = v;
    const scope = v === "binoculars";
    $("roomrow").hidden = scope;
    $("scoperow").hidden = !scope;
    label.hidden = !scope;
    if (scope) panel.hidden = true;
    hint.textContent = scope ? "Drag to look around · scroll to zoom · Esc to step back" : "Drag to orbit · scroll to zoom · click around the room: lights, the speaker, the plushies, the perfume, the controller, the blind, the binoculars (B)";
    if (scope) {
      hoverEl.hidden = true;
      onair.hidden = true;
    }
    for (const b of viewButtons) b.setAttribute("aria-pressed", String(b.dataset.view === v));
  },
  onScopeTarget: (t) => {
    $("lname").textContent = t?.name ?? "";
    $("ldetail").textContent = t?.detail ?? "";
  },
});
showLamp(lamp);

for (const b of viewButtons) b.addEventListener("click", () => room.setView(b.dataset.view as PlainRoomView));
$("binos").addEventListener("click", () => room.setView("binoculars"));
$("leave").addEventListener("click", () => room.setView(lastRoomView));
lampBtn.addEventListener("click", () => room.toggleLamp());
const toggleMute = () => {
  muted = !muted;
  room.setMuted(muted);
  showMuted();
};
muteBtn.addEventListener("click", toggleMute);
onair.addEventListener("click", () => room.toggleRadio());
showMuted();
const openPanel = (open: boolean) => {
  panel.hidden = !open;
  settingsBtn.setAttribute("aria-pressed", String(open));
};
settingsBtn.addEventListener("click", () => openPanel(panel.hidden));
$("pclose").addEventListener("click", () => openPanel(false));
onBox.addEventListener("change", () => room.setLamp({ on: onBox.checked }));
ceilingBox.addEventListener("change", () => room.setLamp({ ceiling: ceilingBox.checked }));
sunsetBox.addEventListener("change", () => room.setLamp({ sunset: sunsetBox.checked }));
deskBox.addEventListener("change", () => room.setLamp({ desk: deskBox.checked }));
deskSlider.addEventListener("input", () => room.setLamp({ deskBrightness: Number(deskSlider.value) / 100, desk: true }));
slider.addEventListener("input", () => room.setLamp({ brightness: Number(slider.value) / 100, on: true }));
window.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === "l") room.toggleLamp();
  else if (key === "m") toggleMute();
  else if (key === "b") room.setView(view === "binoculars" ? lastRoomView : "binoculars");
  else if (key === "escape") {
    if (view === "binoculars") room.setView(lastRoomView);
    else openPanel(false);
  }
});
