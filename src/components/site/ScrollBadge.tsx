/**
 * The system's only typographic ornament: a circular badge with text tracing
 * the circumference, rotating continuously at slow tempo. Punctuation, not a
 * button — so it is hidden from assistive technology and the anchor beneath
 * it does the work.
 */
const ScrollBadge = () => (
  <a
    href="#start"
    aria-label="Scroll to content"
    className="group block h-[104px] w-[104px] text-paper"
  >
    <svg viewBox="0 0 120 120" className="h-full w-full animate-spin-slow" aria-hidden="true">
      <defs>
        <path
          id="badge-circle"
          d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0"
          fill="none"
        />
      </defs>
      <text
        fill="currentColor"
        style={{ fontSize: "11px", letterSpacing: "0.22em", fontWeight: 400 }}
      >
        <textPath href="#badge-circle" startOffset="0">
          SCROLL DOWN · SCROLL DOWN ·
        </textPath>
      </text>
      <path
        d="M60 52 L60 70 M54 64 L60 70 L66 64"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  </a>
);

export default ScrollBadge;
