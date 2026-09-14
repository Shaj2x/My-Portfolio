import { ReactNode } from "react";

interface BandProps {
  children: ReactNode;
  /** Obsidian bands invert the whole block — the system's only elevation device. */
  tone?: "paper" | "obsidian";
  id?: string;
  tight?: boolean;
}

/**
 * A full-bleed horizontal band. Sections separate by colour inversion rather
 * than by shadow, so the page reads as alternating white and black registers.
 */
const Band = ({ children, tone = "paper", id, tight }: BandProps) => (
  <section
    id={id}
    data-dark-region={tone === "obsidian" ? "" : undefined}
    className={[
      tight ? "band-tight" : "band",
      tone === "obsidian" ? "bg-obsidian text-paper" : "bg-paper text-obsidian",
    ].join(" ")}
  >
    <div className="shell">{children}</div>
  </section>
);

export default Band;
