import Band from "@/components/site/Band";
import Reveal from "@/components/site/Reveal";
import Pill from "@/components/site/Pill";

/**
 * Whisper weight at display scale — 300 where most systems would push 600.
 * The statement is spoken, not shouted.
 */
const Manifesto = () => (
  <Band id="start">
    <Reveal>
      <h2 className="t-heading max-w-[23ch]">
        Engineering Science + Ivey HBA at Western, and a practice building automated systems.
      </h2>
    </Reveal>

    <Reveal delay={0.12} className="mt-11.5 grid gap-11.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <p className="t-lead max-w-[32ch]">
        I build things that keep running after I have walked away from them.
      </p>
      <div>
        <p className="t-body-sm max-w-[52ch] text-felt-gray">
          A first-year at Western, and before that a co-founder at fifteen, a student council
          president, and a returning officer for a federal election. The work moves between
          engineering, business and whatever the problem actually needs.
        </p>
        <div className="mt-10 flex flex-wrap gap-3.5">
          <Pill to="/build">What I build for clients</Pill>
          <Pill href="#contact">Get in touch</Pill>
        </div>
      </div>
    </Reveal>
  </Band>
);

export default Manifesto;
