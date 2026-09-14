import Band from "@/components/site/Band";
import Kicker from "@/components/site/Kicker";
import Reveal from "@/components/site/Reveal";
import ListRow from "@/components/site/ListRow";
import { education, experience, leadership, RecordEntry } from "@/content/profile";

const period = (e: RecordEntry) => (e.start === e.end ? e.start : `${e.start}—${e.end}`);

const Group = ({ label, entries }: { label: string; entries: RecordEntry[] }) => (
  <div>
    <Kicker>{label}</Kicker>
    <ul className="mt-3.5 border-t border-obsidian/15">
      {entries.map((e) => (
        <ListRow
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
  <Band id="record">
    <Reveal>
      <Kicker>Record</Kicker>
      <h2 className="t-heading-lg mt-7 max-w-[16ch]">Education, work, leadership</h2>
    </Reveal>

    <Reveal delay={0.08} className="mt-11.5 flex flex-col gap-16">
      <Group label="Education" entries={education} />
      <Group label="Experience" entries={experience} />
      <Group label="Leadership" entries={leadership} />
    </Reveal>
  </Band>
);

export default Record;
