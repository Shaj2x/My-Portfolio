import Band from "@/components/site/Band";
import Kicker from "@/components/site/Kicker";
import Reveal from "@/components/site/Reveal";
import { capabilities } from "@/content/profile";

const Capabilities = () => (
  <Band id="toolkit" tight>
    <Reveal>
      <Kicker>Toolkit</Kicker>
    </Reveal>

    <Reveal delay={0.08}>
      <dl className="mt-7 grid gap-11.5 sm:grid-cols-2 lg:grid-cols-4">
        {capabilities.map((c) => (
          <div key={c.group} className="border-t border-obsidian pt-3.5">
            <dt className="t-label text-felt-gray">{c.group}</dt>
            <dd className="mt-3.5">
              <ul className="flex flex-col gap-2">
                {c.items.map((item) => (
                  <li key={item} className="t-body-sm">
                    {item}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </Reveal>
  </Band>
);

export default Capabilities;
