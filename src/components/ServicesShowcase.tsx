import { useId, useState } from "react";
import { ArrowUpRight, ChevronDown, Mail } from "lucide-react";
import { profile, services } from "@/data/portfolio";

/**
 * What I build: the five service categories as cards, each with its main offerings as tags. "See
 * everything I build" opens a little more under every card, and "Start a project" opens an email.
 * Shared by the room (the desk chair, and Services in the dock) and the quick view.
 */
export const ServicesShowcase = ({ wide = false }: { wide?: boolean }) => {
  const [all, setAll] = useState(false);
  const moreId = useId();
  return (
    <div>
      <div className={`grid gap-3 sm:grid-cols-2 ${wide ? "lg:grid-cols-3 lg:gap-4" : ""}`}>
        {services.map((s, i) => (
          <article
            key={s.title}
            className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.06]"
          >
            <s.icon className="h-5 w-5 text-amber-200" aria-hidden="true" />
            <h3 className="mt-3 font-semibold text-white">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/65">{s.description}</p>
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`${s.title}: main offerings`}>
              {s.tags.map((t) => (
                <li key={t} className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-white/80">
                  {t}
                </li>
              ))}
            </ul>
            {/* more of this category, folded until "See everything I build" is open */}
            <div
              id={`${moreId}-${i}`}
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${all ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              aria-hidden={!all}
            >
              <ul className="min-h-0 overflow-hidden">
                {s.more.map((m) => (
                  <li key={m} className="flex gap-2 pt-2 text-sm text-white/65 first:mt-4 first:border-t first:border-white/10 first:pt-3">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-amber-200/70" aria-hidden="true" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          aria-expanded={all}
          aria-controls={services.map((_, i) => `${moreId}-${i}`).join(" ")}
          onClick={() => setAll((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:border-white/30 hover:bg-white/[0.1]"
        >
          {all ? "Show less" : "See everything I build"}
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ease-out ${all ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        <a
          href={`mailto:${profile.email}?subject=${encodeURIComponent("Starting a project")}`}
          className="inline-flex items-center gap-2 rounded-full bg-amber-200 px-4 py-2 text-sm font-semibold text-[#1a1408] transition-colors duration-150 hover:bg-amber-100"
        >
          <Mail className="h-4 w-4" aria-hidden="true" /> Start a project
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
};
