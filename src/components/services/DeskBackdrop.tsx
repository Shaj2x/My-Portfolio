import { useEffect, useRef, useState } from "react";
import type { PlainRoomHandle } from "@/components/room/createPlainRoom";

/*
 * The services page's world: you're sitting in the desk chair of the 3D room, looking at the
 * monitor. The cursor turns your head a little; scrolling leans you in toward the screen. Loaded after the text, and it
 * fades up from black (the room's sit-down transition ends on black, so the two meet).
 */
const DeskBackdrop = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    let room: PlainRoomHandle | null = null;
    let cancelled = false;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      room?.setLean(max > 0 ? Math.min(1, (window.scrollY / max) * 1.6) : 0);
    };
    import("@/components/room/createPlainRoom")
      .then(({ createPlainRoom }) => {
        if (cancelled) return;
        try {
          room = createPlainRoom(container, { seated: true, muted: true, onFirstFrame: () => setShown(true) });
          // what's on the screen in front of you: the page you're on
          room.showProject({
            name: "services",
            status: "Shajith Sasikumar",
            title: "What I build",
            description: "AI receptionists · End-to-end automation · Websites · Brand identity · AI voice agents · Custom AI · 1-on-1 tutoring",
            footer: "London, Ontario",
          });
        } catch {
          return; // no WebGL: the dark stand-in stays
        }
        onScroll();
      })
      .catch(() => undefined);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onScroll);
      room?.dispose();
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden bg-[#0b0c0f]" aria-hidden="true">
      <div ref={ref} className={`absolute inset-0 transition-opacity duration-1000 ease-out ${shown ? "opacity-100" : "opacity-0"}`} />
      <div className="absolute inset-0 bg-[radial-gradient(140%_100%_at_60%_40%,transparent_55%,rgba(0,0,0,0.5)_100%)]" />
    </div>
  );
};

export default DeskBackdrop;
