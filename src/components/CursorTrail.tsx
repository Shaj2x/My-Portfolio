import { useEffect, useRef } from "react";
import { useTheme, AccentColor } from "./ThemeProvider";

const accentHSL: Record<AccentColor, string> = {
  red: "0, 72%, 51%",
  blue: "217, 91%, 60%",
  green: "142, 71%, 45%",
  purple: "270, 70%, 55%",
  orange: "25, 95%, 53%",
};

interface Particle {
  x: number;
  y: number;
  life: number;
  vx: number;
  vy: number;
  size: number;
}

const CursorTrail = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { accent } = useTheme();
  const accentRef = useRef(accent);
  const mouseRef = useRef({ x: 0, y: 0, moving: false });
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef(0);

  useEffect(() => {
    accentRef.current = accent;
  }, [accent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Skip on touch / coarse pointer devices
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let timeout: any;
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.moving = true;
      clearTimeout(timeout);
      timeout = setTimeout(() => { mouseRef.current.moving = false; }, 80);

      // Spawn particles
      for (let i = 0; i < 2; i++) {
        particlesRef.current.push({
          x: e.clientX,
          y: e.clientY,
          life: 1,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: Math.random() * 4 + 2,
        });
      }
      if (particlesRef.current.length > 80) {
        particlesRef.current = particlesRef.current.slice(-80);
      }
    };

    window.addEventListener("mousemove", onMove);

    const ctx = canvas.getContext("2d")!;
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const hsl = accentHSL[accentRef.current];

      particlesRef.current = particlesRef.current.filter((p) => {
        p.life -= 0.025;
        p.x += p.vx;
        p.y += p.vy;
        if (p.life <= 0) return false;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hsl}, ${p.life * 0.6})`;
        ctx.fill();
        return true;
      });

      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", resize);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9999] pointer-events-none"
      aria-hidden="true"
    />
  );
};

export default CursorTrail;
