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

## Background jobs and live Sleeper sync

DraftSense is read-only with respect to Sleeper: users make every pick in Sleeper, and DraftSense reconciles the public draft snapshot before refreshing advice. Configure `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, and the deployed `APP_URL` to enable the durable outbox publisher and cryptographically protected job endpoint. While an imported draft is live, its refresh job schedules the next Sleeper read after `LIVE_DRAFT_POLL_SECONDS` (10 seconds by default). The Vercel cron remains a recovery publisher for outbox rows that could not be sent immediately.

Apply the new migration before enabling jobs: `npm run db:migrate:deploy`. Configure both QStash signing keys so key rotation does not interrupt background processing.

Operations can inspect the protected `GET /api/jobs/health` endpoint with the cron bearer secret. It reports ready outbox work, active leases, and jobs moved to the durable dead-letter state after eight failed publication attempts. Structured job events are emitted to the deployment logs for alerting.
