# Plan: Phase 1.7 Authentication, Membership, and User Team

**Created:** 2026-08-03
**Status:** Ready for Atlas Execution

## Summary

Phase 1.7 replaces the MVP’s implicit local user and hard-coded team slot with authenticated ownership, league membership, and an explicit selected draft team. It makes all session reads and mutations authorize against durable relationships.

## Context & Analysis

**Relevant Files:**
- `packages/data-access/prisma/schema.prisma`: users, leagues, sessions, and draft teams.
- `apps/web/app/api/v1/`: endpoints currently lacking an actor boundary.
- `docs/api-design.md`: authenticated API contract.
- `docs/database-schema.md`: intended LeagueMember and team ownership relationships.

**Key Functions/Classes:**
- `importSleeperLeague()` in `packages/data-access/`.
- Pick, recommendation, simulation, and explanation route handlers.
- `DraftAssistant` in `apps/web/components/`.

**Dependencies:**
- Phase 1.6 migration workflow and integration test harness.
- A chosen authentication provider/session strategy.

**Patterns & Conventions:**
- Server derives actor identity from a verified session; clients never submit owner IDs.
- Provider credentials remain private to their owner.
- Team ownership and league viewing permissions are explicit and auditable.

## Implementation Phases

### Phase 1.7.1: Identity and Membership Model

**Objective:** Persist authenticated identities and their authorized league relationships.

**Files to Modify/Create:**
- `packages/data-access/prisma/schema.prisma`: identity/session adapter fields and `LeagueMember` model.
- `apps/web/server/auth/`: provider integration and `requireUser()` helpers.
- `apps/web/app/api/v1/`: authenticated route boundary.

**Tests to Write:**
- `unauthenticated-request-rejected`
- `league-member-can-read-session`
- `non-member-cannot-read-session`

**Steps:**
1. Choose the auth provider and session transport.
2. Add migration-backed membership roles such as owner, editor, and viewer.
3. Replace the default local user with the authenticated actor during import.
4. Add reusable route authorization helpers.
5. Ensure all scoped queries filter through authorized session/league access.

**Acceptance Criteria:**
- [ ] Every draft-session endpoint has a verified actor.
- [ ] Users can access only leagues and sessions they are authorized to view.
- [ ] Provider links are owned by the importing user.

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
5. Render team identity and permissions in the draft room.

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
  - **Mitigation:** Support a documented local development identity flow while preserving the same server authorization interface.
- **Risk:** Membership expands into commissioner features.
  - **Mitigation:** Limit roles to access and pick permission; defer invitations and administration.

## Success Criteria

- [ ] No Phase 1 route relies on the default local user or team slot 1.
- [ ] Draft data is access-controlled and user-team-aware.

## Notes for Atlas

Implement authorization before WebSocket subscription authorization. Do not expose provider tokens or integration metadata to non-owners.
