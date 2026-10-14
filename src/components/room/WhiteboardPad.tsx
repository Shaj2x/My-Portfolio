import { useEffect, useRef, useState } from "react";
import { Eraser, Trash2, Undo2, X } from "lucide-react";
import { DOODLE_KEY, loadDoodle } from "./whiteboardDoodle";

/**
 * Drawing on the whiteboard: the board as it is, with a transparent layer on top to draw on in
 * marker. Saving keeps the doodle in this browser and puts it on the board in the room; nobody
 * else sees it.
 */

const MARKERS = [
  { name: "Black", color: "#1d1d1f" },
  { name: "Blue", color: "#1f4fb4" },
  { name: "Red", color: "#c2272d" },
  { name: "Green", color: "#1e8a4c" },
];
const SIZES = [
  { name: "Fine", px: 6 },
  { name: "Thick", px: 14 },
];

export const WhiteboardPad = ({ base, onSave, onClose }: { base: { url: string; width: number; height: number }; onSave: (doodle: HTMLCanvasElement | null) => void; onClose: () => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(MARKERS[0].color);
  const [size, setSize] = useState(SIZES[0].px);
  const [erasing, setErasing] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const undo = useRef<ImageData[]>([]);
  const tool = useRef({ color, size, erasing });
  tool.current = { color, size, erasing };

  // start from the saved doodle, if there is one
  useEffect(() => {
    const canvas = canvasRef.current!;
    void loadDoodle().then((img) => {
      if (img) canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    });
  }, []);

  // drawing: smooth strokes through the midpoints of the pointer's path
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let last: { x: number; y: number } | null = null;
    let mid: { x: number; y: number } | null = null;
    const at = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
    };
    const style = () => {
      const t = tool.current;
      ctx.globalCompositeOperation = t.erasing ? "destination-out" : "source-over";
      ctx.strokeStyle = t.color;
      ctx.fillStyle = t.color;
      ctx.lineWidth = t.erasing ? 38 : t.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };
    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      undo.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (undo.current.length > 25) undo.current.shift();
      setCanUndo(true);
      style();
      last = mid = at(e);
      // a dot for a tap
      ctx.beginPath();
      ctx.arc(last.x, last.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    };
    const move = (e: PointerEvent) => {
      if (!last || !mid) return;
      const p = at(e);
      const m = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
      ctx.beginPath();
      ctx.moveTo(mid.x, mid.y);
      ctx.quadraticCurveTo(last.x, last.y, m.x, m.y);
      ctx.stroke();
      last = p;
      mid = m;
    };
    const up = () => {
      last = mid = null;
      ctx.globalCompositeOperation = "source-over";
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, []);

  const stepBack = () => {
    const prev = undo.current.pop();
    if (prev) canvasRef.current!.getContext("2d")!.putImageData(prev, 0, 0);
    setCanUndo(undo.current.length > 0);
  };
  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    undo.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    setCanUndo(true);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  const save = () => {
    const canvas = canvasRef.current!;
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let empty = true;
    for (let i = 3; i < data.length; i += 4)
      if (data[i]) {
        empty = false;
        break;
      }
    try {
      if (empty) localStorage.removeItem(DOODLE_KEY);
      else localStorage.setItem(DOODLE_KEY, canvas.toDataURL("image/png"));
    } catch {
      // too big or no storage: it still shows until the page closes
    }
    onSave(empty ? null : canvas);
  };

  const pill = "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors duration-150";
  return (
    <div className="w-[min(900px,calc(100vw-24px))] liquid-glass-panel rounded-[24px] p-3 text-white sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-amber-200/75">The whiteboard</p>
          <p className="text-sm text-white/65">Leave a doodle. It stays on the board, just for you.</p>
        </div>
        <button type="button" aria-label="Close without saving" className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-white/10" style={{ aspectRatio: `${base.width} / ${base.height}` }}>
        <img src={base.url} alt="The whiteboard" className="absolute inset-0 h-full w-full select-none" draggable={false} />
        <canvas ref={canvasRef} width={base.width} height={base.height} className={`absolute inset-0 h-full w-full touch-none ${erasing ? "cursor-cell" : "cursor-crosshair"}`} aria-label="Draw on the whiteboard" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {MARKERS.map((m) => (
          <button
            key={m.name}
            type="button"
            aria-label={`${m.name} marker`}
            aria-pressed={!erasing && color === m.color}
            onClick={() => {
              setColor(m.color);
              setErasing(false);
            }}
            className={`h-8 w-8 rounded-full border-2 transition-transform duration-150 ${!erasing && color === m.color ? "scale-110 border-white" : "border-white/20"}`}
            style={{ background: m.color }}
          />
        ))}
        <span className="mx-1 h-6 w-px bg-white/15" aria-hidden="true" />
        {SIZES.map((s) => (
          <button key={s.name} type="button" aria-pressed={size === s.px} onClick={() => setSize(s.px)} className={`${pill} ${size === s.px ? "bg-white/20" : "hover:bg-white/10"}`}>
            <span className="rounded-full bg-white" style={{ width: s.px / 1.6, height: s.px / 1.6 }} aria-hidden="true" />
            {s.name}
          </button>
        ))}
        <button type="button" aria-pressed={erasing} onClick={() => setErasing((v) => !v)} className={`${pill} ${erasing ? "bg-white/20" : "hover:bg-white/10"}`}>
          <Eraser className="h-4 w-4" /> Eraser
        </button>
        <button type="button" disabled={!canUndo} onClick={stepBack} className={`${pill} hover:bg-white/10 disabled:opacity-40`}>
          <Undo2 className="h-4 w-4" /> Undo
        </button>
        <button type="button" onClick={clear} className={`${pill} hover:bg-white/10`}>
          <Trash2 className="h-4 w-4" /> Clear
        </button>
        <button type="button" onClick={save} className="ml-auto inline-flex h-9 items-center rounded-full bg-amber-200 px-5 text-sm font-semibold text-[#1a1408] transition-colors duration-150 hover:bg-amber-100">
          Save to the board
        </button>
      </div>
    </div>
  );
};
