/*
 * One-time setup for the Spotify card (docs/spotify.md): sends you to Spotify to allow the site to
 * read what you're playing. Only works while SPOTIFY_SETUP is "1" in the Vercel environment.
 */
export const config = { runtime: "edge" };

export default function handler(request: Request) {
  const id = process.env.SPOTIFY_CLIENT_ID;
  if (process.env.SPOTIFY_SETUP !== "1" || !id) return new Response("Not found", { status: 404 });
  const origin = new URL(request.url).origin;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: id,
    scope: "user-read-currently-playing user-read-recently-played",
    redirect_uri: `${origin}/api/spotify-callback`,
  });
  return Response.redirect(`https://accounts.spotify.com/authorize?${params}`, 302);
}
