import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import ssLogo from "@/assets/ss-logo-new.png";
import { sfx } from "@/components/gameSound";

const CANVAS_W = 600;
const CANVAS_H = 400;
const CELL = 20;
const COLS = CANVAS_W / CELL;
const ROWS = CANVAS_H / CELL;
const TICK_MS = 120;

type Point = { x: number; y: number };
type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";

const randomFood = (snake: Point[]): Point => {
  let p: Point;
  do {
    p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some((s) => s.x === p.x && s.y === p.y));
  return p;
};

/** `showHelp` off hides the how-to-play line, for hosts that show it themselves */
const SnakeGame = ({ showHelp = true }: { showHelp?: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const state = useRef({
    snake: [{ x: 5, y: Math.floor(ROWS / 2) }] as Point[],
    dir: "RIGHT" as Dir,
    nextDir: "RIGHT" as Dir,
    food: { x: 15, y: Math.floor(ROWS / 2) } as Point,
    score: 0,
    intervalId: undefined as ReturnType<typeof setInterval> | undefined,
  });

  const logoImg = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = ssLogo;
    img.onload = () => { logoImg.current = img; };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = state.current;

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
    const color = primaryColor ? `hsl(${primaryColor})` : "hsl(0, 85%, 55%)";

    // Background
    ctx.fillStyle = getComputedStyle(canvas).getPropertyValue("--bg-color") || "#0a0a0a";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid dots
    ctx.fillStyle = "hsl(0, 0%, 15%)";
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        ctx.fillRect(x * CELL + CELL / 2, y * CELL + CELL / 2, 1, 1);
      }
    }

    // Food (logo)
    if (logoImg.current) {
      ctx.save();
      const fx = s.food.x * CELL + CELL / 2;
      const fy = s.food.y * CELL + CELL / 2;
      ctx.beginPath();
      ctx.arc(fx, fy, CELL / 2, 0, Math.PI * 2);
      ctx.clip();
      // the S sits in the middle of the logo's black square: crop to it so it fills the circle
      const img = logoImg.current;
      ctx.drawImage(img, img.width * 0.2, img.height * 0.2, img.width * 0.6, img.height * 0.6, s.food.x * CELL, s.food.y * CELL, CELL, CELL);
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(fx, fy, CELL / 2 - 0.75, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(s.food.x * CELL, s.food.y * CELL, CELL, CELL);
    }

    // Snake
    s.snake.forEach((seg, i) => {
      const alpha = 1 - (i / s.snake.length) * 0.6;
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = color;
      ctx.shadowBlur = i === 0 ? 10 : 0;
      const pad = i === 0 ? 0 : 2;
      ctx.beginPath();
      ctx.roundRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 4);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Score
    ctx.fillStyle = "hsl(0, 0%, 40%)";
    ctx.font = "bold 20px 'Space Grotesk', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`Score: ${s.score}`, CANVAS_W - 16, 30);
  }, []);

  const endGame = useCallback(() => {
    clearInterval(state.current.intervalId);
    setPlaying(false);
    setGameOver(true);
    setHighScore((prev) => Math.max(prev, state.current.score));
  }, []);

  const tick = useCallback(() => {
    const s = state.current;
    s.dir = s.nextDir;
    const head = { ...s.snake[0] };

    if (s.dir === "UP") head.y--;
    else if (s.dir === "DOWN") head.y++;
    else if (s.dir === "LEFT") head.x--;
    else head.x++;

    // Wall or self collision
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || s.snake.some((seg) => seg.x === head.x && seg.y === head.y)) {
      sfx("crash");
      endGame();
      return;
    }

    s.snake.unshift(head);

    if (head.x === s.food.x && head.y === s.food.y) {
      s.score++;
      setScore(s.score);
      sfx("eat");
      s.food = randomFood(s.snake);
    } else {
      s.snake.pop();
    }

    draw();
  }, [draw, endGame]);

  const startGame = useCallback(() => {
    const s = state.current;
    s.snake = [{ x: 5, y: Math.floor(ROWS / 2) }];
    s.dir = "RIGHT";
    s.nextDir = "RIGHT";
    s.food = randomFood(s.snake);
    s.score = 0;
    setScore(0);
    setGameOver(false);
    setPlaying(true);
    sfx("start");
    draw();
    s.intervalId = setInterval(tick, TICK_MS);
  }, [draw, tick]);

  // one way in for every control: keys, swipes and the touch D-pad
  const steer = useCallback((newDir: Dir) => {
    const s = state.current;
    const opposites: Record<Dir, Dir> = { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" };
    if (newDir !== opposites[s.dir]) s.nextDir = newDir;
  }, []);

  // touch: a swipe on the board turns the snake the way the finger went
  const swipeFrom = useRef<{ x: number; y: number } | null>(null);
  const onSwipeMove = (e: React.PointerEvent) => {
    const from = swipeFrom.current;
    if (!from) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "RIGHT" : "LEFT") : dy > 0 ? "DOWN" : "UP");
    // keep tracking from here, so one long drag can make several turns
    swipeFrom.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    if (!playing) return;
    const handleKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: "UP", w: "UP", W: "UP",
        ArrowDown: "DOWN", s: "DOWN", S: "DOWN",
        ArrowLeft: "LEFT", a: "LEFT", A: "LEFT",
        ArrowRight: "RIGHT", d: "RIGHT", D: "RIGHT",
      };
      const newDir = map[e.key];
      if (!newDir) return;
      e.preventDefault();
      steer(newDir);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      clearInterval(state.current.intervalId);
      window.removeEventListener("keydown", handleKey);
    };
  }, [playing, steer]);

  return (
    <div className="text-center">
      <p className={`text-muted-foreground mb-8 ${showHelp ? "" : "hidden"}`}>
        Use <span className="text-primary font-mono">W/A/S/D</span>, the <span className="text-primary font-mono">Arrow Keys</span>, or swipe on the board. Eat the logo to grow!
      </p>
      <div className="relative inline-block rounded-lg overflow-hidden border border-border">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block bg-background max-w-full touch-none select-none"
          style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            swipeFrom.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerMove={onSwipeMove}
          onPointerUp={() => (swipeFrom.current = null)}
          onPointerCancel={() => (swipeFrom.current = null)}
        />
        {!playing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <img src={ssLogo} alt="SS Logo" className="w-16 h-16 mb-4 rounded-full" />
            {gameOver && (
              <p className="text-2xl font-bold mb-2 text-primary">Game Over!</p>
            )}
            {gameOver && (
              <p className="text-muted-foreground mb-4 font-mono">
                Score: {score} | Best: {highScore}
              </p>
            )}
            <button
              onClick={startGame}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-lg"
            >
              {gameOver ? "Play Again" : "Start Game"}
            </button>
          </motion.div>
        )}
      </div>
      {/* a D-pad under the board, only on touch screens */}
      {playing && (
        <div className="mx-auto mt-4 hidden w-40 select-none grid-cols-3 gap-1.5 [@media(pointer:coarse)]:grid" aria-label="Steer">
          {(
            [
              ["UP", "↑", "col-start-2"],
              ["LEFT", "←", "col-start-1 row-start-2"],
              ["RIGHT", "→", "col-start-3 row-start-2"],
              ["DOWN", "↓", "col-start-2 row-start-3"],
            ] as [Dir, string, string][]
          ).map(([d, label, pos]) => (
            <button
              key={d}
              type="button"
              aria-label={d.toLowerCase()}
              onPointerDown={(e) => {
                e.preventDefault();
                steer(d);
              }}
              className={`${pos} grid h-12 touch-none place-items-center rounded-xl border border-border bg-white/10 text-xl text-white active:scale-95 active:bg-white/25`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {playing && (
        <div className="mt-4 flex items-center justify-center gap-6">
          <p className="text-sm text-muted-foreground font-mono">
            Score: {score}
          </p>
          <button
            onClick={endGame}
            className="px-4 py-1.5 text-sm border border-border text-muted-foreground rounded-md hover:border-primary hover:text-primary transition-colors"
          >
            End Game
          </button>
        </div>
      )}
    </div>
  );
};

export default SnakeGame;
