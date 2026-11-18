import { useId, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Copy, GraduationCap, Mail } from "lucide-react";
import { profile, services, training } from "@/data/portfolio";

/**
 * What I build: the six services as cards, each with its main offerings as tags, a pointer to 1-on-1
 * tutoring, and links to the full services page and to "Start a project" (an email brief). Shared
 * by the room (the desk chair, and Services in the dock) and the quick view.
 */
export const ServicesShowcase = ({ wide = false }: { wide?: boolean }) => {
  const [asking, setAsking] = useState(false);
  const startId = useId();
  return (
    <div>
      <div className={`grid gap-3 sm:grid-cols-2 ${wide ? "lg:grid-cols-3 lg:gap-4" : ""}`}>
        {services.map((s) => (
          <article
            key={s.title}
            className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.06]"
          >
            <s.icon className="h-5 w-5 text-amber-200" aria-hidden="true" />
            <h3 className="mt-3 font-semibold text-white">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/70">{s.description}</p>
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`${s.title}: main offerings`}>
              {s.tags.map((t) => (
                <li key={t} className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-white/80">
                  {t}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      {/* the other thing I offer: 1-on-1 tutoring and mentorship */}
      <a
        href="/services#training"
        className="group mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.06]"
      >
        <GraduationCap className="h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
        <span className="min-w-0 flex-1 text-sm text-white/75">
          <span className="font-semibold text-white">1-on-1 tutoring and mentorship.</span> K-12 and coding, in person or online, through {training.name}. First session free.
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-white/60 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
      </a>
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          aria-expanded={asking}
          aria-controls={startId}
          onClick={() => setAsking((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-amber-200 px-4 py-2 text-sm font-semibold text-[#1a1408] transition-colors duration-150 hover:bg-amber-100"
        >
          <Mail className="h-4 w-4" aria-hidden="true" /> Start a project
          <ArrowUpRight className={`h-4 w-4 transition-transform duration-200 ease-out ${asking ? "rotate-90" : ""}`} aria-hidden="true" />
        </button>
        <a
          href="/services"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:border-white/30 hover:bg-white/[0.1]"
        >
          Everything I provide <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
      {asking && <StartProject id={startId} />}
    </div>
  );
};

/**
 * A short project brief that goes out as an email. A plain mailto link does nothing on a computer
 * with no email app set up, so it offers Gmail and Outlook in the browser too, and copying the
 * address, alongside the email app.
 */
export const StartProject = ({ id }: { id: string }) => {
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
  const field = "w-full min-h-[44px] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/45 outline-none transition-colors focus:border-amber-200/60";
  return (
    <div id={id} className="mt-4 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
      <p className="text-sm font-semibold text-white">Tell me what you have in mind</p>
      <fieldset className="mt-3">
        <legend className="mb-2 text-xs text-white/60">What do you need? Pick any.</legend>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => {
            const on = picked.includes(s.title);
            return (
              <button
                key={s.title}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s.title) : [...p, s.title]))}
                className={`inline-flex min-h-[44px] items-center rounded-full border px-3.5 text-xs transition-colors duration-150 sm:min-h-[36px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 ${on ? "border-amber-200/70 bg-amber-200/15 text-amber-100" : "border-white/10 bg-white/[0.05] text-white/80 hover:border-white/25"}`}
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
            className={`inline-flex min-h-[46px] items-center gap-1.5 rounded-full px-4 text-sm transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 ${i === 0 ? "bg-amber-200 font-semibold text-[#1a1408] hover:bg-amber-100" : "border border-white/15 bg-white/[0.06] text-white hover:border-white/30"}`}
          >
            {l.label}
          </a>
        ))}
        <button type="button" onClick={copy} className="inline-flex min-h-[46px] items-center gap-1.5 rounded-full border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 border-white/15 bg-white/[0.06] px-4 text-sm text-white transition-colors duration-150 hover:border-white/30">
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
