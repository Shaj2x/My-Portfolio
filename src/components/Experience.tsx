import { Briefcase, GraduationCap } from "lucide-react";
import MotionSection from "./MotionSection";
import { MotionItem } from "./MotionSection";
import { education, experience, type TimelineItem } from "@/data/portfolio";

const Experience = () => {
  return (
    <section id="experience" className="section-padding bg-card/30">
      <MotionSection className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-12">
          <span className="text-gradient">03.</span> Education & Experience
        </h2>

        {/* Education */}
        <h3 className="text-xl md:text-2xl font-semibold mb-6 text-foreground">Education</h3>
        <div className="relative mb-12">
          <div className="absolute left-4 md:left-6 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-10">
            {education.map((item, i) => (
              <MotionItem key={i} delay={i * 0.1} className="relative pl-12 md:pl-16">
                <div className="absolute left-2.5 md:left-4.5 top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-primary">
                    <GraduationCap size={18} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">{item.title}</h4>
                    <p className="text-sm text-primary font-mono">{item.org}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.date}</p>
                    <p className="text-sm text-muted-foreground mt-2">{item.description}</p>
                  </div>
                </div>
              </MotionItem>
            ))}
          </div>
        </div>

        {/* Experience */}
        <h3 className="text-xl md:text-2xl font-semibold mb-6 text-foreground">Experience</h3>
        <div className="relative">
          <div className="absolute left-4 md:left-6 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-10">
            {experience.map((item, i) => (
              <MotionItem key={i} delay={i * 0.1} className="relative pl-12 md:pl-16">
                <div className="absolute left-2.5 md:left-4.5 top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-primary">
                    <Briefcase size={18} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">{item.title}</h4>
                    <p className="text-sm text-primary font-mono">{item.org}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.date}</p>
                    <p className="text-sm text-muted-foreground mt-2">{item.description}</p>
                  </div>
                </div>
              </MotionItem>
            ))}
          </div>
        </div>
      </MotionSection>
    </section>
  );
};

export default Experience;
