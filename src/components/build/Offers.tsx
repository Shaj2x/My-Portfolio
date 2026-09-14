import Reveal from "@/components/site/Reveal";
import SectionHead from "@/components/site/SectionHead";
import { offers } from "@/content/profile";

const Offers = () => (
  <section id="offers" className="section border-b border-border">
    <div className="measure">
      <SectionHead kicker="Offers" title="What you can actually buy">
        Six things, each scoped so you know what arrives and when. Pricing is quoted per project
        after the first call — there's no honest number I can put here without knowing the work.
      </SectionHead>

      <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
        {offers.map((offer, i) => (
          <Reveal key={offer.name} delay={i * 0.05} className="border-t-2 border-foreground pt-5">
            <h3 className="font-display text-[1.125rem] font-bold">{offer.name}</h3>
            <p className="mt-1.5 font-display text-[0.9375rem] font-medium text-primary">
              {offer.promise}
            </p>
            <p className="mt-3.5 text-[0.9375rem] leading-relaxed text-muted-foreground">
              {offer.detail}
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5">
              {offer.outcomes.map((o) => (
                <li
                  key={o}
                  className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-muted-foreground"
                >
                  {o}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export default Offers;
