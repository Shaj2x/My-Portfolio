import { ReactNode } from "react";

/**
 * The single dark surface on an otherwise paper site. Used once per page,
 * full-bleed, to mark where the practice begins. It carries its own colours
 * in both themes so it never borrows the page ground.
 */
const InkPanel = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <section className={`bg-ink text-ink-foreground ${className}`}>{children}</section>
);

export default InkPanel;
