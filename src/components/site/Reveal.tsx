import { ReactNode, useLayoutEffect, useRef } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds to stagger this item behind its siblings. */
  delay?: number;
  as?: "div" | "section" | "li" | "article";
}

/**
 * Elements glide into place over 1.25s on the house curve — patient, never
 * abrupt. Content is visible by default and only armed once this component
 * mounts, so a failed script or a screenshot gets the finished page.
 */
const Reveal = ({ children, className = "", delay = 0, as: Tag = "div" }: RevealProps) => {
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    if (el.getBoundingClientRect().top < window.innerHeight - 40) {
      el.classList.add("reveal", "is-in");
      return;
    }

    el.classList.add("reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -80px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={className}
      style={delay ? ({ "--reveal-delay": `${delay}s` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
};

export default Reveal;
