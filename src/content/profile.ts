/**
 * Single source of truth for everything the site says about Shajith.
 * Edit here, not in components.
 */

export const profile = {
  name: "Shajith Sasikumar",
  initials: "SS",
  role: "Engineering Science + Ivey HBA",
  school: "Western University",
  location: "Brampton & London, Ontario",
  email: "shajithskumar@gmail.com",
  github: "https://github.com/Shaj2x",
  githubUser: "Shaj2x",
  linkedin: "https://www.linkedin.com/in/shajith-sasikumar-5080a5344/",
  resume: "/Shajith_Sasikumar_Resume.pdf",
  statement:
    "Engineering Science + Ivey HBA at Western, and a practice building automated systems for small businesses.",
} as const;

export const about = [
  "I'm in the dual-degree Engineering Science and Ivey HBA program at Western University — one of a small number of combined engineering and business programs in Canada. It suits how I already worked: build the thing, then figure out how it pays for itself.",
  "At fifteen I co-founded a streetwear label and grew it past ten thousand followers, which taught me more about operations than any course has. Since then I've run a school's student council, organised cultural events for the Tamil Student Association, and managed a polling station for a federal election.",
  "Now I build automated AI systems — receptionists, voice agents, full websites and brand identities — for businesses that need the work done without hiring for it.",
] as const;

export type RecordEntry = {
  start: string;
  end: string;
  title: string;
  org: string;
  note: string;
  tag?: string;
};

export const education: RecordEntry[] = [
  {
    start: "2025",
    end: "2029",
    title: "BESc + Ivey HBA",
    org: "Western University",
    note: "Dual degree in Engineering Science and Honours Business Administration. Expected 2029.",
  },
  {
    start: "2021",
    end: "2025",
    title: "Secondary School Diploma",
    org: "Chinguacousy Secondary School",
    note: "Graduated with a 96.3% four-year average.",
  },
];

export const experience: RecordEntry[] = [
  {
    start: "2025",
    end: "Present",
    title: "Private Tutor, Owner",
    org: "Self-employed",
    note: "One-to-one tutoring for middle and high school students, in person and remote, on lesson plans built per student.",
  },
  {
    start: "2025",
    end: "2025",
    title: "Deputy Returning Officer",
    org: "Elections Canada",
    note: "Ran a polling station for the federal election — voter eligibility, ballot handling, and procedural compliance.",
    tag: "Civic",
  },
  {
    start: "2024",
    end: "2025",
    title: "Grad Trip Lead Volunteer",
    org: "GradCity",
    note: "Drove awareness and sign-ups for the graduating class trip through social campaigns and direct outreach.",
  },
  {
    start: "2024",
    end: "2024",
    title: "Carabram Lead Volunteer",
    org: "Brampton Tamil Association",
    note: "Set up the pavilion, assigned and led volunteer groups, sold tickets and ran merchandise.",
  },
  {
    start: "2023",
    end: "2025",
    title: "Co-Owner",
    org: "LoveYouReally Apparel",
    note: "Co-founded a streetwear label at fifteen. Product design, customer engagement and fulfilment. Grew to 10,000+ followers.",
    tag: "Founded",
  },
  {
    start: "2023",
    end: "2024",
    title: "Program Assistant",
    org: "Brampton Library",
    note: "Ran children's programming, presented sessions, and coordinated events including book fairs.",
  },
];

export const leadership: RecordEntry[] = [
  {
    start: "2024",
    end: "2025",
    title: "Student Activity Council President",
    org: "Chinguacousy Secondary School",
    note: "Led school-wide initiatives and coordinated an executive team to deliver events and represent the student body.",
  },
  {
    start: "2023",
    end: "2025",
    title: "Tamil Student Association President",
    org: "Chinguacousy Secondary School",
    note: "Organised cultural programming and built a community around Tamil heritage within the school.",
  },
  {
    start: "2025",
    end: "2025",
    title: "Lead Election Canvasser",
    org: "Cynthia Sri Pragash Campaign",
    note: "Led canvassing teams and coordinated voter engagement strategy through the campaign period.",
  },
];

