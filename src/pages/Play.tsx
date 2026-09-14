import { useState } from "react";
import Layout from "@/components/site/Layout";
import PongGame from "@/components/PongGame";
import SnakeGame from "@/components/SnakeGame";

type GameKey = "pong" | "snake";

const games: { key: GameKey; name: string }[] = [
  { key: "pong", name: "Pong" },
  { key: "snake", name: "Snake" },
];

const Play = () => {
  const [active, setActive] = useState<GameKey>("pong");

  return (
    <Layout title="Play — Shajith Sasikumar">
      <section className="section">
        <div className="measure">
          <header className="mb-10">
            <p className="meta">Play</p>
            <h1 className="mt-3 text-[clamp(1.75rem,4.4vw,2.75rem)] font-bold">
              Two games I wrote instead of sleeping
            </h1>
            <p className="prose-measure mt-4 text-[1.0625rem] leading-relaxed text-muted-foreground">
              Both run entirely in the browser — no engine, no library, just a canvas and a game
              loop. They're here because building them was the fastest way to learn collision
              detection and state machines.
            </p>
          </header>

          <div
            role="tablist"
            aria-label="Choose a game"
            className="flex border-b border-border"
          >
            {games.map((g) => (
              <button
                key={g.key}
                role="tab"
                id={`tab-${g.key}`}
                aria-selected={active === g.key}
                aria-controls={`panel-${g.key}`}
                onClick={() => setActive(g.key)}
                className={[
                  "-mb-px border-b-2 px-4 py-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] transition-colors",
                  active === g.key
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {g.name}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id={`panel-${active}`}
            aria-labelledby={`tab-${active}`}
            className="mt-8"
          >
            {active === "pong" ? <PongGame /> : <SnakeGame />}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Play;
