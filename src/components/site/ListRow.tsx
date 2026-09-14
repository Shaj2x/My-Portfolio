import { ReactNode } from "react";

interface ListRowProps {
  period: string;
  title: string;
  org?: string;
  note?: string;
  tag?: string;
  trailing?: ReactNode;
  href?: string;
  /** Rows on an obsidian band invert their palette. */
  inverse?: boolean;
}

/**
 * The card is content, not a container: no background, no radius, no shadow.
 * A single hairline rule separates entries. Jobs, degrees, leadership roles
 * and repositories are all rows in the same list.
 */
const ListRow = ({ period, title, org, note, tag, trailing, href, inverse }: ListRowProps) => {
  const rule = inverse ? "border-paper/20" : "border-obsidian/15";
  const muted = inverse ? "text-paper/55" : "text-felt-gray";

  const heading = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="link transition-colors duration-micro ease-monopo"
    >
      {title}
    </a>
  ) : (
    title
  );

  return (
    <li
      className={`grid grid-cols-1 items-baseline gap-x-3.5 gap-y-2 border-b ${rule} py-7 md:grid-cols-[132px_minmax(0,1fr)_minmax(0,200px)]`}
    >
      <span className={`t-label tnum ${muted}`}>{period}</span>

      <div className="min-w-0">
        <h3 className="t-subheading font-normal">{heading}</h3>

        {org ? <p className={`t-label mt-3 ${muted}`}>{org}</p> : null}
        {tag ? <p className="t-label mt-2">{tag}</p> : null}
        {note ? (
          <p className={`t-body-sm mt-3 max-w-[56ch] ${muted}`}>{note}</p>
        ) : null}
      </div>

      {trailing ? (
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 md:justify-end">{trailing}</div>
      ) : (
        <div aria-hidden="true" />
      )}
    </li>
  );
};

export default ListRow;
