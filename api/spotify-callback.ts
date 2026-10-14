/*
 * The second half of the one-time Spotify setup: swaps Spotify's code for a refresh token and shows
 * it once, to copy into Vercel as SPOTIFY_REFRESH_TOKEN. Only works while SPOTIFY_SETUP is "1".
 */
export const config = { runtime: "edge" };

const page = (body: string) =>
  new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Spotify setup</title><body style="font:16px system-ui;max-width:640px;margin:48px auto;padding:0 16px;line-height:1.5">${body}</body>`, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export default async function handler(request: Request) {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (process.env.SPOTIFY_SETUP !== "1" || !id || !secret) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return page(`<h1>Spotify said no</h1><p>${esc(url.searchParams.get("error") ?? "No code came back.")}</p>`);
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { authorization: `Basic ${btoa(`${id}:${secret}`)}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: `${url.origin}/api/spotify-callback` }),
  });
  const data = (await res.json()) as { refresh_token?: string; error_description?: string };
  if (!data.refresh_token) return page(`<h1>That didn't work</h1><p>${esc(data.error_description ?? "Spotify didn't send a token.")}</p>`);
  return page(`<h1>Connected</h1><p>Copy this into Vercel as <b>SPOTIFY_REFRESH_TOKEN</b>, then remove <b>SPOTIFY_SETUP</b> and redeploy:</p><textarea readonly rows="4" style="width:100%;font:13px ui-monospace,monospace" onclick="this.select()">${esc(data.refresh_token)}</textarea><p>Keep it private: it lets the site read what you're playing.</p>`);
}
