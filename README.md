# DraftSense

A mobile-friendly web companion for Sleeper fantasy-football drafts. DraftSense imports a user's Sleeper league and draft board, combines licensed player projections with ADP, and produces transparent real-time recommendations. It never places picks on the user's behalf.

Initial integrations: Sleeper (league/draft state), FantasyPros (projected stat lines), and Fantasy Football Calculator (ADP). See [Provider Adapter Architecture](docs/provider-adapters.md).

## Database setup

After connecting Neon through Vercel, pull the private Preview environment variables locally with `vercel env pull .env.local`, then run `npm run db:migrate:deploy`. This applies the committed DraftSense migrations without clearing data. Do not commit `.env.local` or share `DATABASE_URL`.

## Authentication setup

DraftSense uses Clerk for identity and sessions. Each imported league and draft session belongs only to its importing user; the user's selected roster remains in PostgreSQL.

1. Create a Clerk development application and configure its sign-in and sign-up URLs as `/sign-in` and `/sign-up`.
2. Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` into `.env.local`; see `.env.example`.
3. Apply the committed database migrations with `npm run db:migrate:deploy` before starting the app.

The application never accepts an owner, user, or team slot from a client as proof of authorization. Server routes verify the Clerk session, map it to the local user, verify `DraftSession.ownerId`, and use the active `UserDraftTeamSelection` for roster context.
