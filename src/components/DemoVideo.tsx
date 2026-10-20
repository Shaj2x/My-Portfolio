import { useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Play, X } from "lucide-react";
import type { DemoVideo } from "@/data/portfolio";

/**
 * A project's demo video, opened full size over the page. The trigger is whatever is passed in
 * (a "Watch demo" link, or the card's own thumbnail); the clip starts muted and loops, with the
 * browser's controls for sound, scrubbing and full screen.
 */
export const DemoVideoDialog = ({ video, title, children }: { video: DemoVideo; title: string; children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>{children}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[81] w-[min(1100px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-white/10 bg-[#0d0e11]/95 p-3 text-white shadow-[0_30px_100px_rgba(0,0,0,0.6)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:p-4"
          aria-describedby={undefined}
        >
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <DialogPrimitive.Title className="text-sm font-semibold sm:text-base">{title} · demo</DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label="Close" className="rounded-full p-1.5 text-white/60 transition-colors duration-150 hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <video poster={video.poster} controls autoPlay muted loop playsInline className="aspect-video w-full rounded-xl bg-black">
            <DemoSources video={video} />
          </video>
          {video.note && <p className="mt-2.5 px-1 text-xs text-white/50">{video.note}</p>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

/** a demo's files, best first; the browser plays the first it can */
export const DemoSources = ({ video }: { video: DemoVideo }) => (
  <>
    <source src={video.webm} type="video/webm; codecs=vp9" />
    <source src={video.mp4} type="video/mp4" />
  </>
);

/** the small "Watch demo" link used on project cards */
export const WatchDemo = ({ video, title, className = "" }: { video: DemoVideo; title: string; className?: string }) => (
  <DemoVideoDialog video={video} title={title}>
    <button type="button" className={`inline-flex items-center gap-1.5 ${className}`}>
      <Play className="h-4 w-4" /> Watch demo
    </button>
  </DemoVideoDialog>
);
