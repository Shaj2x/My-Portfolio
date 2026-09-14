import { Link, useLocation } from "react-router-dom";
import Layout from "@/components/site/Layout";
import Kicker from "@/components/site/Kicker";

const NotFound = () => {
  const { pathname } = useLocation();

  return (
    <Layout title="Not found — Shajith Sasikumar">
      <section id="start" className="flex min-h-[80svh] flex-col justify-center bg-paper">
        <div className="shell">
          <Kicker>Error 404</Kicker>
          <h1 className="t-heading mt-7 max-w-[14ch]">There is nothing at this address</h1>
          <p className="t-body-sm mt-7 max-w-[44ch] text-felt-gray">
            <span className="text-obsidian">{pathname}</span> does not exist. It may have moved
            when the site was rebuilt.
          </p>

          <ul className="mt-11.5 max-w-md border-t border-obsidian/15">
            {[
              { to: "/", label: "Profile", note: "About, work, record" },
              { to: "/build", label: "Build", note: "AI systems and websites" },
              { to: "/play", label: "Play", note: "Pong and Snake" },
            ].map((l) => (
              <li
                key={l.to}
                className="flex items-baseline justify-between gap-3.5 border-b border-obsidian/15 py-3.5"
              >
                <Link to={l.to} className="t-subheading link">
                  {l.label}
                </Link>
                <span className="t-label text-felt-gray">{l.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </Layout>
  );
};

export default NotFound;
