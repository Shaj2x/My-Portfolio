import { useEffect, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import type { PosterInfo } from "./createPlainRoom";

/**
 * The card a poster opens: what I'm playing on Spotify right now, or the last thing I played.
 * When Spotify isn't connected (or can't be reached) it shows the poster's own album, with a way
 * to listen to it.
 */
interface Track {
  configured: boolean;
  playing?: boolean;
  title?: string;
  artist?: string;
  album?: string;
  art?: string | null;
  url?: string;
  progressMs?: number;
  durationMs?: number;
  playedAt?: string;
  error?: string;
}

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

export const NowPlaying = ({ poster, onClose }: { poster: PosterInfo; onClose: () => void }) => {
  const [track, setTrack] = useState<Track | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/now-playing")
        .then((r) => (r.ok ? (r.json() as Promise<Track>) : Promise.reject()))
        .then((t) => live && setTrack(t))
        .catch(() => live && setFailed(true));
    void load();
    // keep it current while it's open
    const timer = window.setInterval(load, 20000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);

  const loading = !track && !failed;
  const hasTrack = !!track?.configured && !!track.title;
  const search = `https://open.spotify.com/search/${encodeURIComponent(`${poster.album} ${poster.artist}`)}`;

  return (
    <div className="w-[min(340px,calc(100vw-32px))] liquid-glass-panel rounded-[22px] p-4 text-white">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-amber-200/75">
          {hasTrack && track.playing && (
            <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className="eq-bar w-[3px] rounded-full bg-[#1ed760]" style={{ animationDelay: `${i * 0.18}s` }} />
              ))}
            </span>
          )}
          {loading ? "Checking Spotify…" : hasTrack ? (track.playing ? "Playing right now" : "Last played") : "On my wall"}
        </p>
        <button type="button" aria-label="Close" className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        {hasTrack && track.art ? (
          <img src={track.art} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover shadow-lg" />
        ) : (
          <div className={`h-16 w-16 shrink-0 rounded-lg bg-white/10 ${loading ? "animate-pulse" : ""}`} aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{loading ? " " : hasTrack ? track.title : poster.album}</p>
          <p className="truncate text-sm text-white/65">{loading ? " " : hasTrack ? track.artist : poster.artist}</p>
          {hasTrack && !track.playing && track.playedAt && <p className="text-xs text-white/45">{ago(track.playedAt)}</p>}
        </div>
      </div>
      {hasTrack && track.playing && track.durationMs ? (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#1ed760]" style={{ width: `${Math.min(100, ((track.progressMs ?? 0) / track.durationMs) * 100)}%` }} />
        </div>
      ) : null}
      {!loading && (
        <a
          href={hasTrack && track.url ? track.url : search}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#1ed760] px-4 py-2 text-sm font-semibold text-black transition-colors duration-150 hover:bg-[#3be477]"
        >
          {hasTrack ? "Open in Spotify" : `Listen to ${poster.album}`} <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      )}
    </div>
  );
};
