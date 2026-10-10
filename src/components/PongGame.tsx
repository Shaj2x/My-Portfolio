import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";

import ssLogo from "@/assets/ss-logo-new.png";
import { sfx } from "@/components/gameSound";

const CANVAS_W = 600;
const CANVAS_H = 400;
const PADDLE_W = 12;
const PADDLE_H = 80;
const BALL_R = 18;
const PADDLE_SPEED = 5;
const INITIAL_BALL_SPEED = 4;
const WIN_SCORE = 5;

/** `showHelp` off hides the how-to-play line, for hosts that show it themselves */
const PongGame = ({ showHelp = true }: { showHelp?: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [score, setScore] = useState({ player: 0, cpu: 0 });
  const [winner, setWinner] = useState<string | null>(null);
  const logoImg = useRef<HTMLImageElement | null>(null);
  const gameState = useRef({
    ballX: CANVAS_W / 2,
    ballY: CANVAS_H / 2,
    ballVX: INITIAL_BALL_SPEED,
    ballVY: INITIAL_BALL_SPEED * 0.6,
    playerY: CANVAS_H / 2 - PADDLE_H / 2,
    cpuY: CANVAS_H / 2 - PADDLE_H / 2,
    keys: {} as Record<string, boolean>,
    /** where a finger (or a dragging mouse) wants the paddle's centre, in canvas units */
    touchY: null as number | null,
    lastT: 0,
    animId: 0,
    playerScore: 0,
    cpuScore: 0,
  });

  useEffect(() => {
    const img = new Image();
    img.src = ssLogo;
    img.onload = () => { logoImg.current = img; };
  }, []);

  const resetBall = useCallback(() => {
    const g = gameState.current;
    g.ballX = CANVAS_W / 2;
    g.ballY = CANVAS_H / 2;
    g.ballVX = INITIAL_BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
    g.ballVY = INITIAL_BALL_SPEED * 0.6 * (Math.random() > 0.5 ? 1 : -1);
  }, []);

  const endGame = useCallback((winnerName?: string) => {
    cancelAnimationFrame(gameState.current.animId);
    setPlaying(false);
    if (winnerName) setWinner(winnerName);
  }, []);

  // touch: drag anywhere on the board and the paddle follows your finger
  const aim = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    gameState.current.touchY = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
  };
  const release = () => {
    gameState.current.touchY = null;
  };

  const startGame = useCallback(() => {
    const g = gameState.current;
    g.touchY = null;
    g.lastT = 0;
    g.playerScore = 0;
    g.cpuScore = 0;
    g.playerY = CANVAS_H / 2 - PADDLE_H / 2;
    g.cpuY = CANVAS_H / 2 - PADDLE_H / 2;
    setScore({ player: 0, cpu: 0 });
    setWinner(null);
    resetBall();
    setPlaying(true);
    sfx("start");
  }, [resetBall]);

  useEffect(() => {
    if (!playing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const g = gameState.current;

    const handleKey = (e: KeyboardEvent) => { g.keys[e.key] = e.type === "keydown"; };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);

    const loop = (t: number) => {
      // speeds are tuned per 60 Hz frame; scale them so 120 Hz phones don't play at double speed
      const k = g.lastT ? Math.min(t - g.lastT, 50) / (1000 / 60) : 1;
      g.lastT = t;

      // Player movement
      if (g.keys["ArrowUp"] || g.keys["w"]) g.playerY = Math.max(0, g.playerY - PADDLE_SPEED * k);
      if (g.keys["ArrowDown"] || g.keys["s"]) g.playerY = Math.min(CANVAS_H - PADDLE_H, g.playerY + PADDLE_SPEED * k);
      if (g.touchY !== null) g.playerY = Math.max(0, Math.min(CANVAS_H - PADDLE_H, g.touchY - PADDLE_H / 2));

      // CPU AI
      // CPU AI — slower and with a dead zone so it's easier to beat
      const cpuCenter = g.cpuY + PADDLE_H / 2;
      const diff = g.ballY - cpuCenter;
      if (Math.abs(diff) > 30) {
        g.cpuY += Math.sign(diff) * PADDLE_SPEED * 0.4 * k;
      }
      g.cpuY = Math.max(0, Math.min(CANVAS_H - PADDLE_H, g.cpuY));

      // Ball movement
      g.ballX += g.ballVX * k;
      g.ballY += g.ballVY * k;

      // Top/bottom bounce
      // (pushed back inside so a long frame can't leave it stuck in the wall)
      if (g.ballY - BALL_R <= 0) { g.ballY = BALL_R; g.ballVY = Math.abs(g.ballVY); sfx("wall"); }
      else if (g.ballY + BALL_R >= CANVAS_H) { g.ballY = CANVAS_H - BALL_R; g.ballVY = -Math.abs(g.ballVY); sfx("wall"); }

      // Player paddle collision
      if (g.ballX - BALL_R <= PADDLE_W + 10 && g.ballY >= g.playerY && g.ballY <= g.playerY + PADDLE_H && g.ballVX < 0) {
        g.ballVX *= -1.05;
        g.ballVY = ((g.ballY - g.playerY) / PADDLE_H - 0.5) * INITIAL_BALL_SPEED * 1.5;
        sfx("paddle");
      }

      // CPU paddle collision
      if (g.ballX + BALL_R >= CANVAS_W - PADDLE_W - 10 && g.ballY >= g.cpuY && g.ballY <= g.cpuY + PADDLE_H && g.ballVX > 0) {
        g.ballVX *= -1.05;
        g.ballVY = ((g.ballY - g.cpuY) / PADDLE_H - 0.5) * INITIAL_BALL_SPEED * 1.5;
        sfx("paddle");
      }

      // Scoring
      if (g.ballX < 0) {
        g.cpuScore++;
        setScore({ player: g.playerScore, cpu: g.cpuScore });
        if (g.cpuScore >= WIN_SCORE) { sfx("lose"); endGame("CPU"); return; }
        sfx("miss");
        resetBall();
      } else if (g.ballX > CANVAS_W) {
        g.playerScore++;
        setScore({ player: g.playerScore, cpu: g.cpuScore });
        if (g.playerScore >= WIN_SCORE) { sfx("win"); endGame("You"); return; }
        sfx("point");
        resetBall();
      }

      // Draw
      ctx.fillStyle = getComputedStyle(canvas).getPropertyValue("--bg-color") || "#0a0a0a";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Center line
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = "hsl(0, 0%, 25%)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(CANVAS_W / 2, 0);
      ctx.lineTo(CANVAS_W / 2, CANVAS_H);
      ctx.stroke();
      ctx.setLineDash([]);

      // Paddles
      const primaryColor = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
      const paddleColor = primaryColor ? `hsl(${primaryColor})` : "hsl(0, 85%, 55%)";
      ctx.fillStyle = paddleColor;
      ctx.shadowColor = paddleColor;
      ctx.shadowBlur = 12;
      ctx.fillRect(10, g.playerY, PADDLE_W, PADDLE_H);
      ctx.fillRect(CANVAS_W - PADDLE_W - 10, g.cpuY, PADDLE_W, PADDLE_H);
      ctx.shadowBlur = 0;

      // Ball (logo)
      if (logoImg.current) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(g.ballX, g.ballY, BALL_R, 0, Math.PI * 2);
        ctx.clip();
        // crop to the S in the middle of the logo's black square
        const img = logoImg.current;
        ctx.drawImage(img, img.width * 0.2, img.height * 0.2, img.width * 0.6, img.height * 0.6, g.ballX - BALL_R, g.ballY - BALL_R, BALL_R * 2, BALL_R * 2);
        ctx.restore();
        ctx.shadowColor = paddleColor;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(g.ballX, g.ballY, BALL_R, 0, Math.PI * 2);
        ctx.strokeStyle = paddleColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = paddleColor;
        ctx.beginPath();
        ctx.arc(g.ballX, g.ballY, BALL_R, 0, Math.PI * 2);
        ctx.fill();
      }

      // Score
      ctx.fillStyle = "hsl(0, 0%, 40%)";
      ctx.font = "bold 48px 'Space Grotesk', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(g.playerScore), CANVAS_W / 4, 60);
      ctx.fillText(String(g.cpuScore), (3 * CANVAS_W) / 4, 60);

      g.animId = requestAnimationFrame(loop);
    };

    g.animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(g.animId);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
    };
  }, [playing, resetBall, endGame]);

  return (
    <div className="text-center">
      <p className={`text-muted-foreground mb-8 ${showHelp ? "" : "hidden"}`}>
        First to {WIN_SCORE} wins! Use <span className="text-primary font-mono">W/S</span> or <span className="text-primary font-mono">↑/↓</span> to move, or drag on the board.
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
            aim(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons || e.pointerType === "touch") aim(e);
          }}
          onPointerUp={release}
          onPointerCancel={release}
        />
        {!playing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <img src={ssLogo} alt="SS Logo" className="w-16 h-16 mb-4 rounded-full" />
            {winner && (
              <p className="text-2xl font-bold mb-4 text-primary">{winner} Win{winner === "You" ? "" : "s"}!</p>
            )}
            <button
              onClick={startGame}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-lg"
            >
              {winner ? "Play Again" : "Start Game"}
            </button>
            {(score.player > 0 || score.cpu > 0) && !winner && (
              <p className="mt-4 text-muted-foreground font-mono">
                Last: You {score.player} – {score.cpu} CPU
              </p>
            )}
          </motion.div>
        )}
      </div>

      {playing && (
        <div className="mt-4 flex items-center justify-center gap-6">
          <p className="text-sm text-muted-foreground font-mono">
            You {score.player} – {score.cpu} CPU
          </p>
          <button
            onClick={() => endGame()}
            className="px-4 py-1.5 text-sm border border-border text-muted-foreground rounded-md hover:border-primary hover:text-primary transition-colors"
          >
            End Game
          </button>
        </div>
      )}
    </div>
  );
};

export default PongGame;
