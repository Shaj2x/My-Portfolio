import Reveal from "@/components/site/Reveal";
import SectionHead from "@/components/site/SectionHead";
import LedgerRow from "@/components/site/LedgerRow";
import { education, experience, leadership, RecordEntry } from "@/content/profile";

const period = (e: RecordEntry) => (e.start === e.end ? e.start : `${e.start}–${e.end}`);

const Group = ({ label, entries }: { label: string; entries: RecordEntry[] }) => (
  <div>
    <h3 className="meta mb-3">{label}</h3>
    <ul className="ledger">
      {entries.map((e) => (
        <LedgerRow
          key={`${e.title}-${e.start}`}
          period={period(e)}
          title={e.title}
          org={e.org}
          note={e.note}
          tag={e.tag}
        />
      ))}
    </ul>
  </div>
);

const Record = () => (
  <section id="record" className="section border-b border-border">
    <div className="measure">
      <SectionHead kicker="Record" title="Education, work and leadership">
        Everything in one ledger, most recent first within each group.
      </SectionHead>

      <Reveal className="space-y-12">
        <Group label="Education" entries={education} />
        <Group label="Experience" entries={experience} />
        <Group label="Leadership" entries={leadership} />
      </Reveal>
    </div>
  </section>
);

export default Record;
