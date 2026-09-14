import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { profile } from "@/content/profile";

const routes = [
  { to: "/", label: "Profile", end: true },
  { to: "/build", label: "Build" },
  { to: "/play", label: "Play" },
];

const SiteHeader = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "font-mono text-[0.6875rem] uppercase tracking-[0.12em] transition-colors",
      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
    ].join(" ");

  return (
    <header
      className={[
        "sticky top-0 z-50 bg-background/88 backdrop-blur-sm transition-colors",
        scrolled ? "border-b border-border" : "border-b border-transparent",
      ].join(" ")}
    >
      <div className="measure flex h-14 items-center justify-between gap-4">
        <Link
          to="/"
          className="font-display text-[0.9375rem] font-bold tracking-[-0.02em] text-foreground"
        >
          {profile.name}
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {routes.map((r) => (
            <NavLink key={r.to} to={r.to} end={r.end} className={linkClass}>
              {r.label}
            </NavLink>
          ))}
          <a
            href={profile.resume}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Résumé
          </a>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid h-8 w-8 place-items-center rounded-sm text-foreground"
          >
            {open ? <X size={17} strokeWidth={1.75} /> : <Menu size={17} strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      <nav
        id="mobile-nav"
        hidden={!open}
        aria-label="Primary"
        className="border-t border-border md:hidden"
      >
        <div className="measure flex flex-col py-2">
          {routes.map((r) => (
            <NavLink
              key={r.to}
              to={r.to}
              end={r.end}
              className={({ isActive }) =>
                [
                  "border-b border-border py-3 font-mono text-[0.6875rem] uppercase tracking-[0.12em]",
                  isActive ? "text-foreground" : "text-muted-foreground",
                ].join(" ")
              }
            >
              {r.label}
            </NavLink>
          ))}
          <a
            href={profile.resume}
            target="_blank"
            rel="noopener noreferrer"
            className="py-3 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground"
          >
            Résumé
          </a>
        </div>
      </nav>
    </header>
  );
};

export default SiteHeader;
