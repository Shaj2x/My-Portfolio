import { Link } from "react-router-dom";
import { profile } from "@/content/profile";

const SiteFooter = () => (
  <footer className="border-t border-border">
    <div className="measure flex flex-col gap-6 py-10 md:flex-row md:items-baseline md:justify-between">
      <div>
        <p className="font-display text-sm font-semibold">{profile.name}</p>
        <p className="meta mt-1.5">{profile.location}</p>
      </div>

      <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
        {[
          { label: "Profile", to: "/" },
          { label: "Build", to: "/build" },
          { label: "Play", to: "/play" },
        ].map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
          >
            {l.label}
          </Link>
        ))}
        {[
          { label: "GitHub", href: profile.github },
          { label: "LinkedIn", href: profile.linkedin },
          { label: "Email", href: `mailto:${profile.email}` },
        ].map((l) => (
          <a
            key={l.label}
            href={l.href}
            target={l.href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
          >
            {l.label}
          </a>
        ))}
      </nav>

      <p className="meta tnum">© {new Date().getFullYear()}</p>
    </div>
  </footer>
);

export default SiteFooter;
