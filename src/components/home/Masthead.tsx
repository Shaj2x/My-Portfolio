import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { profile } from "@/content/profile";

const Masthead = () => (
  <section className="border-b border-border">
    <div className="measure pb-14 pt-12 md:pb-20 md:pt-20">
      <p className="meta">
        {profile.location} · Available for freelance work
      </p>

      <h1 className="display-wide mt-6 text-[clamp(2.125rem,6.2vw,4rem)] font-extrabold">
        {profile.statement}
      </h1>

      <p className="prose-measure mt-6 text-[1.0625rem] leading-relaxed text-muted-foreground">
        I'm Shajith — a first-year at Western, and before that a co-founder, a student council
        president and a returning officer for a federal election. I build things that keep running
        after I've walked away from them.
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link
          to="/build"
          className="group inline-flex items-center gap-1.5 bg-foreground px-4 py-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-85"
        >
          What I build for clients
          <ArrowUpRight
            size={13}
            strokeWidth={2}
            className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </Link>
        <a
          href={`mailto:${profile.email}`}
          className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-primary underline decoration-primary/30 underline-offset-[5px] transition-colors hover:decoration-primary"
        >
          {profile.email}
        </a>
      </div>
    </div>
  </section>
);

export default Masthead;
