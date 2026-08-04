# Plan: Phase 0.5 Frontend and UI Design

**Created:** 2026-08-01
**Status:** Ready for Atlas Execution

## Summary

Phase 0.5 gives frontend and product experience its own execution phase before the MVP is assembled end to end. The goal is to define the product surface, interaction model, information hierarchy, visual system, and reusable component architecture for DraftSense's draft-assistant workflow, then implement the initial UI shell and feature scaffolding so later backend-driven MVP work plugs into an intentional user experience instead of a placeholder interface.

## Context & Analysis

**Relevant Files:**
- `docs/architecture.md`: defines the browser responsibilities and server-authoritative UI boundary.
- `docs/project-structure.md`: defines `apps/web/app/`, `components/`, `features/`, and the separation between client-safe and server-only code.
- `docs/api-design.md`: defines the resource and event surfaces the UI will consume.
- `docs/roadmap.md`: defines the MVP scope as a mobile-friendly web app for one user-managed NFL roster.
- `docs/ai-integration.md`: defines that explanations are recommendation-adjacent and not the primary product mode.

**Key Functions/Classes:**
- Future route segments and layout shells in `apps/web/app/`.
- Shared visual primitives and wrappers in `apps/web/components/`.
- Draft-specific presentation state and screen composition in `apps/web/features/draft/`.
- Data-fetch and WebSocket integration hooks in `apps/web/lib/` or feature modules.

**Dependencies:**
- Phase 0 repository skeleton, shared config, and app runtime.
- Design references from existing fantasy draft tools, roster dashboards, and live assistant products.
- Final API DTOs may continue evolving, so the UI should use mocked contracts and adapters during this phase.

**Patterns & Conventions:**
- The UI renders authoritative server state and never computes rankings.
- The product is recommendation-first, not chat-first.
- Mobile usability is a first-class constraint, not a later polish pass.
- Frontend work should create reusable primitives and feature shells, not one-off page markup.

## Implementation Phases

### Phase 0.5.1: UX and Competitive Research

**Objective:** Study strong draft-assistant, fantasy, and decision-support UIs to identify proven interaction patterns and gaps DraftSense should address.

**Files to Modify/Create:**
- `plans/frontend-ui-research-notes.md`: structured findings, screenshots/links reference list, and extracted UX patterns.
- Optional supporting notes in the `plans/` directory documenting IA, comparison tables, and design principles.

**Tests to Write:**
- No code tests in this subphase; deliver research artifacts with explicit design decisions and rejected patterns.

**Steps:**
1. Review popular fantasy and draft-assistant products for board layout, queueing, recommendation surfaces, roster views, mobile behavior, and explanation patterns.
2. Compare adjacent product categories such as financial dashboards, sports live-score apps, and decision-support tools for dense real-time information design.
3. Document which patterns should be borrowed, avoided, or adapted for DraftSense.
4. Define core UX principles for the product, such as glanceability during a live draft, minimal tap count, and clear degraded-state messaging.
5. Convert research into a prioritized list of screens, UI states, and interaction requirements.

**Acceptance Criteria:**
- [ ] Research covers direct fantasy-product inspiration and adjacent real-time dashboard patterns.
- [ ] Findings translate into explicit DraftSense UI principles rather than vague inspiration.
- [ ] The resulting notes are detailed enough for another agent to execute the UI direction consistently.

---

### Phase 0.5.2: Information Architecture and Product Flow Design

**Objective:** Define what the user sees, in what order, and how they move through the product from league import to live draft use.

**Files to Modify/Create:**
- `plans/frontend-information-architecture.md`
- `plans/frontend-screen-states.md`
- Optional wireframe/spec artifacts referenced from the plan directory.

**Tests to Write:**
- No executable tests yet; require screen/state coverage review.

**Steps:**
1. Define the key screens: league lookup, session import, draft board, recommendation panel, roster view, player detail, simulation/explanation state, and degraded-state handling.
2. Map the user journey for first-time import, returning to an existing session, live draft participation, stale upstream fallback, and explanation requests.
3. Enumerate edge states: empty results, loading, upstream stale data, disconnected socket, simulation pending, AI unavailable, and version conflict recovery.
4. Decide what information is always visible during a live draft versus collapsed into secondary panels.

