import Reveal from "@/components/site/Reveal";
import SectionHead from "@/components/site/SectionHead";
import { about, profile } from "@/content/profile";

const facts = [
  { label: "Programme", value: "Engineering Science + Ivey HBA" },
  { label: "Institution", value: "Western University" },
  { label: "Secondary average", value: "96.3%" },
  { label: "Building since", value: "Age 15" },
];

const About = () => (
  <section id="about" className="section border-b border-border">
    <div className="measure">
      <SectionHead kicker="About" title="Who's writing this" />

      <div className="grid gap-10 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:gap-14">
        <Reveal className="space-y-5">
          {about.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="prose-measure leading-[1.68]">
              {paragraph}
            </p>
          ))}
        </Reveal>

        <Reveal delay={0.08}>
          <dl className="border-t border-border">
            {facts.map((f) => (
              <div
                key={f.label}
                className="flex items-baseline justify-between gap-4 border-b border-border py-3"
              >
                <dt className="meta">{f.label}</dt>
                <dd className="text-right font-display text-sm font-semibold tnum">{f.value}</dd>
              </div>
            ))}
          </dl>
          <a
            href={profile.resume}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-primary underline decoration-primary/30 underline-offset-[5px] transition-colors hover:decoration-primary"
          >
            Download résumé (PDF)
          </a>
        </Reveal>
      </div>
    </div>
  </section>
);

export default About;
