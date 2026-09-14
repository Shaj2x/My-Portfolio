import { useRef, useEffect, useState, useCallback } from "react";
import ssLogo from "@/assets/ss-mark.png";
import { canvasTheme, GAME_FONT } from "@/lib/canvas-theme";

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

const SnakeGame = () => {
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
    intervalId: 0 as ReturnType<typeof setInterval> | 0,
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

    const paint = canvasTheme();
    const color = paint.accent;

    // Background
    ctx.fillStyle = paint.ground;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid dots
    ctx.fillStyle = paint.line;
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
      ctx.drawImage(logoImg.current, s.food.x * CELL, s.food.y * CELL, CELL, CELL);
      ctx.restore();
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
    ctx.fillStyle = paint.dim;
    ctx.font = `bold 20px ${GAME_FONT}`;
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
      endGame();
      return;
    }

    s.snake.unshift(head);

    if (head.x === s.food.x && head.y === s.food.y) {
      s.score++;
      setScore(s.score);
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
    draw();
    s.intervalId = setInterval(tick, TICK_MS);
  }, [draw, tick]);

  useEffect(() => {
    if (!playing) return;
    const handleKey = (e: KeyboardEvent) => {
      const s = state.current;
      const map: Record<string, Dir> = {
        ArrowUp: "UP", w: "UP", W: "UP",
        ArrowDown: "DOWN", s: "DOWN", S: "DOWN",
        ArrowLeft: "LEFT", a: "LEFT", A: "LEFT",
        ArrowRight: "RIGHT", d: "RIGHT", D: "RIGHT",
      };
      const newDir = map[e.key];
      if (!newDir) return;
      e.preventDefault();
      const opposites: Record<Dir, Dir> = { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" };
      if (newDir !== opposites[s.dir]) s.nextDir = newDir;
    };
    window.addEventListener("keydown", handleKey);
    const game = state.current;
    return () => {
      clearInterval(game.intervalId);
      window.removeEventListener("keydown", handleKey);
    };
  }, [playing]);

  return (
    <div>
      <p className="mb-6 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-muted-foreground">
        Use <span className="text-foreground">W/A/S/D</span> or <span className="text-foreground">Arrow Keys</span> to move. Eat the logo to grow!
      </p>
      <div className="relative inline-block max-w-full overflow-hidden border border-border bg-ink">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block max-w-full bg-ink"
          style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
        />
        {!playing && (
          <div className="fade-in absolute inset-0 flex flex-col items-center justify-center bg-ink/85 text-ink-foreground backdrop-blur-sm">
            <img src={ssLogo} alt="SS Logo" className="mb-4 h-14 w-14 rounded-full" />
            {gameOver && (
              <p className="mb-2 font-display text-2xl font-bold text-ink-accent">Game Over!</p>
            )}
            {gameOver && (
              <p className="mb-4 font-mono text-sm text-ink-muted">
                Score: {score} | Best: {highScore}
              </p>
            )}
            <button
              onClick={startGame}
              className="bg-ink-foreground px-6 py-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink transition-opacity hover:opacity-85"
            >
              {gameOver ? "Play Again" : "Start Game"}
            </button>
          </div>
        )}
      </div>
      {playing && (
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-muted-foreground tnum">
            Score: {score}
          </p>
          <button
            onClick={endGame}
            className="border border-border px-3.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            End Game
          </button>
        </div>
      )}
    </div>
  );
};

export default SnakeGame;
