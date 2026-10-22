import { describe, expect, it } from "vitest";
import { activityCode, describeActivity, visitorName, type ActivityState } from "./activity";

const idle: ActivityState = { away: false, view: "photo", game: null, asking: false, guestbook: false, drawing: false, poster: null, section: null, music: false };

describe("visitor activity", () => {
  it("says what someone is doing, most specific first", () => {
    expect(describeActivity(activityCode(idle))?.text).toBe("Looking around");
    expect(describeActivity(activityCode({ ...idle, view: "console", game: "snake" }))?.text).toBe("Playing Snake");
    expect(describeActivity(activityCode({ ...idle, view: "console" }))?.text).toBe("On the PS5");
    expect(describeActivity(activityCode({ ...idle, asking: true, section: "projects" }))?.text).toBe("Chatting with R.V Bot");
    expect(describeActivity(activityCode({ ...idle, section: "projects" }))?.text).toBe("Browsing the projects");
    expect(describeActivity(activityCode({ ...idle, poster: "Rodeo" }))?.text).toBe("Checking out Rodeo");
    expect(describeActivity(activityCode({ ...idle, away: true, asking: true }))?.text).toBe("Stepped away");
  });

  it("ignores anything that isn't on the list, so nobody can send their own words", () => {
    for (const bad of ["hello everyone", "game:<script>", "section:hacked", "poster:99", "constructor", "__proto__", "game:constructor", "x".repeat(100), 42, null, { text: "hi" }])
      expect(describeActivity(bad)).toBeNull();
  });

  it("gives each visitor the same friendly name everywhere", () => {
    expect(visitorName("abc-123")).toBe(visitorName("abc-123"));
    expect(visitorName("abc-123")).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });
});
