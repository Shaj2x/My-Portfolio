import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { profile } from "@/content/profile";

const routes = [
  { to: "/", label: "Profile", end: true },
  { to: "/build", label: "Build" },
  { to: "/play", label: "Play" },
];

/**
 * Fixed, transparent, 66px tall. No background fill and no shadow on scroll —
 * the header is invisible until content passes behind it. Over the iridescent
 * hero it inverts to paper; everywhere else it sits in obsidian.
 */
const SiteHeader = ({ inverse = false }: { inverse?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [overDark, setOverDark] = useState(inverse);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  /*
    The header has no background fill, so its colour has to follow whatever
    band is behind it. Any section marked as a dark region flips it to paper
    while it sits under the 66px bar — the iridescent hero, the obsidian
    practice band, and the process band all qualify.
  */
  useEffect(() => {
    const midBar = 33;
    let frame = 0;

    const check = () => {
      frame = 0;
      const regions = document.querySelectorAll("[data-dark-region]");
      let dark = false;
      regions.forEach((r) => {
        const box = r.getBoundingClientRect();
        if (box.top <= midBar && box.bottom >= midBar) dark = true;
      });
      setOverDark(dark);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };

    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // The open menu is always an obsidian sheet, so its contents are always paper.
  const tone = overDark || open ? "text-paper" : "text-obsidian";

  const navLink = ({ isActive }: { isActive: boolean }) =>
    ["t-label link transition-opacity duration-micro", isActive ? "opacity-100" : "opacity-55 hover:opacity-100"].join(" ");

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-micro ease-monopo ${tone}`}>
      <div className="shell flex h-[66px] items-center justify-between gap-10">
        <Link to="/" className="link text-body-sm font-normal" onClick={() => setOpen(false)}>
          {profile.name.toLowerCase()}
        </Link>

        <nav className="hidden items-center gap-10 md:flex" aria-label="Primary">
          {routes.map((r) => (
            <NavLink key={r.to} to={r.to} end={r.end} className={navLink}>
              {r.label}
            </NavLink>
          ))}
          <a
            href={profile.resume}
            target="_blank"
            rel="noopener noreferrer"
            className="t-label link opacity-55 transition-opacity duration-micro hover:opacity-100"
          >
            Résumé
          </a>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="t-label md:hidden"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {/* Full obsidian sheet — the menu is a register change, not a dropdown. */}
      <div
        id="mobile-nav"
        hidden={!open}
        className="fixed inset-0 top-[66px] bg-obsidian text-paper md:hidden"
      >
        <nav className="shell flex flex-col pt-12" aria-label="Primary">
          {routes.map((r) => (
            <NavLink
              key={r.to}
              to={r.to}
              end={r.end}
              className="t-heading border-b border-paper/20 py-7 font-light"
            >
              {r.label}
            </NavLink>
          ))}
          <a
            href={profile.resume}
            target="_blank"
            rel="noopener noreferrer"
            className="t-heading py-7 font-light"
          >
            Résumé
          </a>
        </nav>
      </div>
    </header>
  );
};

export default SiteHeader;
