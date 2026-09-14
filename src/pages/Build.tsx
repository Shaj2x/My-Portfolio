import Layout from "@/components/site/Layout";
import Pill from "@/components/site/Pill";
import Offers from "@/components/build/Offers";
import Process from "@/components/build/Process";
import ContactSection from "@/components/site/ContactSection";
import { profile } from "@/content/profile";

/**
 * The inverse opening: an obsidian band rather than iridescence, since the
 * system allows only one chromatic backdrop per page and this page's weight
 * belongs on the offer, not the atmosphere.
 */
const Build = () => (
  <Layout title="Build — Shajith Sasikumar" darkHeader>
    <section
      id="start"
      data-dark-region
      className="flex min-h-[82svh] flex-col justify-end bg-obsidian pb-16 pt-[152px] text-paper"
    >
      <div className="shell">
        <p className="t-label text-paper/55">AI systems · Automation · Websites</p>

        <h1 className="t-heading mt-10 max-w-[17ch]">
          Automate the work that keeps your phone ringing after hours.
        </h1>

        <p className="t-lead mt-11.5 max-w-[40ch] text-paper/70">
          Built, deployed and handed over on your own accounts. You keep it.
        </p>

        <div className="mt-11.5 flex flex-wrap items-center gap-3.5">
          <Pill href="#contact" surface="dark">
            Book a call
          </Pill>
          <a href={`mailto:${profile.email}`} className="t-label link link-inverse text-paper/70">
            {profile.email}
          </a>
        </div>
      </div>
    </section>

    <Offers />
    <Process />
    <ContactSection
      kicker="Get started"
      title="Tell me where the time goes"
      lead="Describe the work that eats your week. If automation is not the answer, I will say so on the call."
    />
  </Layout>
);

export default Build;
