import ScrollBadge from "@/components/site/ScrollBadge";

/**
 * Full-viewport editorial title over the page's single iridescent backdrop.
 * No subhead and no call to action — one monumental phrase breathing against
 * fluid light, with the rotating badge as the only other mark.
 */
const Hero = () => (
  <section data-dark-region className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden bg-obsidian text-paper">
    <div className="iridescent" aria-hidden="true" />

    {/* Keeps the headline legible where the amber runs hottest. */}
    <div className="absolute inset-0 bg-obsidian/25" aria-hidden="true" />

    <div className="relative w-full px-5 md:px-10">
      <h1 className="t-display">
        Shajith
        <br />
        Sasikumar
      </h1>
    </div>

    <div className="absolute bottom-10 left-5 md:left-10">
      <ScrollBadge />
    </div>
  </section>
);

export default Hero;
