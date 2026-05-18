import { ArrowDown, Github, Linkedin, Mail } from "lucide-react";
import { motion } from "framer-motion";
import heroBg from "@/assets/hero-bg.jpg";
import ssLogo from "@/assets/ss-logo-official.png";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img src={heroBg} alt="" className="w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6"
        >
          <img src={ssLogo} alt="SS Logo" className="w-20 h-20 mx-auto rounded-full glow-red" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-primary font-mono text-sm mb-4"
        >
          Hey, I'm
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6"
        >
          Shajith <span className="text-gradient">Sasikumar</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8"
        >
          Engineering Science + Ivey HBA @ Western University.
          AI builder, entrepreneur, and full-stack developer.
        </motion.p>

        {/* Social links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="flex items-center justify-center gap-4 mb-12"
        >
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
              whileHover={{ scale: 1.15, borderColor: "hsl(0 72% 51%)" }}
              whileTap={{ scale: 0.95 }}
              className="p-3 rounded-full border border-border hover:border-primary hover:text-primary transition-all"
            >
              <Icon size={20} />
            </motion.a>
          ))}
        </motion.div>

        {/* Scroll indicator */}
        <motion.a
          href="#about"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="inline-block animate-bounce text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowDown size={24} />
        </motion.a>
      </div>
    </section>
  );
};

export default Hero;
