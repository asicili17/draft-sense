# Plan: Phase 1.7 Authentication, Membership, and User Team

**Created:** 2026-08-03
**Status:** Ready for Atlas Execution

## Summary

Phase 1.7 replaces the MVP’s implicit local user and hard-coded team slot with authenticated ownership, league membership, and an explicit selected draft team. It makes all session reads and mutations authorize against durable relationships.

## Context & Analysis

**Authentication decision:** Use Clerk for managed identity, sessions, OAuth, account recovery, and sign-in/up flows. DraftSense owns its visual experience and authorization: custom login/onboarding presentation, private league/session ownership, selected team, provider-link ownership, and draft-session checks remain in this repository and PostgreSQL. Do not add collaboration, invitations, commissioner permissions, or Clerk Organizations in this phase.

**Relevant Files:**
- `packages/data-access/prisma/schema.prisma`: users, leagues, sessions, and draft teams.
- `apps/web/app/api/v1/`: endpoints currently lacking an actor boundary.
- `docs/api-design.md`: authenticated API contract.
- `docs/database-schema.md`: intended team ownership relationships.

**Key Functions/Classes:**
- `importSleeperLeague()` in `packages/data-access/`.
- Pick, recommendation, simulation, and explanation route handlers.
- `DraftAssistant` in `apps/web/components/`.

**Dependencies:**
- Phase 1.6 migration workflow and integration test harness.
- Clerk application keys configured for local, preview, and production environments.
- Clerk's Next.js App Router SDK.

**Patterns & Conventions:**
- Server derives actor identity from a verified session; clients never submit owner IDs.
- Clerk is used server-side to verify the session and obtain the immutable Clerk user ID. The application maps that ID to its own `User` record.
- Clerk-hosted authentication components may be embedded and themed, but DraftSense pages, layouts, onboarding, league/team screens, and authorization decisions remain custom.
- Provider credentials remain private to their owner.
- Team ownership and league viewing permissions are explicit and auditable.

## Implementation Phases

### Phase 1.7.1: Identity and Membership Model

**Objective:** Persist authenticated identities and their authorized league relationships.

**Files to Modify/Create:**
- `packages/data-access/prisma/schema.prisma`: Clerk external identity field and selected-team relation.
- `apps/web/server/auth/`: Clerk integration, user synchronization, and `requireUser()`/authorization helpers.
- `apps/web/app/(auth)/`: custom DraftSense sign-in, sign-up, and onboarding screens using themed Clerk components or Clerk headless APIs.
- `apps/web/app/api/v1/`: authenticated route boundary.

**Tests to Write:**
- `unauthenticated-request-rejected`
- `owner-can-read-session`
- `different-user-cannot-read-session`

**Steps:**
1. Install and configure Clerk's Next.js SDK with environment-specific publishable and secret keys; protect app/API routes with Clerk middleware.
2. Create custom DraftSense auth/onboarding UI. Use Clerk only for identity widgets or headless auth calls, themed to the existing visual system; do not redirect users into a generic product shell.
3. Add a unique Clerk user ID to the local `User` model and create/find the local user from the verified Clerk actor. Keep application display data synchronized deliberately rather than trusting client-supplied profile fields.
4. Replace the default local user with the authenticated actor during import and scope the league, session, and provider link to that actor.
5. Add reusable `requireUser()` and `requireSessionAccess()` helpers. Route handlers must authorize ownership before reading or mutating draft data.
6. Ensure all scoped queries verify the authenticated owner, including recommendations, simulations, explanations, and future real-time subscriptions.

**Acceptance Criteria:**
- [ ] Every draft-session endpoint has a verified actor.
- [ ] Users can access only their own leagues and sessions.
- [ ] Provider links are owned by the importing user.
- [ ] Sign-in, sign-up, account, and onboarding presentation remains DraftSense-branded and custom.
- [ ] Clerk user identity is never accepted from a client request body or used as the sole authorization check for a league.

---

### Phase 1.7.2: Selected User Team

**Objective:** Associate each user’s draft decision workflow with an explicit team instead of slot 1.

**Files to Modify/Create:**
- `packages/data-access/`: team membership/selection services.
- `apps/web/app/api/v1/draft-sessions/[id]`: selected-team read/update DTOs.
- `apps/web/components/draft-assistant.tsx`: team selector and team-specific board state.
- `packages/recommendation/`: explicit roster/team inputs from application services.

**Tests to Write:**
- `recommendations-use-selected-team-roster`
- `manual-pick-requires-selected-team-permission`
- `team-selection-does-not-change-other-members`

**Steps:**
1. Add a durable user-to-draft-team selection relation.
2. Let authorized users choose their roster during session setup/resume.
3. Derive manual pick team, roster, and next-turn calculations server-side.
4. Remove client-provided team slot from mutation requests where possible.
5. Render team identity and permissions in the custom DraftSense draft room; Clerk UI is limited to account/auth interactions.

**Acceptance Criteria:**
- [ ] Recommendations use the authenticated user’s selected roster.
- [ ] A user cannot record picks for an unassigned team.
- [ ] Team selection is explicit in session reads and UI state.

## Open Questions

1. Should one user be able to select multiple teams in one league?
   - **Option A:** One active team per session.
   - **Option B:** Multiple owned teams with an active selector.
   - **Recommendation:** Option A for the MVP; retain a model that can expand later.

## Risks & Mitigation

- **Risk:** Auth choice blocks local development.
  - **Mitigation:** Configure a separate Clerk development instance and document local keys. Tests use a mocked verified-actor boundary rather than a real Clerk network call.
- **Risk:** Clerk Organizations are mistaken for fantasy-league authorization.
  - **Mitigation:** Store `LeagueMember`, selected-team assignment, and all session permissions in PostgreSQL; use server-side checks for every API route.
- **Risk:** Hosted auth UI dilutes product identity.
  - **Mitigation:** Build DraftSense-owned auth and onboarding layouts, theme any embedded Clerk components, and reserve Clerk's prebuilt UI for account-management flows where it meaningfully reduces risk.
- **Risk:** Membership expands into commissioner features.
  - **Mitigation:** Limit roles to access and pick permission; defer invitations and administration.

## Success Criteria

- [ ] No Phase 1 route relies on the default local user or team slot 1.
- [ ] Draft data is access-controlled and user-team-aware.

## Notes for Atlas

Implement authorization before WebSocket subscription authorization. Do not expose provider tokens or integration metadata to non-owners.
