import { motion } from "framer-motion";
import MotionSection from "./MotionSection";

const skillCategories = [
  {
    title: "Languages",
    skills: ["Java", "C++", "Python", "JavaScript", "C#", "HTML/CSS"],
  },
  {
    title: "Tools & Frameworks",
    skills: ["GitHub", "MATLAB", "OnShape", "CAD", "Photoshop", "After Effects"],
  },
  {
    title: "Creative & Other",
    skills: ["FL Studio", "Canva", "Leadership", "Entrepreneurship"],
  },
  {
    title: "Spoken Languages",
    skills: ["English (Fluent)", "Tamil (Fluent)", "French (Limited)"],
  },
];

const Skills = () => {
  return (
    <section id="skills" className="section-padding">
      <MotionSection className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-12">
          <span className="text-gradient">04.</span> Skills & Tools
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {skillCategories.map((cat, i) => (
            <motion.div
              key={cat.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="bg-card border border-border rounded-lg p-6"
            >
              <h3 className="text-lg font-semibold mb-4 text-primary font-mono">{cat.title}</h3>
              <div className="flex flex-wrap gap-2">
                {cat.skills.map((skill) => (
                  <motion.span
                    key={skill}
                    whileHover={{ scale: 1.08 }}
                    className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-primary/20 hover:text-primary transition-colors cursor-default"
                  >
                    {skill}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </MotionSection>
    </section>
  );
};

export default Skills;
