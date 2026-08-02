# DraftSense

A mobile-friendly web companion for Sleeper fantasy-football drafts. DraftSense imports a user's Sleeper league and draft board, combines licensed player projections with ADP, and produces transparent real-time recommendations. It never places picks on the user's behalf.

Initial integrations: Sleeper (league/draft state), MySportsFeeds (projected stat lines), and Fantasy Football Calculator (ADP). See [Provider Adapter Architecture](docs/provider-adapters.md).

## Database setup

After connecting Neon through Vercel, pull the private Preview environment variables locally with `vercel env pull .env.local`, then run `npm run db:push`. This creates the DraftSense tables in the connected database. Do not commit `.env.local` or share `DATABASE_URL`.
