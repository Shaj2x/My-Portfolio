import Band from "@/components/site/Band";
import Kicker from "@/components/site/Kicker";
import Reveal from "@/components/site/Reveal";
import Pill from "@/components/site/Pill";
import { offers } from "@/content/profile";

/** The inverse register: an obsidian band marking where the practice begins. */
const PracticeTeaser = () => (
  <Band tone="obsidian">
    <Reveal>
      <Kicker inverse>The practice</Kicker>
      <h2 className="t-heading mt-7 max-w-[16ch]">
        I also build automated systems for businesses that cannot hire for the work.
      </h2>
    </Reveal>

    <div className="mt-11.5 grid gap-11.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Reveal delay={0.08}>
        <p className="t-body-sm max-w-[48ch] text-paper/60">
          Receptionists that answer every call, agents that qualify leads on the phone, and
          pipelines that move the paperwork while you do the job people pay you for.
        </p>
        <div className="mt-10">
          <Pill to="/build" surface="dark">
            See what I build
          </Pill>
        </div>
      </Reveal>

      <Reveal delay={0.16}>
        <ul className="border-t border-paper/20">
          {offers.slice(0, 4).map((o) => (
            <li
              key={o.name}
              className="flex items-baseline justify-between gap-3.5 border-b border-paper/20 py-3.5"
            >
              <span className="t-body-sm">{o.name}</span>
              <span className="t-label text-right text-paper/55">{o.outcomes[0]}</span>
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  </Band>
);

export default PracticeTeaser;
