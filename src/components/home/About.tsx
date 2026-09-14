import Band from "@/components/site/Band";
import Kicker from "@/components/site/Kicker";
import Reveal from "@/components/site/Reveal";
import { about, profile } from "@/content/profile";

const facts = [
  { label: "Programme", value: "Engineering Science + Ivey HBA" },
  { label: "Institution", value: "Western University" },
  { label: "Secondary average", value: "96.3%" },
  { label: "Building since", value: "Age 15" },
];

/** Text-left / detail-right, per the system's asymmetric rhythm. */
const About = () => (
  <Band id="about">
    <Reveal>
      <Kicker>About</Kicker>
      <h2 className="t-heading-lg mt-7 max-w-[13ch]">Who is writing this</h2>
    </Reveal>

    <div className="mt-11.5 grid gap-11.5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Reveal delay={0.08} className="flex flex-col gap-7">
        {about.map((paragraph) => (
          <p key={paragraph.slice(0, 24)} className="t-body max-w-[54ch]">
            {paragraph}
          </p>
        ))}
      </Reveal>

      <Reveal delay={0.16}>
        <dl className="border-t border-obsidian/15">
          {facts.map((f) => (
            <div key={f.label} className="border-b border-obsidian/15 py-3.5">
              <dt className="t-label text-felt-gray">{f.label}</dt>
              <dd className="t-body-sm mt-2 tnum">{f.value}</dd>
            </div>
          ))}
        </dl>
        <a
          href={profile.resume}
          target="_blank"
          rel="noopener noreferrer"
          className="t-label link mt-7 inline-block"
        >
          Download résumé (PDF) →
        </a>
      </Reveal>
    </div>
  </Band>
);

export default About;
