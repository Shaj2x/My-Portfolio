import { Briefcase, GraduationCap } from "lucide-react";
import MotionSection from "./MotionSection";
import { MotionItem } from "./MotionSection";

interface TimelineItem {
  title: string;
  org: string;
  date: string;
  description: string;
  type: "work" | "education";
}

const education: TimelineItem[] = [
  {
    title: "BESc + Ivey HBA",
    org: "Western University",
    date: "2025 – 2029 (Expected)",
    description: "Dual-degree in Engineering Science and Ivey Honors Business Administration.",
    type: "education",
  },
  {
    title: "High School Diploma",
    org: "Chinguacousy Secondary School",
    date: "2021 – 2025",
    description: "Graduated with a full 4-year average of 96.3%.",
    type: "education",
  },
];

const experience: TimelineItem[] = [
  {
    title: "Private Tutor (Owner)",
    org: "Self Employed",
    date: "Aug 2025 – Present",
    description: "Providing one-on-one tutoring (in-person and remotely) to middle and high school students to improve academic performance through personalized lesson plans.",
    type: "work",
  },
  {
    title: "Deputy Returning Officer",
    org: "Elections Canada, Brampton",
    date: "April 2025",
    description: "Managed polling station operations, verified voter eligibility, and ensured compliance with federal election procedures.",
    type: "work",
  },
  {
    title: "Grad Trip Lead Volunteer",
    org: "GradCity",
    date: "Sep 2024 – Mar 2025",
    description: "Promoted and increased awareness for high school Grad trip through advertisements on social media posts and word of mouth.",
    type: "work",
  },
  {
    title: "Carabram Lead Volunteer",
    org: "Brampton Tamil Association",
    date: "July 2024",
    description: "Set up Carabram event, led and assisted groups/assigned roles, promoted merchandise, sold tickets, and handled social service.",
    type: "work",
  },
  {
    title: "Co-Owner",
    org: "LoveYouReally Apparel",
    date: "Aug 2023 – Aug 2025",
    description: "Co-founded a streetwear brand; managed product design, customer engagement, and order fulfillment. Grew to 10K followers by age 15.",
    type: "work",
  },
  {
    title: "Program Assistant",
    org: "Brampton Library",
    date: "Jun 2023 – Apr 2024",
    description: "Helped to direct programs, worked with children, presented and coordinated events like book fairs.",
    type: "work",
  },
];

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
