import { describe, expect, it } from "vitest";
import { answer } from "./engine";

/** each question should get an answer containing this text */
const cases: [string, string][] = [
  ["hi", "Ask me about"],
  ["Who are you?", "Electrical Engineering"],
  ["tell me about yourself", "Ivey HBA"],
  ["when do you graduate", "expect to graduate"],
  ["where are you from?", "London, Ontario"],
  ["Are you open to internships?", "inbox is open"],
  ["how do I contact you", "shajithskumar@gmail.com"],
  ["can I see your resume", "resume"],
  ["What internships have you done?", "Visual Elements"],
  ["tell me about greenveil", "Software Engineering Intern"],
  ["Do you know Python?", "**Python:** yes"],
  ["experience with react and docker", "**Docker:** yes"],
  ["do you know kotlin", "isn't on my list"],
  ["where did you go to school", "Chinguacousy"],
  ["what languages do you speak", "Tamil"],
  ["Why did you build Marq Living?", "shuttle"],
  ["how does devassist work", "Sandbox"],
  ["what is schematica built with", "Rust"],
  ["what was the hardest part of devassist", "Whole files"],
  ["is marq living finished", "Next:"],
  ["what is digital dash", "study dashboard"],
  ["what are you building right now", "Schematica"],
  ["what projects have you made", "Marq Living"],
  ["are you an AI?", "not a chatbot"],
  ["any ml experience?", "YOLOv8"],
  ["thanks!", "Anytime"],
];

describe("the assistant", () => {
  it.each(cases)("answers %j", (question, expected) => {
    expect(answer(question).text).toContain(expected);
  });

  it("says it doesn't know rather than guessing", () => {
    for (const q of ["how tall are you", "whats your favourite food", "asdfgh"]) expect(answer(q).text).toContain("haven't written an answer");
  });

  it("doesn't read 'go' or 'c' as skills in ordinary sentences", () => {
    expect(answer("where did you go to school").text).not.toContain("**Go:**");
    expect(answer("what is c++ like").text).not.toContain("**C:**");
  });

  it("links a project to its Why page, demo and code", () => {
    const r = answer("tell me about schematica");
    expect(r.links?.map((l) => l.href)).toEqual(expect.arrayContaining(["/work/schematica", "https://github.com/Shaj2x/schematica-circuits"]));
    expect(r.video).toBe("schematica-circuits");
  });
});
