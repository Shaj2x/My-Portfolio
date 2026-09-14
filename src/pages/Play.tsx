import { useState } from "react";
import Layout from "@/components/site/Layout";
import Band from "@/components/site/Band";
import Kicker from "@/components/site/Kicker";
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
      <Band id="start">
        <div className="pt-16">
          <Kicker>Play</Kicker>
          <h1 className="t-heading-lg mt-7 max-w-[15ch]">Two games I wrote instead of sleeping</h1>
          <p className="t-body-sm mt-7 max-w-[52ch] text-felt-gray">
            Both run entirely in the browser — no engine, no library, just a canvas and a game
            loop. They are here because building them was the fastest way to learn collision
            detection and state machines.
          </p>
        </div>

        <div role="tablist" aria-label="Choose a game" className="mt-11.5 flex gap-2">
          {games.map((g) => (
            <button
              key={g.key}
              role="tab"
              id={`tab-${g.key}`}
              aria-selected={active === g.key}
              aria-controls={`panel-${g.key}`}
              onClick={() => setActive(g.key)}
              className={[
                "t-label rounded-pill border px-7 py-3 transition-colors duration-move ease-monopo",
                active === g.key
                  ? "border-obsidian text-obsidian"
                  : "border-obsidian/25 text-felt-gray hover:border-obsidian",
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
          className="mt-11.5"
        >
          {active === "pong" ? <PongGame /> : <SnakeGame />}
        </div>
      </Band>
    </Layout>
  );
};

export default Play;
