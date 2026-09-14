import { Link } from "react-router-dom";
import { profile } from "@/content/profile";

/**
 * Compact address block in Felt Gray at 11px. No dividers and no labels —
 * the muted grey does the work.
 */
const SiteFooter = () => (
  <footer className="bg-paper">
    <div className="shell grid gap-11.5 border-t border-obsidian/15 py-16 md:grid-cols-3">
      <div>
        <p className="t-body-sm">{profile.name}</p>
        <p className="t-label mt-3 text-felt-gray">Brampton, Ontario</p>
        <p className="t-label mt-2 text-felt-gray">London, Ontario</p>
        <p className="t-label mt-2 text-felt-gray">Western University</p>
      </div>

      <nav className="flex flex-col items-start gap-2" aria-label="Footer">
        {[
          { label: "Profile", to: "/" },
          { label: "Build", to: "/build" },
          { label: "Play", to: "/play" },
        ].map((l) => (
          <Link key={l.to} to={l.to} className="t-label link text-felt-gray">
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col items-start gap-2">
        {[
          { label: "Email", href: `mailto:${profile.email}` },
          { label: "GitHub", href: profile.github },
          { label: "LinkedIn", href: profile.linkedin },
          { label: "Résumé", href: profile.resume },
        ].map((l) => (
          <a
            key={l.label}
            href={l.href}
            target={l.href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="t-label link text-felt-gray"
          >
            {l.label}
          </a>
        ))}
        <p className="t-label mt-7 text-ash-mist tnum">© {new Date().getFullYear()}</p>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
