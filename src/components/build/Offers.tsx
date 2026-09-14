import Band from "@/components/site/Band";
import Kicker from "@/components/site/Kicker";
import Reveal from "@/components/site/Reveal";
import { offers } from "@/content/profile";

/**
 * Single-column list rows rather than a card grid — each offer gets the full
 * measure, with a hairline rule and no chrome around it.
 */
const Offers = () => (
  <Band id="offers">
    <Reveal>
      <Kicker>Offers</Kicker>
      <h2 className="t-heading-lg mt-7 max-w-[15ch]">What you can actually buy</h2>
      <p className="t-body-sm mt-7 max-w-[54ch] text-felt-gray">
        Six things, each scoped so you know what arrives and when. Pricing is quoted per project
        after the first call — there is no honest number I can put here without knowing the work.
      </p>
    </Reveal>

    <ul className="mt-11.5 border-t border-obsidian/15">
      {offers.map((offer, i) => (
        <Reveal
          as="li"
          key={offer.name}
          delay={i * 0.06}
          className="grid grid-cols-1 gap-x-3.5 gap-y-3.5 border-b border-obsidian/15 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
        >
          <div>
            <h3 className="t-subheading">{offer.name}</h3>
            <p className="t-body-sm mt-3 max-w-[34ch] text-felt-gray">{offer.promise}</p>
          </div>

          <div>
            <p className="t-body max-w-[52ch]">{offer.detail}</p>
            <ul className="mt-7 flex flex-wrap gap-2">
              {offer.outcomes.map((o) => (
                <li key={o} className="t-label rounded-pill border border-obsidian px-7 py-3">
                  {o}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      ))}
    </ul>
  </Band>
);

export default Offers;
