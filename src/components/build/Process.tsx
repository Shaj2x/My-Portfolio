import Reveal from "@/components/site/Reveal";
import SectionHead from "@/components/site/SectionHead";
import { process } from "@/content/profile";

/** Genuinely a sequence, so the steps are genuinely numbered. */
const Process = () => (
  <section id="process" className="section border-b border-border">
    <div className="measure">
      <SectionHead kicker="How it goes" title="Four steps, in this order">
        No retainer before you've seen a written scope.
      </SectionHead>

      <ol className="ledger">
        {process.map((p, i) => (
          <Reveal as="li" key={p.step} delay={i * 0.05} className="ledger-row">
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-primary tnum md:pt-1">
              Step {i + 1}
            </span>
            <div>
              <h3 className="font-display text-[1.0625rem] font-semibold">{p.step}</h3>
              <p className="prose-measure mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
                {p.body}
              </p>
            </div>
            <div aria-hidden="true" />
          </Reveal>
        ))}
      </ol>
    </div>
  </section>
);

export default Process;
