import { Link, useLocation } from "react-router-dom";
import Layout from "@/components/site/Layout";

const NotFound = () => {
  const { pathname } = useLocation();

  return (
    <Layout title="Not found — Shajith Sasikumar">
      <section className="section">
        <div className="measure">
          <p className="meta">Error 404</p>
          <h1 className="mt-3 text-[clamp(1.75rem,4.4vw,2.75rem)] font-bold">
            There's nothing at this address
          </h1>
          <p className="prose-measure mt-4 text-[1.0625rem] leading-relaxed text-muted-foreground">
            <code className="text-foreground">{pathname}</code> doesn't exist. It may have moved
            when the site was rebuilt.
          </p>

          <ul className="ledger mt-9 max-w-md">
            {[
              { to: "/", label: "Profile", note: "About, work, record" },
              { to: "/build", label: "Build", note: "AI systems and websites" },
              { to: "/play", label: "Play", note: "Pong and Snake" },
            ].map((l) => (
              <li key={l.to} className="flex items-baseline justify-between gap-4 border-b border-border py-3">
                <Link
                  to={l.to}
                  className="font-display text-[1.0625rem] font-semibold underline decoration-border underline-offset-[5px] transition-colors hover:text-primary hover:decoration-primary"
                >
                  {l.label}
                </Link>
                <span className="meta">{l.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </Layout>
  );
};

export default NotFound;
