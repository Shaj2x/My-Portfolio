import { useState } from "react";
import { Gamepad2 } from "lucide-react";
import MotionSection from "./MotionSection";
import PongGame from "./PongGame";
import SnakeGame from "./SnakeGame";

type GameType = "pong" | "snake";

const GameSection = () => {
  const [activeGame, setActiveGame] = useState<GameType>("pong");

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
        </div>

        {activeGame === "pong" ? <PongGame /> : <SnakeGame />}
      </MotionSection>
    </section>
  );
};

export default GameSection;
