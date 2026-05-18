import { Crown, Users, Vote } from "lucide-react";
import { motion } from "framer-motion";
import MotionSection from "./MotionSection";

const roles = [
  {
    icon: Crown,
    title: "Student Activity Council President",
    org: "Chinguacousy Secondary School",
    description: "Led school-wide initiatives and coordinated the executive team to deliver events and represent the student body.",
  },
  {
    icon: Users,
    title: "Tamil Student Association President",
    org: "Chinguacousy Secondary School",
    description: "Organized cultural events and represented the student body, building a community celebrating Tamil heritage.",
  },
  {
    icon: Vote,
    title: "Lead Election Canvasser",
    org: "Cynthia Sri Pragash Campaign",
    description: "Led canvassing teams and community outreach, coordinating voter engagement strategies during the election campaign.",
  },
];

const Leadership = () => {
  return (
    <section id="leadership" className="section-padding">
      <MotionSection className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-12">
          <span className="text-gradient">05.</span> Leadership
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {roles.map((role, i) => (
            <motion.div
              key={role.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }}
              className="group bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                  <role.icon size={22} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{role.title}</h3>
                  <p className="text-sm text-primary font-mono mb-2">{role.org}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{role.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </MotionSection>
    </section>
  );
};

export default Leadership;