**Acceptance Criteria:**
- [ ] The full MVP user journey is defined screen by screen.
- [ ] Edge and degraded states are included, not deferred.
- [ ] The IA aligns with a recommendation-first product model.

---

### Phase 0.5.3: Visual System and Component Architecture

**Objective:** Create the visual language and reusable component structure the MVP UI will build on.

**Files to Modify/Create:**
- `apps/web/components/`: design-system wrappers, shared layout primitives, data cards, table/list primitives, status indicators, and responsive navigation.
- `apps/web/app/globals.css` and theme tokens.
- `plans/frontend-component-inventory.md`: component ownership, props, and intended reuse.

**Tests to Write:**
- `component-render-smoke`
- `responsive-layout-smoke`
- `accessibility-basics-for-navigation-and-live-regions`

**Steps:**
1. Choose the visual direction, typography, spacing, and color/token system consistent with a dense live-draft product.
2. Build reusable primitives for cards, sticky panels, draft-board rows, recommendation lists, roster slots, status chips, and explanation blocks.
3. Define responsive breakpoints and panel-collapsing behavior for mobile-first use.
4. Establish accessibility requirements for keyboard navigation, focus states, status messaging, and live updates.

**Acceptance Criteria:**
- [ ] The UI has a coherent visual system rather than default library styling.
- [ ] Core interactive patterns are reusable and documented.
- [ ] Mobile and desktop layouts are intentionally designed, not incidental.

---

### Phase 0.5.4: Frontend Feature Shells and Mocked Integration

**Objective:** Implement the initial frontend screens and feature composition using mocked or adapter-backed data so MVP services can integrate cleanly later.

**Files to Modify/Create:**
- `apps/web/app/`: route shells and loading/error states.
- `apps/web/features/draft/`: board, roster, recommendations, player details, sync status, import flow, and session resume shells.
- `apps/web/lib/`: client data adapters, mock DTOs, and contract-facing hooks.

**Tests to Write:**
- `screen-shell-render-smoke`
- `mobile-live-draft-layout`
- `mocked-session-state-transitions`
- `ui-contract-adapter-tests`

**Steps:**
1. Implement screens using mocked contracts aligned to `docs/api-design.md`.
2. Keep transport logic behind hooks or adapters so backend APIs can replace mocks later with minimal churn.
3. Build loading, empty, degraded, and optimistic pending states into the shell implementation.
4. Validate the experience on common mobile and desktop breakpoints.

**Acceptance Criteria:**
- [ ] The app has realistic, navigable frontend shells before full backend wiring.
- [ ] UI integration points align with the documented API/event contracts.
- [ ] Replacing mock data with real services should not require redesigning screen composition.

## Open Questions

1. How much design exploration is enough before implementation begins?
   - **Option A:** Minimal inspiration and immediate coding.
   - **Option B:** Time-boxed research followed by explicit IA and component decisions.
   - **Recommendation:** Option B. A short, structured research phase prevents the MVP from hardening low-quality UI decisions.

2. Should the UI start with mocked contracts before backend APIs are complete?
   - **Option A:** Wait for backend endpoints.
   - **Option B:** Build against documented DTOs and swap adapters later.
   - **Recommendation:** Option B. It allows frontend progress in parallel while preserving API discipline.

## Risks & Mitigation

- **Risk:** UI work becomes cosmetic and disconnected from the product's real-time constraints.
  - **Mitigation:** Anchor every screen to a live-draft workflow, degraded state, or decision-support requirement.
- **Risk:** Inspiration research leads to copying provider-specific patterns that do not fit DraftSense.
  - **Mitigation:** Extract principles and tradeoffs, not clones; document why each pattern is adopted or rejected.
- **Risk:** Frontend implementation hardcodes temporary API assumptions.
  - **Mitigation:** Use typed DTO adapters and keep network details isolated from presentation components.

## Success Criteria

- [ ] DraftSense has a documented UX direction and UI inspiration research artifact.
- [ ] Screen flows, component inventory, and degraded states are specified.
- [ ] A reusable frontend shell exists for the MVP to wire into.
- [ ] The product experience is clearly defined before recommendation and simulation results are connected.

## Notes for Atlas

This phase is not optional polish. It should produce both research artifacts and executable UI scaffolding. Specifically include research on popular fantasy draft and assistant interfaces for inspiration, but adapt them to a recommendation-first product with dense real-time information and mobile constraints.