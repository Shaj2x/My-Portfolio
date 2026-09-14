import { ReactNode, useLayoutEffect, useRef } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds to stagger this item behind its siblings. */
  delay?: number;
  as?: "div" | "section" | "li";
}

/**
 * Settles content into place as it scrolls in.
 *
 * Content is visible by default and only *armed* once this component mounts,
 * so a failed script, a dead observer or a screenshot all get the finished
 * page rather than a blank one. Anything already on screen at mount skips the
 * transition entirely.
 */
const Reveal = ({ children, className = "", delay = 0, as: Tag = "div" }: RevealProps) => {
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    // Already in view on first paint — show it without animating.
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
      { rootMargin: "0px 0px -60px 0px" }
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
