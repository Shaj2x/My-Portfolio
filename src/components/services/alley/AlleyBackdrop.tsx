import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { AlleyHandle } from "./createAlley";

/*
 * The services page's world: a 3D alley at night, fixed behind everything.
 * Scrolling the page walks the camera down it; the pointer leans it a little.
 * Loaded after the text so the words never wait on WebGL. Without WebGL the page keeps a
 * painted stand-in: dark brick tones, one amber pool of light and the cold far end.
 */
const AlleyBackdrop = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let handle: AlleyHandle | null = null;
    let cancelled = false;
    const lowPower = window.matchMedia("(max-width: 768px)").matches || (navigator.hardwareConcurrency ?? 8) <= 4;

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      handle?.setProgress(max > 0 ? window.scrollY / max : 0);
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      handle?.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    };

    import("./createAlley")
      .then(({ createAlley }) => {
        if (cancelled) return;
        try {
          handle = createAlley(canvas, { reduceMotion: !!reduce, lowPower });
        } catch {
          return; // no WebGL: the painted stand-in stays
        }
        onScroll();
        setReady(true);
      })
      .catch(() => undefined);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pointermove", onPointer);
      handle?.dispose();
    };
  }, [reduce]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden bg-[#06080b]" aria-hidden="true">
      {/* the painted stand-in, under the canvas until the alley has drawn */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_45%_at_32%_42%,rgba(255,150,70,0.28),transparent_70%),radial-gradient(14%_30%_at_52%_52%,rgba(140,190,215,0.35),transparent_80%),linear-gradient(90deg,#1a110b_0%,#0b0907_38%,#06080b_62%,#030405_100%)]" />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full transition-opacity duration-[1200ms] ease-out ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {/* film: a vignette and fine grain over the whole frame */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_55%_45%,transparent_45%,rgba(0,0,0,0.75)_100%)]" />
      <div className="alley-grain absolute -inset-[50%] opacity-[0.09] mix-blend-overlay" />
    </div>
  );
};

export default AlleyBackdrop;
