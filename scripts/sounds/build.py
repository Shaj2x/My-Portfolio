"""
Builds the site's sound effects into public/sfx/ from these sources:

  - earshot (github.com/Leonxlnx/earshot, MIT): its bank of sounds made in code, rendered with
    `earshot sfx render` (no AI models needed). Used for the physical things in the room (switches,
    the speaker, the blind), the keyboard, and Ma's Garden's notes.
  - uisfx (CC0 audio; vendored in github.com/Clipwing/skills under skills/real-sfx): interface
    sounds, for R.V Bot, trophies and the garden.
  - console-dog-nodejs (npm, MIT, by Javi Ezpeleta): real animal recordings, for the crying cat's
    meow and Spider-Ham's snort. A plushie should sound like the animal, and made-in-code voices
    don't. Pass the unpacked package with --console-dog.

The perfume spray is designed in this file (spray()): earshot's micro click for the pump, then a
steady, bright, grainy hiss of mist that thins as the pressure drops. Babs's chirp, the cow's moo,
the candle and the drawer are designed in designs.py.

Every sound is matched to a loudness target for its group (so nothing jumps out), its trailing
silence trimmed, and written as a small mono MP3. A table of measurements is printed: the sounds
are chosen and checked by numbers, then by ear.

Usage (earshot installed in a venv, both repos cloned, console-dog-nodejs unpacked from npm):
  python scripts/sounds/build.py --earshot PATH/TO/earshot --uisfx PATH/TO/uisfx \
    --console-dog PATH/TO/console-dog-nodejs --out public/sfx
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import pyloudnorm
import soundfile as sf

SR = 44100

# name -> (source, id, options, loudness target in LUFS). Chosen by what physically happens:
# a rocker switch is a rocker switch, a fabric blind is cloth, a PS5 waking is a soft "wake" cue.
ROOM = {
    "room/lamp": ("earshot", "fit/snap/switch_flip", {}, -24),
    "room/switch": ("earshot", "toggle/rocker", {}, -24),
    "room/radio": ("earshot", "toggle/micro", {}, -25),
    "room/squeak": ("uisfx", "rubber/press", {}, -26),
    # neither bank has an atomiser, so it's made here: earshot's micro click for the pump, then a hiss (see spray())
    "room/spritz": ("spray", "toggle/micro", {"seed": 7}, -28),
    "room/chime": ("uisfx", "soft/wake", {}, -25),
    # the plushies' voices, the candle and the drawer: no bank has these, so they're designed in designs.py
    # the first "mew" of the recording (what follows is a long yowl); low rumble filtered out
    "room/meow": ("clip", "dist/sounds/cat-meow.mp3", {"start": 0.0, "dur": 0.46, "highpass": 250}, -26),
    "room/chirp": ("design", "chirp", {}, -28),
    "room/moo": ("design", "moo", {}, -26),
    "room/oink": ("clip", "dist/sounds/pig-snort.mp3", {"highpass": 120}, -26),
    "room/candle-out": ("design", "candle_out", {}, -29),
    "room/candle-light": ("design", "candle_light", {}, -28),
    "room/drawer-open": ("design", "drawer_open", {}, -27),
    "room/drawer-close": ("design", "drawer_close", {}, -26),
    # lifting the binoculars to your eyes: the strap and the body brushing cloth
    "room/binoculars": ("earshot", "swipe/velvet", {"dur": 0.45}, -30),
    "room/blind": ("earshot", "swipe/cloth", {}, -27),
}
UI = {
    "ui/send": ("uisfx", "soft/send", {}, -29),
    "ui/receive": ("uisfx", "soft/receive", {}, -29),
    "ui/save": ("uisfx", "soft/complete", {}, -28),
    "ui/achievement": ("uisfx", "soft/achievement", {}, -25),
}
# three takes per key so a run of typing never repeats exactly
KEYS = {}
for profile, sound in {"creamy": "fit/key/lubed", "thocky": "fit/key/thock", "clacky": "typing_key/clicky"}.items():
    for take in range(3):
        KEYS[f"keys/{profile}-{take}"] = ("earshot", sound, {"seed": 11 + take}, -27)
KEYS["keys/space"] = ("earshot", "fit/key.space/thock_space", {}, -27)
# Ma's Garden: a marimba note per step of the cascade (C major pentatonic, as the game was tuned),
# glockenspiel for the stars, dreamy interface cues for the rest
GARDEN = {}
for note in ["C5", "D5", "E5", "G5", "A5", "C6", "D6", "E6", "G6"]:
    GARDEN[f"garden/pop-{note}"] = ("earshot", "mallet/marimba", {"pitch": note}, -22)
for note in ["G5", "C6", "E6"]:
    GARDEN[f"garden/star-{note}"] = ("earshot", "mallet/glock", {"pitch": note}, -22)
GARDEN.update({
    "garden/swap": ("uisfx", "dreamy/swipe", {}, -25),
    "garden/bump": ("uisfx", "dreamy/invalid-drop", {}, -25),
    "garden/special": ("earshot", "mallet/flourish", {}, -22),
    "garden/stripe": ("earshot", "whoosh_fast/tight", {}, -24),
    "garden/blast": ("earshot", "pro_pop_in/deep", {}, -21),
    "garden/blossom": ("earshot", "pro_shimmer/m3", {}, -23),
    "garden/acorn": ("earshot", "mallet/up4", {}, -22),
    "garden/win": ("uisfx", "dreamy/level-up", {}, -20),
    "garden/lose": ("uisfx", "dreamy/cancel", {}, -23),
    "garden/tap": ("uisfx", "dreamy/select", {}, -28),
})
ALL = {**ROOM, **UI, **KEYS, **GARDEN}


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"failed: {' '.join(cmd)}\n{r.stderr[-2000:]}")


def spray(click, seed):
    """a perfume atomiser: the pump's click, then ~0.3 s of bright mist that holds, darkens a little
    as the pressure drops, and stops quickly; a fine flutter in the level gives it the droplets"""
    from scipy.signal import butter, sosfilt

    band = lambda x, kind, f, order=4: sosfilt(butter(order, f, kind, fs=SR, output="sos"), x)
    rng = np.random.default_rng(seed)
    dur = 0.42
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    bright = band(noise, "highpass", 2600) + 0.8 * band(noise, "bandpass", [6000, 10500], 2)
    dark = band(bright, "lowpass", 7500)
    k = np.clip((t - 0.06) / (dur - 0.06), 0, 1)
    hiss = bright * (1 - 0.55 * k) + dark * 0.55 * k + 0.18 * band(noise, "bandpass", [900, 2200], 2)
    flutter = band(rng.standard_normal(n), "lowpass", 45, 2)
    hiss *= 1 + 0.126 * flutter / (np.abs(flutter).max() + 1e-9)
    start = 0.012
    env = np.clip((t - start) / 0.008, 0, 1) * (1 - 0.28 * np.clip((t - start) / 0.26, 0, 1))
    env *= np.where(t < 0.30, 1, np.exp(-(t - 0.30) / 0.032))
    out = hiss * env / np.abs(hiss * env).max()
    click = click[: int(0.04 * SR)]
    out[: len(click)] += 0.55 * click / (np.abs(click).max() + 1e-9)
    return out / np.abs(out).max() * 0.89


def clip(path, start=0.0, dur=None, highpass=None):
    """a stretch of a recording, with a short fade at each end so it starts and stops cleanly"""
    x, sr = sf.read(path, always_2d=True)
    x = x.mean(axis=1)
    if sr != SR:
        import soxr

        x = soxr.resample(x, sr, SR)
    x = x[int(start * SR) : int((start + dur) * SR) if dur else None].copy()
    if highpass:
        from scipy.signal import butter, sosfilt

        x = sosfilt(butter(4, highpass, "highpass", fs=SR, output="sos"), x)
    a, b = int(0.004 * SR), min(len(x) // 3, int(0.06 * SR))
    x[:a] *= np.linspace(0, 1, a)
    x[-b:] *= np.linspace(1, 0, b) ** 2
    return x


def render(source, sound_id, opts, earshot, uisfx, tmp, console_dog=None):
    if source == "clip":
        return clip(os.path.join(console_dog, sound_id), **opts)
    if source == "design":
        from designs import DESIGNS

        return DESIGNS[sound_id]()
    if source == "spray":
        return spray(render("earshot", sound_id, {}, earshot, uisfx, tmp), opts["seed"])
    wav = os.path.join(tmp, sound_id.replace("/", "_") + "_".join(f"{k}{v}" for k, v in opts.items()) + ".wav")
    if source == "earshot":
        cmd = [earshot, "sfx", "render", sound_id, "-o", wav, "--sr", "44100"]
        for k, v in opts.items():
            cmd += [f"--{k}", str(v)]
        run(cmd)
    else:
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(uisfx, "sounds", sound_id + ".mp3"), "-ac", "1", "-ar", str(SR), wav])
    x, sr = sf.read(wav, always_2d=True)
    x = x.mean(axis=1)
    if sr != SR:
        import soxr

        x = soxr.resample(x, sr, SR)
    return x


def trim(x, floor_db=-60):
    """drop the leading and trailing near-silence, with a short fade so nothing clicks"""
    env = np.abs(x)
    above = np.where(env > 10 ** (floor_db / 20) * env.max())[0]
    if not len(above):
        return x
    x = x[max(0, above[0] - int(0.002 * SR)) : min(len(x), above[-1] + int(0.03 * SR))].copy()
    fade = min(len(x) // 4, int(0.01 * SR))
    x[-fade:] *= np.linspace(1, 0, fade)
    return x


def loudness(x, meter):
    # short sounds are measured padded to the meter's 400 ms window
    pad = np.concatenate([x, np.zeros(max(0, int(0.6 * SR) - len(x)))])
    return meter.integrated_loudness(pad)


def centroid(x):
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    return float((spec * freqs).sum() / max(spec.sum(), 1e-9))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--earshot", required=True)
    ap.add_argument("--uisfx", required=True)
    ap.add_argument("--console-dog", required=True, help="the console-dog-nodejs package, unpacked")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    meter = pyloudnorm.Meter(SR)
    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        for name, (source, sound_id, opts, target) in ALL.items():
            x = trim(render(source, sound_id, opts, a.earshot, a.uisfx, tmp, a.console_dog))
            gain = 10 ** ((target - loudness(x, meter)) / 20)
            x = x * gain
            peak = 20 * np.log10(np.abs(x).max() + 1e-12)
            if peak > -1:  # never clip: give up loudness first
                x *= 10 ** ((-1 - peak) / 20)
            path = os.path.join(a.out, name + ".mp3")
            os.makedirs(os.path.dirname(path), exist_ok=True)
            wav = os.path.join(tmp, "out.wav")
            sf.write(wav, x, SR, subtype="PCM_16")
            run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-q:a", "5", "-ac", "1", path])
            rows.append(dict(name=name, source=f"{source}:{sound_id}", dur=round(len(x) / SR, 3), lufs=round(loudness(x, meter), 1),
                             peak=round(20 * np.log10(np.abs(x).max() + 1e-12), 1), centroid_hz=round(centroid(x)), bytes=os.path.getsize(path)))
    print(f"{'name':24} {'source':38} {'dur':>6} {'LUFS':>6} {'peak':>6} {'bright':>7} {'KB':>5}")
    for r in rows:
        print(f"{r['name']:24} {r['source']:38} {r['dur']:6.2f} {r['lufs']:6.1f} {r['peak']:6.1f} {r['centroid_hz']:7d} {r['bytes'] / 1024:5.1f}")
    with open(os.path.join(a.out, "manifest.json"), "w") as f:
        json.dump(rows, f, indent=1)
    print(f"\n{len(rows)} sounds, {sum(r['bytes'] for r in rows) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
