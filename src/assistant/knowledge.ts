/*
 * What the assistant knows, beyond what it reads from the rest of the site (projects, internships,
 * skills and the "Why" pages, which it answers from directly).
 *
 * To teach it something new, add an entry: a few ways someone might ask (they don't need to be
 * exact; the assistant matches on the important words), and the answer, in my own voice.
 * **double asterisks** make words bold. `links` adds buttons under the answer, and `follow` suggests
 * what to ask next.
 */

export interface Link {
  label: string;
  href: string;
}

export interface Entry {
  id: string;
  /** ways someone might ask this */
  asks: string[];
  answer: string;
  links?: Link[];
  /** questions to suggest after this answer */
  follow?: string[];
}

export const EMAIL = "shajithskumar@gmail.com";

export const knowledge: Entry[] = [
  {
    id: "hello",
    asks: ["hi", "hello", "hey", "yo", "good morning", "whats up", "sup"],
    answer: "Hey! I'm Shajith, or at least the part of me that lives in this room. Ask me about my projects, internships, skills or school, and I'll answer from what I've written down.",
    follow: ["Who are you?", "What are you building right now?", "What internships have you done?"],
  },
  {
    id: "who",
    asks: ["who are you", "tell me about yourself", "introduce yourself", "who is shajith", "about you", "what do you do", "summary", "elevator pitch"],
    answer:
      "I'm **Shajith Sasikumar**, an **Electrical Engineering** student at Western University, doing a dual degree with an **Ivey HBA**. I build AI tools, web apps and hardware projects, and I run a small business making AI receptionists and websites for local businesses. I like problems that need both the engineering and the business side.",
    follow: ["What are you building right now?", "What internships have you done?", "Why engineering and business?"],
  },
  {
    id: "how-this-works",
    asks: ["are you an ai", "are you a bot", "are you real", "is this chatgpt", "how do you work", "how does this chat work", "are you a chatbot", "who am i talking to"],
    answer:
      "I'm not a chatbot and nothing you type leaves this page. I'm a small assistant that answers from what Shajith wrote down about himself and his work. If I don't know something, I'll say so instead of making it up.",
    follow: ["Who are you?", "How do I contact you?"],
  },
  {
    id: "why-dual",
    asks: ["why engineering and business", "why ivey", "why dual degree", "why electrical engineering", "why did you choose your program", "why hba"],
    answer:
      "I never wanted to choose between building things and understanding the business behind them. Running a clothing brand at 15 and now my AI business showed me the best ideas need both: something that works, and a reason people will pay for it.",
    follow: ["Tell me about the clothing brand", "Tell me about your business"],
  },
  {
    id: "location",
    asks: ["where are you from", "where are you", "where do you live", "where are you based", "location", "hometown", "where is your school", "are you in canada"],
    answer: "I'm in **London, Ontario** for school at Western. I went to high school in Brampton, at Chinguacousy Secondary School.",
    follow: ["What do you study?", "Are you open to internships?"],
  },
  {
    id: "open-to-work",
    asks: ["are you open to internships", "are you looking for a job", "can i hire you", "are you available", "looking for internship", "co-op", "summer internship", "do you want to work with us", "open to opportunities", "freelance"],
    answer:
      "Yes: internships, projects, or a business that could use an AI receptionist or a new website, my inbox is open. The fastest way is email, and my resume has everything in one place.",
    links: [
      { label: "Email me", href: `mailto:${EMAIL}` },
      { label: "Resume (PDF)", href: "/Shajith_Sasikumar_Resume.pdf" },
    ],
    follow: ["What internships have you done?", "What are your strongest skills?"],
  },
  {
    id: "contact",
    asks: ["how do i contact you", "email", "how can i reach you", "linkedin", "github", "phone number", "social media", "get in touch", "send you a message"],
    answer: `The best way is email: **${EMAIL}**. I'm also on LinkedIn and GitHub.`,
    links: [
      { label: "Email me", href: `mailto:${EMAIL}` },
      { label: "LinkedIn", href: "https://www.linkedin.com/in/shajith-sasikumar-5080a5344/" },
      { label: "GitHub", href: "https://github.com/Shaj2x" },
    ],
  },
  {
    id: "resume",
    asks: ["resume", "cv", "can i see your resume", "download resume", "your resume pdf"],
    answer: "Here's my resume. It has my education, internships, projects and skills on one page.",
    links: [{ label: "Resume (PDF)", href: "/Shajith_Sasikumar_Resume.pdf" }],
  },
  {
    id: "business",
    asks: ["tell me about your business", "ai receptionist", "what services do you offer", "do you build websites", "can you build my website", "what do you build for businesses", "agency", "clients"],
    answer:
      "I build **AI receptionists** that pick up every call and book appointments, plus **websites**, **custom web apps** and **automations** for small businesses. The goal is simple: make the tech feel easy, so owners can get back to the work they love.",
    links: [{ label: "Email me about a project", href: `mailto:${EMAIL}` }],
    follow: ["Why did you build DevAssist?", "How do I contact you?"],
  },
  {
    id: "brand",
    asks: ["tell me about the clothing brand", "streetwear", "loveyoureally", "love you really apparel", "your brand", "clothing company"],
    answer:
      "At 15 I co-founded **LoveYouReally Apparel**, a streetwear brand. I handled product design, customer engagement and order fulfillment, and we grew to **10K+ followers**. It taught me more about marketing and running a business than any class could.",
    follow: ["Why engineering and business?", "What leadership roles have you had?"],
  },
  {
    id: "leadership",
    asks: ["leadership", "leadership experience", "student council", "clubs", "extracurriculars", "president", "have you led a team"],
    answer:
      "In high school I was **Student Activity Council President** and **President of the Tamil Student Association** at Chinguacousy S.S., where we ran school-wide and cultural events. I also led canvassing teams on a local election campaign, and worked a federal election as a **Deputy Returning Officer**, which taught me to stay calm under pressure.",
    follow: ["Tell me about the clothing brand", "What internships have you done?"],
  },
  {
    id: "high-school",
    asks: ["high school", "where did you go to school", "where did you go to high school", "what high school did you go to", "high school average", "grades", "gpa", "marks", "were you a good student"],
    answer: "I graduated from Chinguacousy Secondary School in Brampton with a **96.3%** four-year average.",
    follow: ["What do you study?", "What leadership roles have you had?"],
  },
  {
    id: "languages-spoken",
    asks: ["what languages do you speak", "do you speak tamil", "do you speak french", "spoken languages", "bilingual"],
    answer: "I'm fluent in **English** and **Tamil**, and I have some **French**.",
  },
  {
    id: "music",
    asks: ["what music do you like", "favourite artist", "favorite artist", "drake", "travis scott", "posters", "what are you listening to", "spotify", "do you make music"],
    answer:
      "Lots of **Drake**; you can tell from the posters. **Travis Scott's Rodeo** is by my bed. Click any poster in the room to see what I'm listening to. I also make beats in **FL Studio** sometimes.",
  },
  {
    id: "creative",
    asks: ["hobbies", "what do you do for fun", "outside of school", "interests", "free time", "design", "video editing"],
    answer:
      "Outside class I'm usually building something. I also design and edit with **Photoshop** and **After Effects**, make music in **FL Studio**, play on the PS5 (there's one in this room you can actually play), and tutor middle and high school students.",
    follow: ["What music do you like?", "What games are on the PS5?"],
  },
  {
    id: "ml",
    asks: ["machine learning", "ml", "ml experience", "any ml experience", "do you have experience with machine learning", "ai experience", "have you built ai", "computer vision", "deep learning", "llm", "ai agents", "artificial intelligence"],
    answer:
      "Yes. **DevAssist** is a team of five AI agents (Claude or GPT) that plan, write, test and review code, with retrieval over a vector index. **Schematica** uses a **YOLOv8** model with **OpenCV** to turn a photo of a circuit into a schematic, and Claude to explain the solution, with every number checked against the solver. I also build AI receptionists for local businesses.",
    links: [
      { label: "Why I built DevAssist", href: "/work/devassist" },
      { label: "Why I built Schematica", href: "/work/schematica" },
    ],
    follow: ["How does DevAssist work?", "How does Schematica work?"],
  },
  {
    id: "thanks",
    asks: ["thanks", "thank you", "thx", "ty", "cool", "awesome", "nice", "bye", "goodbye", "see you"],
    answer: "Anytime! If you want to talk properly, my email is always open.",
    links: [{ label: "Email me", href: `mailto:${EMAIL}` }],
  },
  {
    id: "tutoring",
    asks: ["tutoring", "do you tutor", "private tutor", "teaching"],
    answer: "Since August 2025 I've run my own tutoring business, teaching middle and high school students one-on-one, in person and online, with lesson plans built around each student.",
  },
  {
    id: "this-site",
    asks: ["how did you build this site", "how was this website made", "what is this room", "is this your real room", "three js", "what is this website", "how did you make this"],
    answer:
      "This is my dorm room, rebuilt in 3D with **three.js**, **React** and **TypeScript**. Everything in it opens part of my portfolio: the laptop is my projects, the PS5 has games, the posters show what I'm playing on Spotify, the whiteboard is what I'm building, and the calendar on the door is how to reach me. Visitors show up live, and the guestbook on the keyboard is stored in **Supabase**.",
    links: [{ label: "Code on GitHub", href: "https://github.com/Shaj2x/My-Portfolio" }],
    follow: ["What games are on the PS5?", "What are you building right now?"],
  },
  {
    id: "games",
    asks: ["what games are on the ps5", "can i play games", "games", "ps5", "play something"],
    answer:
      "Click the PS5 or the controller on the desk. There's **Super S** (a platformer I made), **Ma's Garden** (a fruit-matching game I made for my mom), **Stop the Clock** (a timing game), Pong, Snake, StatStack, Mercatus, and my Raptors slot machine and blackjack.",
    links: [{ label: "Play Ma's Garden", href: "/ma" }],
  },
  {
    id: "ma",
    asks: ["mas garden", "ma's garden", "who is ma", "game for your mom", "fruit game"],
    answer: "**Ma's Garden** is a fruit-matching game I made for my mom. It gets a little harder each level and saves after every move, so she can always pick up where she left off.",
    links: [{ label: "Play it", href: "/ma" }],
  },
];

/** what to suggest before anything has been asked */
export const starters = ["Who are you?", "What are you building right now?", "What internships have you done?", "Do you know Python?", "Why did you build Marq Living?"];
