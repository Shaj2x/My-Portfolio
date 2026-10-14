# Connecting Spotify to the posters

Clicking a poster in the room shows what you're playing on Spotify right now (or the last thing you
played). Until it's connected, the card shows the poster's own album instead. It takes about ten
minutes, once.

1. **Make a Spotify app.** Go to <https://developer.spotify.com/dashboard>, log in, and click
   *Create app*. Any name works. Under *Redirect URIs* add exactly
   `https://shajithsasikumar.com/api/spotify-callback`, tick *Web API*, and save. Open the app's
   settings and copy its **Client ID** and **Client secret**.
2. **Add them to Vercel.** In the Vercel project, open *Settings → Environment Variables* and add
   (for Production):
   - `SPOTIFY_CLIENT_ID`: the Client ID
   - `SPOTIFY_CLIENT_SECRET`: the Client secret
   - `SPOTIFY_SETUP`: `1`

   Then redeploy (Deployments → the latest one → *Redeploy*).
3. **Connect your account.** Visit <https://shajithsasikumar.com/api/spotify-login> and allow it.
   You'll land on a page showing a long token.
4. **Save the token.** Back in Vercel's environment variables, add `SPOTIFY_REFRESH_TOKEN` with that
   token, **delete** `SPOTIFY_SETUP`, and redeploy once more.

That's it. Keep the secret and the token private; they only let the site read what you're playing.
