# Marq Living clickable prototype

A single-file, backend-free prototype for reviewing the design and flows: `index.html`, opened directly in a browser. All data is mock data held in memory, and it resets on reload.

- **Resident** (phone layout): home, live shuttle with ETAs, amenity booking, laundry with "notify me", announcements, front desk requests, EV charging and settings. Utilities, laundry and EV charging are included in rent, so residents see no costs.
- **Driver**: start and end a run, report a delay, or cancel.
- **Staff**: overview, residents, tickets, announcements, shuttle, amenities, rooms (with override and a fail-safe test), energy, EV charging, devices, rules and analytics. Energy costs and savings appear only here.

The roles share state. For example, a request sent as a resident shows up in Staff → Tickets, and a delay reported by the driver shows on the resident's shuttle screen. The production app, wired to Supabase and the services, is in `../web`.
