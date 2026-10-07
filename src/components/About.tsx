import profileImg from "@/assets/profile.jpg";
import ssLogoNew from "@/assets/ss-logo-new.png";
import MotionSection from "./MotionSection";
import { motion } from "framer-motion";
import { aboutParagraphs } from "@/data/portfolio";

const About = () => {
  return (
    <section id="about" className="section-padding">
      <MotionSection className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-12">
          <span className="text-gradient">01.</span> About Me
        </h2>

        <div className="grid md:grid-cols-3 gap-12 items-start">
          <div className="md:col-span-2 space-y-4 text-muted-foreground leading-relaxed">
            {aboutParagraphs.map((runs, i) => (
              <p key={i}>
                {runs.map((r, j) =>
                  r.strong ? (
                    <span key={j} className="text-foreground font-medium">
                      {r.text}
                    </span>
                  ) : (
                    r.text
                  ),
                )}
              </p>
            ))}
          </div>

          <motion.div
            className="flex justify-center md:justify-end"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-primary/30 rounded-lg blur-md group-hover:bg-primary/50 transition-all duration-300" />
              <img
                src={ssLogoNew}
                alt="SS Official Logo"
                className="relative w-56 h-56 md:w-64 md:h-64 object-contain rounded-lg bg-background p-4"
              />
            </div>
          </motion.div>
        </div>
      </MotionSection>
    </section>
  );
};

export default About;
