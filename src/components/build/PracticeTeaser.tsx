import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import InkPanel from "@/components/site/InkPanel";
import { offers } from "@/content/profile";

/** The one dark interruption on the profile page — it points at the practice. */
const PracticeTeaser = () => (
  <InkPanel>
    <div className="measure py-14 md:py-20">
      <div className="grid gap-9 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-end md:gap-14">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-muted">
            The practice
          </p>
          <h2 className="mt-4 text-[clamp(1.625rem,4.2vw,2.5rem)] font-bold text-ink-foreground">
            I also build automated systems for businesses that can't hire for the work.
          </h2>
          <p className="mt-4 max-w-[54ch] text-[1.0625rem] leading-relaxed text-ink-muted">
            Receptionists that answer every call, agents that qualify leads on the phone, and
            pipelines that move the paperwork while you do the job people pay you for.
          </p>
          <Link
            to="/build"
            className="group mt-8 inline-flex items-center gap-1.5 bg-ink-foreground px-4 py-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink transition-opacity hover:opacity-85"
          >
            See what I build
            <ArrowUpRight
              size={13}
              strokeWidth={2}
              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </Link>
        </div>

        <ul className="space-y-0 border-t border-ink-border">
          {offers.slice(0, 4).map((o) => (
            <li
              key={o.name}
              className="flex items-baseline justify-between gap-4 border-b border-ink-border py-3"
            >
              <span className="font-display text-sm font-semibold text-ink-foreground">
                {o.name}
              </span>
              <span className="text-right font-mono text-[0.625rem] uppercase tracking-[0.1em] text-ink-accent">
                {o.outcomes[0]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </InkPanel>
);

export default PracticeTeaser;
