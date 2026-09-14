import { ReactNode } from "react";
import { Link } from "react-router-dom";

type Surface = "light" | "dark";

interface PillProps {
  children: ReactNode;
  /** Internal route. */
  to?: string;
  /** External or anchor target. */
  href?: string;
  surface?: Surface;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * The system's one expressive gesture: a 75px full pill against otherwise
 * sharp 0px geometry. Never filled — the border and letter-spacing carry the
 * hover, over 0.8s of the house easing curve.
 */
const Pill = ({
  children,
  to,
  href,
  surface = "light",
  type = "button",
  onClick,
  disabled,
  className = "",
}: PillProps) => {
  const classes = ["pill", surface === "dark" ? "pill-dark" : "pill-light", className].join(" ");

  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }

  if (href) {
    const external = href.startsWith("http");
    return (
      <a
        href={href}
        className={classes}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${classes} disabled:opacity-40`}>
      {children}
    </button>
  );
};

export default Pill;
