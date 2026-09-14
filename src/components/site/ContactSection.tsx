import { useId, useState } from "react";
import Band from "@/components/site/Band";
import Kicker from "@/components/site/Kicker";
import Reveal from "@/components/site/Reveal";
import Pill from "@/components/site/Pill";
import { toast } from "@/hooks/use-toast";
import { profile } from "@/content/profile";

interface ContactSectionProps {
  kicker?: string;
  title?: string;
  lead?: string;
}

const ContactSection = ({
  kicker = "Contact",
  title = "Start a conversation",
  lead = "A project, a question, or just a hello — all of it reaches the same inbox.",
}: ContactSectionProps) => {
  const ids = useId();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      // Loaded on submit so the client library stays out of the initial bundle.
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke("send-contact-email", { body: form });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSent(true);
      setForm({ name: "", email: "", message: "" });
      toast({
        title: "Message sent",
        description: "It is in my inbox — I will reply within a day or two.",
      });
    } catch (err) {
      console.error("Contact form failed:", err);
      toast({
        title: "The message did not send",
        description: `Try again, or email ${profile.email} directly.`,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // Sharp 0px inputs — a hairline underline rather than a box.
  const field =
    "w-full border-0 border-b border-obsidian/30 bg-transparent pb-3 pt-2 text-body text-obsidian transition-colors duration-micro ease-monopo placeholder:text-ash-mist focus:border-obsidian focus:outline-none";

  return (
    <Band id="contact">
      <Reveal>
        <Kicker>{kicker}</Kicker>
        <h2 className="t-heading-lg mt-7 max-w-[13ch]">{title}</h2>
        <p className="t-body-sm mt-7 max-w-[48ch] text-felt-gray">{lead}</p>
      </Reveal>

      <div className="mt-11.5 grid gap-11.5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Reveal delay={0.08}>
          {sent ? (
            <div className="border-t border-obsidian pt-7">
              <p className="t-subheading">Message sent.</p>
              <p className="t-body-sm mt-3.5 max-w-[44ch] text-felt-gray">
                Thanks for reaching out — I will reply within a day or two.
              </p>
              <button type="button" onClick={() => setSent(false)} className="t-label link mt-7">
                Send another →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-10">
              <div className="grid gap-10 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${ids}-name`} className="t-label text-felt-gray">
                    Name
                  </label>
                  <input
                    id={`${ids}-name`}
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={field}
                  />
                </div>
                <div>
                  <label htmlFor={`${ids}-email`} className="t-label text-felt-gray">
                    Email
                  </label>
                  <input
                    id={`${ids}-email`}
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={field}
                  />
                </div>
              </div>

              <div>
                <label htmlFor={`${ids}-message`} className="t-label text-felt-gray">
                  Message
                </label>
                <textarea
                  id={`${ids}-message`}
                  name="message"
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className={`${field} resize-y`}
                />
              </div>

              <div>
                <Pill type="submit" disabled={sending}>
                  {sending ? "Sending" : "Send message"}
                </Pill>
              </div>
            </form>
          )}
        </Reveal>

        <Reveal delay={0.16}>
          <dl className="border-t border-obsidian/15">
            {[
              { label: "Email", value: profile.email, href: `mailto:${profile.email}` },
              { label: "GitHub", value: `@${profile.githubUser}`, href: profile.github },
              { label: "LinkedIn", value: "Shajith Sasikumar", href: profile.linkedin },
              { label: "Based in", value: profile.location },
            ].map((row) => (
              <div key={row.label} className="border-b border-obsidian/15 py-3.5">
                <dt className="t-label text-felt-gray">{row.label}</dt>
                <dd className="t-body-sm mt-2">
                  {row.href ? (
                    <a
                      href={row.href}
                      target={row.href.startsWith("mailto:") ? undefined : "_blank"}
                      rel="noopener noreferrer"
                      className="link"
                    >
                      {row.value}
                    </a>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </Band>
  );
};

export default ContactSection;
