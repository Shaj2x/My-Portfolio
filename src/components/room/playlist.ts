/**
 * The playlist the desk speaker plays. Paste a share link from Spotify, YouTube (a playlist link)
 * or Apple Music. Leave it empty and the speaker plays the room's own synthesised lo-fi instead.
 */
export const PLAYLIST_URL = "";

export interface PlaylistEmbed {
  service: "Spotify" | "YouTube" | "Apple Music";
  /** the player to embed in a frame */
  embed: string;
  /** the link to open the playlist in its own app */
  open: string;
}

/** turn a share link into an embeddable player, or null if it isn't one we know */
export function playlistEmbed(url: string = PLAYLIST_URL): PlaylistEmbed | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.hostname.endsWith("spotify.com")) {
    const m = u.pathname.match(/\/(playlist|album|artist)\/([A-Za-z0-9]+)/);
    return m ? { service: "Spotify", embed: `https://open.spotify.com/embed/${m[1]}/${m[2]}?theme=0`, open: `https://open.spotify.com/${m[1]}/${m[2]}` } : null;
  }
  if (u.hostname.endsWith("youtube.com") || u.hostname === "youtu.be") {
    const list = u.searchParams.get("list");
    return list ? { service: "YouTube", embed: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}`, open: `https://www.youtube.com/playlist?list=${encodeURIComponent(list)}` } : null;
  }
  if (u.hostname === "music.apple.com") return { service: "Apple Music", embed: `https://embed.music.apple.com${u.pathname}${u.search}`, open: u.toString() };
  return null;
}
