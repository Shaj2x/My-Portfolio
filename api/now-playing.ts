/*
 * What Shajith is listening to on Spotify right now (or the last thing he played), for the posters
 * in the room. Runs on Vercel; the Spotify keys stay here on the server, in the project's
 * environment variables: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN (see
 * docs/spotify.md). Without them it answers { configured: false } and the room shows the poster's
 * own album instead.
 */
export const config = { runtime: "edge" };

type Track = { name: string; artists: { name: string }[]; album: { name: string; images: { url: string; width: number }[] }; external_urls: { spotify: string }; duration_ms: number };

const json = (body: unknown, maxAge = 15) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": `public, s-maxage=${maxAge}, stale-while-revalidate=30` },
  });

const shape = (t: Track) => ({
  title: t.name,
  artist: t.artists.map((a) => a.name).join(", "),
  album: t.album.name,
  // the smallest picture that's still sharp on a small card
  art: [...t.album.images].sort((a, b) => a.width - b.width).find((i) => i.width >= 200)?.url ?? t.album.images[0]?.url ?? null,
  url: t.external_urls.spotify,
  durationMs: t.duration_ms,
});

export default async function handler() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const refresh = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!id || !secret || !refresh) return json({ configured: false }, 300);
  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { authorization: `Basic ${btoa(`${id}:${secret}`)}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
    });
    if (!tokenRes.ok) return json({ configured: true, error: "token" }, 60);
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const auth = { authorization: `Bearer ${access_token}` };

    const now = await fetch("https://api.spotify.com/v1/me/player/currently-playing", { headers: auth });
    if (now.status === 200) {
      const data = (await now.json()) as { is_playing: boolean; progress_ms: number; item: Track | null };
      if (data.item) return json({ configured: true, playing: data.is_playing, progressMs: data.progress_ms, ...shape(data.item) });
    }
    // nothing on right now: the last thing played
    const recent = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", { headers: auth });
    if (recent.ok) {
      const data = (await recent.json()) as { items: { track: Track; played_at: string }[] };
      const last = data.items[0];
      if (last) return json({ configured: true, playing: false, playedAt: last.played_at, ...shape(last.track) }, 60);
    }
    return json({ configured: true, playing: false }, 60);
  } catch {
    return json({ configured: true, error: "spotify" }, 30);
  }
}
