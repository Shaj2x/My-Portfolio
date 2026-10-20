/*
 * The case studies: why each project exists, what it does, how it works, and the decisions that
 * shaped it. Everything technical here is taken from the project's own repo and docs.
 */

export interface CaseStudy {
  slug: string;
  /** the repo, which links the study to its card, demo video and code */
  repo: string;
  title: string;
  /** one line under the title */
  tagline: string;
  /** shown as small facts under the title */
  facts: { label: string; value: string }[];
  /** where it came from, in my words */
  story: string[];
  /** the question the project answers, pulled out in large type */
  question: string;
  /** what it does for the person using it */
  features: { title: string; text: string }[];
  /** how it works, as a pipeline read left to right */
  flow: { step: string; detail: string }[];
  /** decisions worth explaining: the obvious way, and what I did instead */
  decisions: { title: string; text: string }[];
  /** what's done and what's next, honestly */
  status: string;
  next: string[];
}

export const caseStudies: CaseStudy[] = [
  {
    slug: "marq-living",
    repo: "Marq-Living-Platform",
    title: "Marq Living",
    tagline: "A resident app and building-operations platform for The Marq, my building in London, Ontario.",
    facts: [
      { label: "Role", value: "Solo: design, code, hardware plan" },
      { label: "Stack", value: "Next.js, Supabase, Go, MQTT, TimescaleDB, Python, ESP32" },
      { label: "Status", value: "All 10 build stages done; hardware prototype next" },
    ],
    story: [
      "It started at the shuttle stop. While I waited for the bus to campus, I got talking with other students, and the same complaint kept coming up: nobody knew when the shuttle was late or cancelled. People were missing classes and labs, or standing outside in a London winter for a bus that was never coming.",
      "The fix for that one problem was simple to describe: let the driver press Start, share the bus's location, and tell everyone the moment a run is delayed or cancelled. But the more I thought about it, the more I saw the same blind spot around the building. You walk down to the laundry room to find every machine taken. You can't see whether the theatre room is free without asking. Lights and AC run in common rooms with nobody in them.",
      "So the shuttle tracker grew into a platform for the whole building: one app for residents, and an operations layer that connects the building's equipment so bookings and schedules drive the lights, HVAC and EV chargers automatically.",
    ],
    question: "What if residents never had to guess, and the building never wasted energy on an empty room?",
    features: [
      { title: "Live shuttle", text: "The driver taps Start Run and the bus appears on a live map with an ETA for every stop. A delay or cancellation goes out as a push notification and a banner straight away." },
      { title: "Laundry from power draw", text: "Clamp sensors on each machine's circuit tell washing from idle by its power signature, so the app shows which machines are free and can notify you when one finishes." },
      { title: "Rooms that run themselves", text: "Booking the theatre room turns its lights and HVAC on 15 minutes before you arrive and powers them down once the room is empty. Staff can always override." },
      { title: "EV charging under the limit", text: "Residents say how much range they need and when they leave. The scheduler charges in the cheapest overnight hours while keeping the building under its 150 kW peak." },
      { title: "Front desk and announcements", text: "Requests with photos and threads, announcements targeted by floor or unit, and device faults that open their own tickets." },
      { title: "Operations dashboard", text: "Live building load, a next-day forecast, energy cost and savings, shuttle on-time rate and request resolution times." },
    ],
    flow: [
      { step: "Sensors", detail: "ESP32 nodes with clamp meters, occupancy sensors and relays (a simulator for the demo)" },
      { step: "MQTT", detail: "Mosquitto broker, one login and access list per device" },
      { step: "Go services", detail: "Ingest writes readings; the automation engine turns rules and bookings into commands" },
      { step: "Data", detail: "Supabase Postgres for people and rules; TimescaleDB for sensor readings" },
      { step: "Apps", detail: "Next.js app for residents, drivers and staff; Python analytics for forecasts and EV plans" },
    ],
    decisions: [
      { title: "The rules live in the database", text: "Booking limits, the shuttle run lifecycle and who sees what are enforced in Postgres with row level security, not in the app. Every client gets the same behaviour, and a bug in one screen can't let a resident see another resident's data." },
      { title: "Fail safe, in hardware and software", text: "Lights sit on the relay's normally closed contact, so a dead node leaves them on. Nodes also revert to safe settings if the automation engine's heartbeat stops for two minutes. A system test kills the engine and checks that this happens." },
      { title: "Two databases on purpose", text: "Sensor readings arrive every few seconds. Keeping them in TimescaleDB, rolled up into 15-minute buckets, keeps that volume away from the app database and its realtime updates." },
      { title: "Privacy for the driver", text: "The driver's GPS is visible only while a run is active and is deleted when it ends. Only the run's timing is kept for the on-time stats." },
    ],
    status: "All ten build stages are done and tested: 198 database checks, a Playwright suite of 92 end-to-end checks against a real auth server, broker and services, and tests for the Go services, Python analytics and firmware.",
    next: ["Prove one real clamp sensor on one circuit, end to end", "Replace the placeholder shuttle route with the real timetable", "Pilot it with residents"],
  },
  {
    slug: "devassist",
    repo: "devassist",
    title: "DevAssist",
    tagline: "A multi-agent AI platform that plans, codes, tests and validates every change before a human approves it.",
    facts: [
      { label: "Role", value: "Solo" },
      { label: "Stack", value: "Python, FastAPI, Go, Kafka, Postgres + pgvector, Redis, Docker, React" },
      { label: "Status", value: "4 of 7 phases done: indexer, sandbox and agents work end to end" },
    ],
    story: [
      "I run a small business building AI receptionists and booking pages for local businesses. One afternoon a client asked me to add Sunday hours to their booking page. It was a two-minute change, so I made it and pushed it live without testing.",
      "It broke the booking form. Customers could suddenly book appointments outside business hours. The fix was easy once I noticed, but it showed me the real problem: there was nothing between a request and going live. No plan, no tests, no second look.",
      "AI coding tools make that gap more dangerous, because they make changes faster than anyone checks them. So I built the safe process I didn't have: a platform where AI agents plan the change, write the code and the tests, and prove it works in a locked-down sandbox, and nothing ships until I've read the result and approved it.",
    ],
    question: "How do you let AI write code for real clients without trusting it blindly?",
    features: [
      { title: "Plain-English requests", text: "Describe the change the way a client would: \"add Sunday hours to the booking page\"." },
      { title: "Five agents, one job each", text: "A Planner picks the files and the approach, a Coder writes it, a Tester writes tests for it, a Debugger fixes failures, and a Reviewer summarises the risk." },
      { title: "Search that understands code", text: "Repos are split into functions and classes and indexed by meaning, so agents get only the code that matters instead of the whole repo." },
      { title: "A sandbox that can't be escaped", text: "Every patch runs its tests, a security scan and static analysis in a throwaway container with no network, no root and hard limits." },
      { title: "A human approves", text: "The result waits for review with the diff, the agents' reasoning and every check, and becomes a pull request only when approved." },
    ],
    flow: [
      { step: "Request", detail: "A plain-English change for a GitHub repo" },
      { step: "Indexer (Go)", detail: "Clones, splits code into functions, embeds and searches with pgvector" },
      { step: "Agents (Python)", detail: "Plan, code, test, debug and review on a small state machine" },
      { step: "Sandbox (Go)", detail: "Tests, security scan and static analysis in a locked-down container" },
      { step: "Review", detail: "Diff, reasoning and results for a human to approve into a PR" },
    ],
    decisions: [
      { title: "Whole files, not AI-written diffs", text: "The agents return the full new file. DevAssist writes it into a real git checkout and asks git for the diff. AI-written diffs break on a single miscounted line; this way the patch can't be malformed, and the diff I review is exactly what git produced." },
      { title: "Escape tests, not just settings", text: "The sandbox has no network, a read-only filesystem, no root and limits on memory, processes and time. An integration test submits a patch that tries to break out each of those ways, and passes only if every attempt fails." },
      { title: "A loop that can't run forever", text: "At most three attempts per job, a cost budget checked before every AI call, and stuck detection: if the Debugger produces a patch it already tried, the job stops instead of paying for the same failure again." },
      { title: "No agent framework", text: "The whole loop is a small hand-written state machine, about a hundred lines for the agent base. It is easy to test, easy to read in a log, and works with Claude, GPT or an offline mock." },
    ],
    status: "The indexer, the sandbox runner and the five-agent loop work end to end on sample repos, including the debug loop recovering from a failed first attempt. The demo above is that loop running for real.",
    next: ["Phase 5: REST API, GitHub integration and pull requests", "Phase 6: the review dashboard with a live timeline and diff viewer", "Phase 7: Kubernetes, CI and metrics"],
  },
  {
    slug: "schematica",
    repo: "schematica-circuits",
    title: "Schematica",
    tagline: "Turns a photo of any circuit, hand-drawn or printed, into a live simulation with step-by-step explanations.",
    facts: [
      { label: "Role", value: "Solo" },
      { label: "Stack", value: "Rust, WebAssembly, React, TypeScript, FastAPI, Postgres, OpenCV, YOLOv8, Claude" },
      { label: "Status", value: "5 of 6 phases done; try the browser build live" },
    ],
    story: [
      "Studying circuits, I'd spend hours stuck on textbook problems with only a final answer in the back of the book. When my answer didn't match, I had no way to see where I'd gone wrong: a sign, a units slip, or the whole method.",
      "Simulators could give me the right numbers, but typing every circuit in by hand took longer than solving it, and they still didn't show the working.",
      "So I built the tool I wanted. Snap a photo of the circuit and it becomes an editable schematic. Hit Solve and every voltage and current appears, with plots over time for capacitors and inductors. Ask for an explanation and it walks through the nodal analysis step by step, and if you type in your own answers it tells you what you likely did wrong.",
    ],
    question: "Where exactly did my answer go wrong?",
    features: [
      { title: "Photo to circuit", text: "A photo of a hand-drawn or printed schematic becomes an editable circuit, with warnings for anything it isn't sure about." },
      { title: "Instant, as you edit", text: "The solver runs in your browser, so dragging a resistor's value re-solves the whole circuit live." },
      { title: "Over time, not just DC", text: "Transient analysis plots how capacitors charge and inductors ramp." },
      { title: "Step-by-step working", text: "The explanation shows the nodal analysis a student would write by hand: the nodes, the equations, the answer." },
      { title: "Check my work", text: "Enter your own answers and it tells you which are right, and recognises common mistakes: a flipped sign, a missing kilo, the voltage across a part instead of to ground." },
    ],
    flow: [
      { step: "Photo", detail: "OpenCV cleans the image; a YOLOv8 model finds the symbols" },
      { step: "Schematic", detail: "Wires traced from the ink, values read by OCR, snapped to a grid" },
      { step: "Solver (Rust)", detail: "Modified nodal analysis, compiled to WebAssembly for the browser" },
      { step: "Plots", detail: "DC results live as you edit; transient runs plotted over time" },
      { step: "Explain", detail: "Server re-solves, builds the working, Claude writes it, every number checked" },
    ],
    decisions: [
      { title: "One solver, everywhere", text: "The solver is a Rust library compiled to WebAssembly for the browser and to Python for the server. The server re-solves every circuit itself before explaining it, so a modified or buggy page can't make the explanation describe wrong numbers." },
      { title: "AI writes, the solver checks", text: "After Claude writes an explanation, every number in it with a unit is compared against what the solver computed. Anything that doesn't match is flagged above the steps. With no API key it falls back to a template, so it never stops working." },
      { title: "Check my work without AI", text: "Deciding right or wrong, and spotting the common mistakes, is plain maths: a wrong sign, a prefix off by a thousand, or another part's current. Otherwise it plugs your own numbers into the node equation and shows where it doesn't balance." },
      { title: "Detect symbols, trace wires", text: "The model only answers \"which symbols are where\". Connections come from the drawing itself: erase the symbols, and each remaining stroke of ink is a wire. When it gets a circuit wrong, you can see which step failed." },
    ],
    status: "Drawing, the WebAssembly solver, transient plots, saved circuits, explanations, check my work and photo recognition all work. The browser build is live; saving, explanations and photos need the backend.",
    next: ["Docker and CI for the full stack", "Benchmarks for the solver", "More training data for the photo model"],
  },
];

export const caseStudyFor = (repo: string) => caseStudies.find((c) => c.repo === repo);
