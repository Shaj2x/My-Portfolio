import { Bot, Globe, Palette, Cpu, PhoneCall, Workflow } from "lucide-react";
import { motion } from "framer-motion";
import MotionSection from "./MotionSection";

const services = [
  {
    icon: Bot,
    title: "AI Receptionist Systems",
    description: "Fully automated AI receptionists that handle calls, book appointments, answer FAQs, and route inquiries — 24/7 with zero downtime.",
  },
  {
    icon: Workflow,
    title: "End-to-End Automation",
    description: "Custom AI pipelines that automate repetitive workflows: lead capture, email follow-ups, CRM updates, and data processing.",
  },
  {
    icon: Globe,
    title: "Full Website Development",
    description: "High-converting, responsive websites built from scratch — landing pages, e-commerce stores, dashboards, and SaaS platforms.",
  },
  {
    icon: Palette,
    title: "Brand Identity & Logo Design",
    description: "Complete visual identities including logos, color systems, typography, and brand guidelines that make businesses stand out.",
  },
  {
    icon: PhoneCall,
    title: "AI Voice Agents",
    description: "Intelligent voice bots for inbound and outbound calling — qualifying leads, scheduling meetings, and providing customer support.",
  },
  {
    icon: Cpu,
    title: "Custom AI Solutions",
    description: "Bespoke AI tools tailored to your business: chatbots, content generators, data analyzers, and smart recommendation engines.",
  },
];

const Services = () => {
  return (
    <section id="services" className="section-padding bg-card/30">
      <MotionSection className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          <span className="text-gradient">06.</span> What I Build
        </h2>
        <p className="text-muted-foreground mb-12 max-w-2xl">
          I create fully automated AI systems that help businesses scale without scaling headcount. From AI receptionists to complete brand identities — I deliver turnkey solutions.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, i) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }}
              className="group relative bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors duration-300"
            >
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="p-3 rounded-lg bg-primary/10 text-primary w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                  <service.icon size={24} />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{service.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-12">
          <a
            href="#contact"
            className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
          >
            Let's Work Together
          </a>
        </div>
      </MotionSection>
    </section>
  );
};

export default Services;
