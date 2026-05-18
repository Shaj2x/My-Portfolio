import profileImg from "@/assets/profile.jpg";
import ssLogoNew from "@/assets/ss-logo-new.png";
import MotionSection from "./MotionSection";
import { motion } from "framer-motion";

const About = () => {
  return (
    <section id="about" className="section-padding">
      <MotionSection className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-12">
          <span className="text-gradient">01.</span> About Me
        </h2>

        <div className="grid md:grid-cols-3 gap-12 items-start">
          <div className="md:col-span-2 space-y-4 text-muted-foreground leading-relaxed">
            <p>
              I'm a first-year student in the dual-degree{" "}
              <span className="text-foreground font-medium">Engineering Science + Ivey HBA</span>{" "}
              program at Western University — one of Canada's most selective combined engineering and business programs. I thrive at the intersection of technology, business, and creative problem-solving.
            </p>
            <p>
              At 15, I co-founded a streetwear brand that scaled to{" "}
              <span className="text-foreground font-medium">10K+ followers</span>.
              I led as Student Activity Council President at Chinguacousy S.S., organized cultural events as Tamil Student Association President, and managed federal election operations as a Deputy Returning Officer.
            </p>
            <p>
              Today, I build fully automated AI systems — from intelligent receptionists to complete websites and brand identities — helping businesses scale smarter. I'm driven by the belief that great technology should feel effortless.
            </p>
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
