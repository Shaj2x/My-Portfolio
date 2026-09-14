import { useId, useState } from "react";
import { Loader2 } from "lucide-react";
import Reveal from "@/components/site/Reveal";
import SectionHead from "@/components/site/SectionHead";
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
      const { data, error } = await supabase.functions.invoke("send-contact-email", {
        body: form,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSent(true);
      setForm({ name: "", email: "", message: "" });
      toast({
        title: "Message sent",
        description: "It's in my inbox — I'll reply within a day or two.",
      });
    } catch (err) {
      console.error("Contact form failed:", err);
      toast({
        title: "The message didn't send",
        description: `Try again, or email ${profile.email} directly.`,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const field =
    "w-full border border-input bg-background px-3.5 py-2.5 font-body text-[0.9375rem] text-foreground transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none";

  return (
    <section id="contact" className="section">
      <div className="measure">
        <SectionHead kicker={kicker} title={title}>
          {lead}
        </SectionHead>

        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-14">
          <Reveal>
            {sent ? (
              <div className="border-l-2 border-primary bg-secondary/60 px-5 py-5">
                <p className="font-display text-sm font-semibold">Message sent.</p>
                <p className="prose-measure mt-1.5 text-[0.9375rem] text-muted-foreground">
                  Thanks for reaching out — I'll reply within a day or two.
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="mt-4 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-primary underline decoration-primary/30 underline-offset-[5px] hover:decoration-primary"
                >
                  Send another
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`${ids}-name`} className="meta mb-1.5 block">
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
                    <label htmlFor={`${ids}-email`} className="meta mb-1.5 block">
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
                  <label htmlFor={`${ids}-message`} className="meta mb-1.5 block">
                    Message
                  </label>
                  <textarea
                    id={`${ids}-message`}
                    name="message"
                    required
                    rows={6}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className={`${field} resize-y`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-2 bg-foreground px-5 py-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-85 disabled:opacity-50"
                >
                  {sending && <Loader2 size={13} className="animate-spin" />}
                  {sending ? "Sending" : "Send message"}
                </button>
              </form>
            )}
          </Reveal>

          <Reveal delay={0.08}>
            <dl className="border-t border-border">
              {[
                { label: "Email", value: profile.email, href: `mailto:${profile.email}` },
                { label: "GitHub", value: `@${profile.githubUser}`, href: profile.github },
                { label: "LinkedIn", value: "Shajith Sasikumar", href: profile.linkedin },
                { label: "Based in", value: profile.location },
              ].map((row) => (
                <div key={row.label} className="border-b border-border py-3.5">
                  <dt className="meta">{row.label}</dt>
                  <dd className="mt-1 text-[0.9375rem]">
                    {row.href ? (
                      <a
                        href={row.href}
                        target={row.href.startsWith("mailto:") ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className="underline decoration-border underline-offset-[5px] transition-colors hover:text-primary hover:decoration-primary"
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
      </div>
    </section>
  );
};

export default ContactSection;
