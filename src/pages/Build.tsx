import { ArrowUpRight } from "lucide-react";
import Layout from "@/components/site/Layout";
import InkPanel from "@/components/site/InkPanel";
import Offers from "@/components/build/Offers";
import Process from "@/components/build/Process";
import ContactSection from "@/components/site/ContactSection";
import { profile } from "@/content/profile";

const Build = () => (
  <Layout title="Build — Shajith Sasikumar">
    <InkPanel>
      <div className="measure py-16 md:py-24">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-muted">
          AI systems · Automation · Websites
        </p>

        <h1 className="display-wide mt-6 max-w-[20ch] text-[clamp(2rem,5.6vw,3.5rem)] font-extrabold text-ink-foreground">
          Automate the work that keeps your phone ringing after hours.
        </h1>

        <p className="mt-6 max-w-[56ch] text-[1.0625rem] leading-relaxed text-ink-muted">
          I build AI receptionists, voice agents and end-to-end pipelines for small businesses —
          scoped, built, deployed and handed over on your own accounts. You keep it; I'm not a
          subscription you can't leave.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a
            href="#contact"
            className="group inline-flex items-center gap-1.5 bg-ink-foreground px-5 py-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink transition-opacity hover:opacity-85"
          >
            Book a call
            <ArrowUpRight
              size={13}
              strokeWidth={2}
              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
          <a
            href={`mailto:${profile.email}`}
            className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-accent underline decoration-ink-accent/40 underline-offset-[5px] transition-colors hover:decoration-ink-accent"
          >
            {profile.email}
          </a>
        </div>
      </div>
    </InkPanel>

    <Offers />
    <Process />
    <ContactSection
      kicker="Get started"
      title="Tell me where the time goes"
      lead="Describe the work that eats your week. If automation isn't the answer, I'll say so on the call."
    />
  </Layout>
);

export default Build;
