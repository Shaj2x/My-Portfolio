/** Portfolio content shared by the portfolio page and the console in the 3D room. */
import { Bot, Cpu, Crown, Globe, Palette, PhoneCall, Users, Vote, Workflow } from "lucide-react";

export interface TimelineItem {
  title: string;
  org: string;
  date: string;
  description: string;
  type: "work" | "education";
}

export const education: TimelineItem[] = [
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

export const experience: TimelineItem[] = [
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

export const roles = [
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

export const skillCategories = [
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

export const services = [
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

export const GITHUB_USERNAME = "Shaj2x";

export const demoLinks: Record<string, string> = {
  "Raptors-Slot-Machine": "https://shaj2x.github.io/Raptors-Slot-Machine/",
  "Raptors-BlackJack": "https://shaj2x.github.io/Raptors-BlackJack/",
  "StatStack": "https://shaj2x.github.io/StatStack/",
  "Mercatus": "https://shaj2x.github.io/Mercatus/",
  "Anthropogenic-Sound-Device-Simulator---ES1050-Project": "https://shaj2x.github.io/Anthropogenic-Sound-Device-Simulator---ES1050-Project/",
};

export const inProgressRepos = ["MarkWise", "HarmonAI"];

export const customDescriptions: Record<string, string> = {
  "Mercatus": "A strategy game that teaches stocks, crypto, and market timing through simulated trading decisions.",
};

export const profile = {
  name: "Shajith Sasikumar",
  tagline: "Engineering Science + Ivey HBA @ Western University. AI builder, entrepreneur, and full-stack developer.",
  email: "shajithskumar@gmail.com",
  github: "https://github.com/Shaj2x",
  linkedin: "https://www.linkedin.com/in/shajith-sasikumar-5080a5344/",
  /** a PDF of the resume, if there is one to download; leave empty to show only the on-screen resume */
  resumePdf: "/Shajith_Sasikumar_Resume.pdf",
};

/** the About Me paragraphs; `strong` runs are emphasised */
export const aboutParagraphs: { text: string; strong?: boolean }[][] = [
  [
    { text: "I'm a first-year student in the dual-degree " },
    { text: "Engineering Science + Ivey HBA", strong: true },
    { text: " program at Western University — one of Canada's most selective combined engineering and business programs. I thrive at the intersection of technology, business, and creative problem-solving." },
  ],
  [
    { text: "At 15, I co-founded a streetwear brand that scaled to " },
    { text: "10K+ followers", strong: true },
    { text: ". I led as Student Activity Council President at Chinguacousy S.S., organized cultural events as Tamil Student Association President, and managed federal election operations as a Deputy Returning Officer." },
  ],
  [
    { text: "Today, I build fully automated AI systems — from intelligent receptionists to complete websites and brand identities — helping businesses scale smarter. I'm driven by the belief that great technology should feel effortless." },
  ],
];
