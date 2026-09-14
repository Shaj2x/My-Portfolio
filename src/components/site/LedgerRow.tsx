import { ReactNode } from "react";

interface LedgerRowProps {
  /** Left column: the date range, set in tabular figures. */
  period: string;
  title: string;
  org?: string;
  note?: string;
  tag?: string;
  /** Right column: links, status, language — whatever the row carries. */
  trailing?: ReactNode;
  href?: string;
}

/**
 * The site's one repeating structure. Jobs, degrees, leadership roles and
 * repositories are all entries in the same ledger, so they share one rhythm
 * instead of six variations on a card.
 */
const LedgerRow = ({ period, title, org, note, tag, trailing, href }: LedgerRowProps) => {
  const heading = (
    <h3 className="text-[1.0625rem] font-semibold leading-snug">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-border decoration-1 underline-offset-[5px] transition-colors hover:decoration-primary hover:text-primary"
        >
          {title}
        </a>
      ) : (
        title
      )}
    </h3>
  );

  return (
    <li className="ledger-row group">
      <time className="tnum text-[0.6875rem] uppercase tracking-[0.1em] text-muted-foreground md:pt-1">
        {period}
      </time>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {heading}
          {tag ? (
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-signal">
              {tag}
            </span>
          ) : null}
        </div>
        {org ? (
          <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-primary">
            {org}
          </p>
        ) : null}
        {note ? (
          <p className="prose-measure mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
            {note}
          </p>
        ) : null}
      </div>

      {trailing ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:justify-end md:pt-1">
          {trailing}
        </div>
      ) : (
        <div aria-hidden="true" />
      )}
    </li>
  );
};

export default LedgerRow;
