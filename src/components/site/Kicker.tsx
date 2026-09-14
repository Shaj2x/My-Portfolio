/** The 11px uppercase label that names what a section is. */
const Kicker = ({ children, inverse }: { children: string; inverse?: boolean }) => (
  <p className={`t-label ${inverse ? "text-paper/55" : "text-felt-gray"}`}>{children}</p>
);

export default Kicker;