export const capabilities = [
  { group: "Languages", items: ["Java", "C++", "Python", "JavaScript", "C#", "HTML/CSS"] },
  { group: "Tools", items: ["Git", "MATLAB", "OnShape", "CAD", "Photoshop", "After Effects"] },
  { group: "Studio", items: ["FL Studio", "Canva", "Brand identity", "Motion"] },
  { group: "Spoken", items: ["English — fluent", "Tamil — fluent", "French — limited"] },
];

/** Hand-written descriptions that override whatever GitHub returns. */
export const projectNotes: Record<string, string> = {
  Mercatus:
    "A strategy game that teaches stocks, crypto and market timing through simulated trading decisions.",
  StatStack: "A statistics tool for stacking and comparing data sets in the browser.",
};

export const projectDemos: Record<string, string> = {
  "Raptors-Slot-Machine": "https://shaj2x.github.io/Raptors-Slot-Machine/",
  "Raptors-BlackJack": "https://shaj2x.github.io/Raptors-BlackJack/",
  StatStack: "https://shaj2x.github.io/StatStack/",
  Mercatus: "https://shaj2x.github.io/Mercatus/",
  "Anthropogenic-Sound-Device-Simulator---ES1050-Project":
    "https://shaj2x.github.io/Anthropogenic-Sound-Device-Simulator---ES1050-Project/",
};

export const projectsInProgress = ["MarkWise", "HarmonAI"];

export type Offer = {
  name: string;
  promise: string;
  detail: string;
  outcomes: string[];
};

export const offers: Offer[] = [
  {
    name: "AI Receptionist",
    promise: "Nobody reaches a voicemail again.",
    detail:
      "A receptionist that answers every call, books into your real calendar, answers the questions you get twenty times a week, and hands the rest to you with a summary.",
    outcomes: ["Answers 24/7", "Books into your calendar", "Escalates with context"],
  },
  {
    name: "Voice Agents",
    promise: "Qualify the lead while they're still on the phone.",
    detail:
      "Outbound and inbound voice agents that run a real conversation — screening enquiries, confirming appointments, and chasing the follow-ups nobody gets around to.",
    outcomes: ["Screens enquiries", "Confirms appointments", "Runs follow-up calls"],
  },
  {
    name: "Workflow Automation",
    promise: "The admin between the work stops being your job.",
    detail:
      "Pipelines that move information for you: intake forms into the CRM, enquiries into follow-up sequences, invoices and reports generated and filed without anyone opening a spreadsheet.",
    outcomes: ["Intake to CRM", "Automatic follow-up", "Reports on a schedule"],
  },
  {
    name: "Websites",
    promise: "A site built to convert, not to win awards.",
    detail:
      "Landing pages, storefronts, dashboards and full platforms — designed, built and deployed, with the analytics wired up so you can see what it's actually doing.",
    outcomes: ["Design and build", "Deployed and measured", "Yours to keep"],
  },
  {
    name: "Brand Identity",
    promise: "One coherent look, everywhere.",
    detail:
      "Logo, colour system, typography and the guidelines that keep it consistent once other people start using it.",
    outcomes: ["Logo and marks", "Colour and type system", "Usage guidelines"],
  },
  {
    name: "Custom Builds",
    promise: "The thing that doesn't exist yet.",
    detail:
      "Chatbots trained on your documents, internal tools, data analysers, recommendation engines — scoped against what you actually need rather than what's fashionable.",
    outcomes: ["Scoped with you", "Built and handed over", "Supported after launch"],
  },
];

export const process = [
  {
    step: "Call",
    body: "Thirty minutes. You describe where the time goes; I tell you honestly whether automation helps or whether you just need a better form.",
  },
  {
    step: "Scope",
    body: "A written proposal: what gets built, what it costs, what it will and won't do. No retainer before you've seen it.",
  },
  {
    step: "Build",
    body: "You see working pieces as they land, not a reveal at the end. Changes are cheapest while it's still being built.",
  },
  {
    step: "Hand over",
    body: "It runs on your accounts, documented, with a month of support included so it survives contact with real customers.",
  },
];
