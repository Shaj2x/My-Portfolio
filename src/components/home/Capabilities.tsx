import Reveal from "@/components/site/Reveal";
import SectionHead from "@/components/site/SectionHead";
import { capabilities } from "@/content/profile";

const Capabilities = () => (
  <section id="capabilities" className="section border-b border-border">
    <div className="measure">
      <SectionHead kicker="Toolkit" title="What I work in" />

      <Reveal>
        <dl className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((c) => (
            <div key={c.group} className="border-t border-border pt-4">
              <dt className="meta">{c.group}</dt>
              <dd className="mt-3">
                <ul className="space-y-1.5">
                  {c.items.map((item) => (
                    <li key={item} className="text-[0.9375rem] leading-snug">
                      {item}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </div>
  </section>
);

export default Capabilities;
