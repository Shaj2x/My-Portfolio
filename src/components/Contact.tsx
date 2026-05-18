import { useState } from "react";
import { Mail, Github, Linkedin, Send, Loader2, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MotionSection from "./MotionSection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const Contact = () => {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-contact-email", {
        body: {
          name: formData.name,
          email: formData.email,
          message: formData.message,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSent(true);
      setFormData({ name: "", email: "", message: "" });
      toast({
        title: "Message sent! ✉️",
        description: "Thanks for reaching out — I'll get back to you soon.",
      });

      setTimeout(() => setSent(false), 4000);
    } catch (err) {
      console.error("Contact form error:", err);
      toast({
        title: "Something went wrong",
        description: "Please try again or email me directly at shajithskumar@gmail.com",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="contact" className="section-padding">
      <MotionSection className="max-w-2xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">
          <span className="text-gradient">07.</span> Get In Touch
        </h2>
        <p className="text-muted-foreground mb-10 text-center">
          Whether you need an AI system, a website, or just want to connect — I'd love to hear from you.
        </p>

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <CheckCircle className="text-primary mb-4" size={48} />
              <p className="text-lg font-semibold text-foreground">Message Sent!</p>
              <p className="text-sm text-muted-foreground mt-2">I'll get back to you as soon as possible.</p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="space-y-4 mb-12"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Your Name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
                <input
                  type="email"
                  placeholder="Your Email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <textarea
                placeholder="Your Message"
                required
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
              />
              <motion.button
                type="submit"
                disabled={sending}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                {sending ? "Sending..." : "Send Message"}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="flex justify-center gap-6 text-muted-foreground">
          {[
            { href: "https://github.com/Shaj2x", icon: Github },
            { href: "https://www.linkedin.com/in/shajith-sasikumar-5080a5344/", icon: Linkedin },
            { href: "mailto:shajithskumar@gmail.com", icon: Mail },
          ].map(({ href, icon: Icon }) => (
            <motion.a
              key={href}
              href={href}
              target={href.startsWith("mailto") ? undefined : "_blank"}
              rel="noopener noreferrer"
              whileHover={{ scale: 1.2 }}
              className="hover:text-primary transition-colors"
            >
              <Icon size={20} />
            </motion.a>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-8 font-mono text-center">
          Built by Shajith Sasikumar © {new Date().getFullYear()}
        </p>
      </MotionSection>
    </section>
  );
};

export default Contact;
