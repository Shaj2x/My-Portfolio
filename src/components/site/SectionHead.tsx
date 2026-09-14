import { ReactNode } from "react";

interface SectionHeadProps {
  /** The metadata line — says what kind of thing this section is. */
  kicker: string;
  title: string;
  children?: ReactNode;
}

const SectionHead = ({ kicker, title, children }: SectionHeadProps) => (
  <header className="mb-10 md:mb-12">
    <p className="meta">{kicker}</p>
    <h2 className="mt-3 text-[clamp(1.5rem,3.4vw,2.125rem)] font-bold">{title}</h2>
    {children ? (
      <div className="prose-measure mt-4 text-[0.98rem] leading-relaxed text-muted-foreground">
        {children}
      </div>
    ) : null}
  </header>
);

export default SectionHead;
