import { describe, expect, it } from "vitest";
import { showRepo } from "./portfolio";

describe("which GitHub repos the site shows", () => {
  it("leaves out private projects, whatever the case", () => {
    expect(showRepo("GTA6MM")).toBe(false);
    expect(showRepo("gta6mm")).toBe(false);
  });
  it("leaves out the profile repo and its Pages site", () => {
    expect(showRepo("Shaj2x")).toBe(false);
    expect(showRepo("shaj2x.github.io")).toBe(false);
  });
  it("shows everything else", () => {
    expect(showRepo("digitaldash")).toBe(true);
    expect(showRepo("KanTV")).toBe(true);
  });
});
