# Database workflow

Prisma migrations are the source of truth for every deployed database. Do not use `db push` outside local, disposable development databases.

## Commands

- `npm run db:migrate:dev` creates and applies a reviewed forward-only migration during local schema development.
- `npm run db:migrate:deploy` applies committed migrations in preview, CI, and production. It is safe to rerun.
- `npm run db:test:reset` drops and recreates the database from migrations; use it only with an isolated test database.
- `npm run test:integration` resets the test database and runs the database-backed contract suite.

Set `DATABASE_URL` explicitly for every command. In CI the database is `draft_sense_test`; never point reset commands at a shared or production database.

## Release and rollback

Deploy the application only after `db:migrate:deploy` succeeds. Migrations are forward-only: when a released migration needs correction, ship a new corrective migration rather than editing or reverting the applied file. Before a production migration, rehearse it against a restored copy of the production schema and verify backup/restore ownership with the deployment operator.
