# Marq Living resident app prototype

A single-file, backend-free prototype of the resident app for reviewing the design and flows: `index.html`, opened directly in a browser. All data is mock data held in memory, and it resets on reload.

- **Home:** alerts, next shuttle, free laundry machines, quick actions, bookings, announcements and front desk.
- **Shuttle:** live map and stop ETAs, an alert 5 minutes before the bus arrives, and next departures.
- **Book:** theatre and game room booking, enforcing the hours, length, notice and weekly-limit rules.
- **Laundry:** machine status with "Notify me".
- **Announcements, Front desk** (requests and replies), **EV charging** and **Settings.**
- **Sign in, sign up, and waiting for approval.** Sign out from Settings to see these screens.

Utilities, laundry and EV charging are included in rent, so residents never see costs. A few things are simulated so the alerts can be seen: the front desk replies to a new request after a few seconds, and the shuttle reports a short delay about 40 seconds after the page loads.

On wide screens the layout uses a sidebar. On phones it uses bottom tabs. The production app, wired to Supabase and the services, is in `../web`.
