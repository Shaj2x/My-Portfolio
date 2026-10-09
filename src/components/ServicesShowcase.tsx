import { useId, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Copy, Mail } from "lucide-react";
import { profile, services } from "@/data/portfolio";

/**
 * What I build: the five service categories as cards, each with its main offerings as tags. "See
 * everything I build" opens a little more under every card, and "Start a project" opens an email.
 * Shared by the room (the desk chair, and Services in the dock) and the quick view.
 */
export const ServicesShowcase = ({ wide = false }: { wide?: boolean }) => {
  const [all, setAll] = useState(false);
  const [asking, setAsking] = useState(false);
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
        <button
          type="button"
          aria-expanded={asking}
          aria-controls={`${moreId}-start`}
          onClick={() => setAsking((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-amber-200 px-4 py-2 text-sm font-semibold text-[#1a1408] transition-colors duration-150 hover:bg-amber-100"
        >
          <Mail className="h-4 w-4" aria-hidden="true" /> Start a project
          <ArrowUpRight className={`h-4 w-4 transition-transform duration-200 ease-out ${asking ? "rotate-90" : ""}`} aria-hidden="true" />
        </button>
      </div>
      {asking && <StartProject id={`${moreId}-start`} />}
    </div>
  );
};

/**
 * A short project brief that goes out as an email. A plain mailto link does nothing on a computer
 * with no email app set up, so it offers Gmail and Outlook in the browser too, and copying the
 * address, alongside the email app.
 */
const StartProject = ({ id }: { id: string }) => {
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const subject = picked.length ? `Project: ${picked.join(", ")}` : "Starting a project";
  const body = [`Hi Shajith,`, "", picked.length ? `I'm interested in: ${picked.join(", ")}.` : "", message.trim(), "", name.trim() ? `Thanks,\n${name.trim()}` : "Thanks!"]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");
  const q = (v: string) => encodeURIComponent(v);
  const links = [
    { label: "Send with Gmail", href: `https://mail.google.com/mail/?view=cm&fs=1&to=${q(profile.email)}&su=${q(subject)}&body=${q(body)}` },
    { label: "Send with Outlook", href: `https://outlook.live.com/mail/0/deeplink/compose?to=${q(profile.email)}&subject=${q(subject)}&body=${q(body)}` },
    { label: "Use my email app", href: `mailto:${profile.email}?subject=${q(subject)}&body=${q(body)}` },
  ];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
    } catch {
      // older browsers: select it from a hidden field
      const t = document.createElement("textarea");
      t.value = profile.email;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const field = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/45 outline-none transition-colors focus:border-amber-200/60";
  return (
    <div id={id} className="mt-4 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
      <p className="text-sm font-semibold text-white">Tell me what you have in mind</p>
      <fieldset className="mt-3">
        <legend className="mb-2 text-xs text-white/60">What do you need? Pick any.</legend>
        <div className="flex flex-wrap gap-1.5">
          {services.map((s) => {
            const on = picked.includes(s.title);
            return (
              <button
                key={s.title}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s.title) : [...p, s.title]))}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors duration-150 ${on ? "border-amber-200/70 bg-amber-200/15 text-amber-100" : "border-white/10 bg-white/[0.05] text-white/80 hover:border-white/25"}`}
              >
                {s.title}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-3 grid gap-2.5">
        <label className="grid gap-1 text-xs text-white/60">
          Your name
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" autoComplete="name" />
        </label>
        <label className="grid gap-1 text-xs text-white/60">
          About the project
          <textarea className={`${field} min-h-[88px] resize-y`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your business, what you'd like built, and any timeline" />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {links.map((l, i) => (
          <a
            key={l.label}
            href={l.href}
            target={l.href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors duration-150 ${i === 0 ? "bg-amber-200 font-semibold text-[#1a1408] hover:bg-amber-100" : "border border-white/15 bg-white/[0.06] text-white hover:border-white/30"}`}
          >
            {l.label}
          </a>
        ))}
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-sm text-white transition-colors duration-150 hover:border-white/30">
          {copied ? <Check className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copied ? "Copied" : "Copy my email"}
        </button>
      </div>
      <p className="mt-3 text-xs text-white/55" aria-live="polite">
        Or write to me directly at <span className="text-white/80">{profile.email}</span>
      </p>
    </div>
  );
};
