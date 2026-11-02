"""
Sounds the banks don't have, designed here from first principles (all deterministic per seed):

  voices   Babs's chirp and the cow's moo (the cat and Spider-Ham use real recordings, see
           build.py): a voice is a buzz at a pitch that moves,
           shaped by formants (the resonances that make an "ee" an "ee") that move too. Each
           harmonic of the pitch is given the loudness the formants allow at that moment.
  candle   blowing it out (a breath, then the flame guttering) and lighting it (a match's scratch,
           the head catching, the flare).
  drawer   wood sliding on wood (a stick-slip judder in a low band), then the stop or the shut.

Each returns mono float samples at SR, peaking at 0.89. build.py trims and loudness-matches them.
"""

import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100


def _band(x, kind, f, order=4):
    return sosfilt(butter(order, f, kind, fs=SR, output="sos"), x)


def _curve(t, points):
    """a smooth path through (time, value) points"""
    ts, vs = zip(*points)
    return np.interp(t, ts, vs)


def _norm(x):
    return x / (np.abs(x).max() + 1e-12) * 0.89


def voice(dur, f0, formants, env, rng, tilt=0.6, vibrato=(5.5, 0.012), jitter=0.006, breath=0.04):
    """
    f0: [(t, Hz)]; formants: [(t, [(F, bandwidth, gain), ...])] (same count at each point);
    env: [(t, level)]. tilt: how fast harmonics fall away (1/k**tilt), bigger = darker.
    """
    n = int(dur * SR)
    t = np.arange(n) / SR
    pitch = _curve(t, f0)
    pitch = pitch * (1 + vibrato[1] * np.sin(2 * np.pi * vibrato[0] * t))
    wobble = _band(rng.standard_normal(n), "lowpass", 30, 2)
    pitch = pitch * (1 + jitter * wobble / (np.abs(wobble).max() + 1e-9))
    phase = 2 * np.pi * np.cumsum(pitch) / SR
    # the formants at each moment
    ft = [p[0] for p in formants]
    count = len(formants[0][1])
    tracks = [
        [np.interp(t, ft, [p[1][j][i] for p in formants]) for i in range(3)]
        for j in range(count)
    ]
    out = np.zeros(n)
    k = 1
    while k * pitch.min() < 9000:
        fk = k * pitch
        amp = np.zeros(n)
        for F, bw, g in tracks:
            amp += g / np.sqrt(1 + ((fk - F) / (bw / 2)) ** 2)
        amp *= k ** -tilt * (fk < 10000)
        out += amp * np.sin(k * phase + rng.uniform(0, 2 * np.pi))
        k += 1
    # a little air through it, shaped like the voice
    air = _band(rng.standard_normal(n), "bandpass", [1500, 6000], 2)
    out = out / (np.abs(out).max() + 1e-9) + breath * air / (np.abs(air).max() + 1e-9)
    return _norm(out * _curve(t, env))


def chirp(seed=5):
    """Babs: a songbird's "chip-chirrup", two quick whistled notes, the first sweeping up, the second down"""
    rng = np.random.default_rng(seed)
    dur = 0.24
    n = int(dur * SR)
    out = np.zeros(n)
    for start, length, path, level in [
        (0.0, 0.055, [(0, 2900), (0.6, 4700), (1, 5200)], 0.8),
        (0.085, 0.085, [(0, 5600), (0.25, 5300), (1, 3500)], 1.0),
    ]:
        m = int(length * SR)
        u = np.arange(m) / m
        f = _curve(u, path) * (1 + 0.01 * rng.standard_normal())
        # a fast warble, as birdsong has
        f = f * (1 + 0.02 * np.sin(2 * np.pi * 70 * u * length))
        ph = 2 * np.pi * np.cumsum(f) / SR
        bell = np.sin(np.pi * u) ** 1.5
        tone = np.sin(ph) + 0.1 * np.sin(2 * ph) + 0.03 * np.sin(3 * ph)
        s = int(start * SR)
        out[s : s + m] += level * bell * tone
    return _norm(out)


def moo(seed=9):
    """the Chick-fil-A cow: a short, soft "mmm-ooo", low and round, the mouth opening then closing"""
    rng = np.random.default_rng(seed)
    dur = 0.95
    return voice(
        dur,
        f0=[(0, 140), (0.3, 165), (0.6, 150), (0.95, 112)],
        formants=[
            (0.0, [(250, 120, 1.0), (900, 200, 0.12), (2400, 300, 0.03)]),
            (0.15, [(330, 140, 1.0), (850, 200, 0.35), (2400, 300, 0.08)]),
            (0.45, [(560, 180, 1.0), (1000, 200, 0.5), (2500, 300, 0.12)]),
            (0.95, [(330, 140, 1.0), (750, 200, 0.3), (2400, 300, 0.05)]),
        ],
        env=[(0, 0), (0.12, 0.7), (0.4, 1.0), (0.75, 0.7), (0.95, 0)],
        rng=rng,
        tilt=0.9,
        vibrato=(4.0, 0.01),
        jitter=0.012,
        breath=0.02,
    )


