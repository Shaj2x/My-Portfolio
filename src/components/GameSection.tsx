import { useState } from "react";
import { Gamepad2, Volume2, VolumeX } from "lucide-react";
import { useGameSound } from "./gameSound";
import MotionSection from "./MotionSection";
import PongGame from "./PongGame";
import SnakeGame from "./SnakeGame";

type GameType = "pong" | "snake";

const GameSection = () => {
  const [activeGame, setActiveGame] = useState<GameType>("pong");
  const [soundOn, setSoundOn] = useGameSound();

  return (
    <section id="pong" className="section-padding">
      <MotionSection className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          <span className="text-gradient">🎮</span> Mini Games
        </h2>

        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setActiveGame("pong")}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
              activeGame === "pong"
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            <Gamepad2 size={14} className="inline mr-2 -mt-0.5" />
            Pong
          </button>
          <button
            onClick={() => setActiveGame("snake")}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
              activeGame === "snake"
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            <Gamepad2 size={14} className="inline mr-2 -mt-0.5" />
            Snake
          </button>
          <button
            onClick={() => setSoundOn(!soundOn)}
            aria-pressed={soundOn}
            aria-label={soundOn ? "Turn game sound off" : "Turn game sound on"}
            className="px-3 py-2 rounded-md text-sm font-medium border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {soundOn ? <Volume2 size={14} className="inline -mt-0.5" /> : <VolumeX size={14} className="inline -mt-0.5" />}
          </button>
        </div>

        {activeGame === "pong" ? <PongGame /> : <SnakeGame />}
      </MotionSection>
    </section>
  );
};

export default GameSection;
