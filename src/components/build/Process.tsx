import Band from "@/components/site/Band";
import Kicker from "@/components/site/Kicker";
import Reveal from "@/components/site/Reveal";
import { process } from "@/content/profile";

/** Genuinely a sequence, so the steps are genuinely numbered. */
const Process = () => (
  <Band id="process" tone="obsidian">
    <Reveal>
      <Kicker inverse>How it goes</Kicker>
      <h2 className="t-heading mt-7 max-w-[14ch]">Four steps, in this order</h2>
      <p className="t-body-sm mt-7 max-w-[46ch] text-paper/60">
        No retainer before you have seen a written scope.
      </p>
    </Reveal>

    <ol className="mt-11.5 border-t border-paper/20">
      {process.map((p, i) => (
        <Reveal
          as="li"
          key={p.step}
          delay={i * 0.06}
          className="grid grid-cols-1 items-baseline gap-x-3.5 gap-y-3 border-b border-paper/20 py-7 md:grid-cols-[132px_minmax(0,1fr)]"
        >
          <span className="t-label tnum text-paper/55">Step {i + 1}</span>
          <div>
            <h3 className="t-subheading">{p.step}</h3>
            <p className="t-body-sm mt-3 max-w-[54ch] text-paper/60">{p.body}</p>
          </div>
        </Reveal>
      ))}
    </ol>
  </Band>
);

export default Process;