def candle_out(seed=17):
    """a short breath out, then the flame guttering for a moment"""
    rng = np.random.default_rng(seed)
    dur = 0.42
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    breath = _band(_band(noise, "bandpass", [300, 2400], 2), "lowpass", 3500) + 0.12 * _band(noise, "bandpass", [2400, 5000], 2)
    breath *= _curve(t, [(0, 0), (0.02, 1.0), (0.1, 0.85), (0.28, 0.12), (0.42, 0)])
    flutter_env = _band(rng.standard_normal(n), "lowpass", 25, 2)
    flutter = _band(rng.standard_normal(n), "bandpass", [60, 260], 2)
    flutter *= np.abs(flutter_env) / (np.abs(flutter_env).max() + 1e-9)
    flutter *= _curve(t, [(0, 0), (0.06, 1.0), (0.3, 0.3), (0.42, 0)])
    b = breath / (np.abs(breath).max() + 1e-9)
    f = flutter / (np.abs(flutter).max() + 1e-9)
    return _norm(b + 0.7 * f)


def candle_light(seed=19):
    """a match: the rough scratch along the box, a crackle as the head catches, then the soft flare"""
    rng = np.random.default_rng(seed)
    dur = 0.55
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    # the scratch: grains of high noise, dense and uneven, over 90 ms
    m = int(0.09 * SR)
    grains = (rng.random(m) < 0.06) * rng.uniform(0.3, 1.0, m)
    grains = _band(grains, "lowpass", 900, 2)
    grains = np.abs(grains) / (np.abs(grains).max() + 1e-9)
    scratch = _band(rng.standard_normal(m), "highpass", 1800) * (0.35 + grains)
    scratch *= np.sin(np.pi * np.arange(m) / m) ** 0.6
    out[:m] += 0.8 * scratch / (np.abs(scratch).max() + 1e-9)
    # the head catching: a few sharp crackles
    for at in [0.088, 0.1, 0.117, 0.16, 0.23]:
        s = int(at * SR)
        k = int(0.004 * SR)
        click = _band(rng.standard_normal(k), "highpass", 2500) * np.exp(-np.arange(k) / (0.0008 * SR))
        out[s : s + k] += rng.uniform(0.35, 0.7) * click / (np.abs(click).max() + 1e-9)
    # the flare: a soft "fff" of flame that swells and settles
    flare = _band(rng.standard_normal(n), "bandpass", [180, 1600], 2) + 0.25 * _band(rng.standard_normal(n), "bandpass", [1600, 4000], 2)
    flare *= _curve(t, [(0, 0), (0.09, 0), (0.13, 1.0), (0.22, 0.6), (0.55, 0)])
    out += 0.75 * flare / (np.abs(flare).max() + 1e-9)
    return _norm(out)


def _slide(rng, dur, speed):
    """wood dragging on wood: a judder of tiny catches, ringing low through the drawer's box"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    v = _curve(t, speed)
    # stick-slip: catches arrive faster the faster it moves
    rate = 70 + 160 * v
    catches = rng.random(n) < rate / SR
    catches = catches * rng.uniform(0.4, 1.0, n) * v
    body = _band(catches, "bandpass", [160, 480], 2) + 0.25 * _band(catches, "bandpass", [600, 1400], 2)
    rub = _band(rng.standard_normal(n), "bandpass", [200, 900], 2) * v
    s = body / (np.abs(body).max() + 1e-9) + 0.15 * rub / (np.abs(rub).max() + 1e-9)
    return s


def _thunk(rng, length, low, level):
    """the drawer front meeting the dresser: a low knock with a wooden ring"""
    m = int(length * SR)
    u = np.arange(m) / SR
    knock = np.sin(2 * np.pi * low * u) * np.exp(-u / 0.035)
    knock += 0.5 * np.sin(2 * np.pi * low * 2.7 * u) * np.exp(-u / 0.02)
    hit = _band(rng.standard_normal(m), "bandpass", [400, 2500], 2) * np.exp(-u / 0.006)
    x = knock / np.abs(knock).max() + 0.6 * hit / (np.abs(hit).max() + 1e-9)
    return level * x


def drawer_open(seed=23):
    """pulled out: the slide speeds up, then eases to a soft stop against the runners"""
    rng = np.random.default_rng(seed)
    s = _slide(rng, 0.42, [(0, 0.2), (0.08, 1.0), (0.3, 0.8), (0.42, 0)])
    s = 0.6 * s / (np.abs(s).max() + 1e-9)
    stop = _thunk(rng, 0.12, 150, 0.5)
    out = np.zeros(int(0.55 * SR))
    out[: len(s)] += s
    at = int(0.4 * SR)
    out[at : at + len(stop)] += stop
    return _norm(out)


def drawer_close(seed=29):
    """pushed in: a quicker slide, then a solid shut"""
    rng = np.random.default_rng(seed)
    s = _slide(rng, 0.3, [(0, 0.4), (0.06, 1.0), (0.3, 1.0)])
    s = 0.4 * s / (np.abs(s).max() + 1e-9)
    shut = _thunk(rng, 0.18, 105, 1.0)
    out = np.zeros(int(0.5 * SR))
    out[: len(s)] += s
    at = int(0.3 * SR)
    out[at : at + len(shut)] += shut
    return _norm(out)


DESIGNS = {
    "chirp": chirp,
    "moo": moo,
    "candle_out": candle_out,
    "candle_light": candle_light,
    "drawer_open": drawer_open,
    "drawer_close": drawer_close,
}
