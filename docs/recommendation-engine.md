# Recommendation Engine

## Decision pipeline

1. Load the version-pinned session, roster rules, available players, and projections.
2. Reject drafted or unsupported players and calculate baseline replacement values by position.
3. Assign tiers from projection/value breakpoints and calculate positional scarcity.
4. Score every eligible candidate for value, tier drop-off, roster fit, bench coverage, upside, redundancy, risk, and simulated future availability.
5. Compare immediate selection with the expected value of waiting; apply configurable strategy weights.
6. Return ranked recommendations with an immutable factor breakdown and confidence.

This pipeline is pure with respect to its explicit inputs. It must never call an LLM, current web data, or mutable cache while scoring.

## Core signals

**Value over replacement (VORP)** is projected scoring value above the best realistically startable replacement at the player's position, adjusted for the league's scoring and lineup. Recalculate baselines as rosters and availability change.

**Tier-based drafting** groups similarly valued players. The tier-drop signal estimates the lost value if the current tier is missed before the next user pick, informed by simulations.

**Positional scarcity** measures qualified remaining players relative to expected roster demand and upcoming opponent needs. It rewards scarce starter positions but is capped to prevent one noisy estimate from dominating.

**Roster construction** evaluates required starters, flex alternatives, and diminishing bench depth. Open starter slots create an increasing completion penalty rather than excluding useful bench players. Starter completion becomes mandatory only when the number of remaining selections equals the number of open required slots.

**Contingency coverage** estimates the value preserved when a starter at the candidate's position is unavailable. It uses position-level absence scenarios rather than unsupported player-specific injury or depth-chart claims. The first credible backup receives the most credit; additional depth receives diminishing value.

**Kicker and defense** remain eligible throughout the draft. Their value is controlled by replacement level, roster fit, and completion urgency rather than a hard round cutoff.

## Score and confidence

Normalize each signal against the current draft pool and compute a transparent weighted score:

`score = VORP + tier drop + scarcity + roster fit + coverage + upside + completion urgency + availability option value - redundancy - risk`

Weights are versioned configuration, not hidden prompt behavior. Keep raw and normalized factors for explanations and evaluation.

Confidence is not a probability of player success. It expresses ranking stability: combine projection-source agreement, separation from the next candidate, simulation sample size, availability variance, and data freshness. Lower confidence when inputs disagree, simulations have wide intervals, or candidates score similarly. Return the factors that reduced confidence.

## Evaluation and safeguards

Backtest against historical draft positions, compare recommendation utility with ADP and expert baselines, and track latency and recommendation churn. Preserve algorithm/configuration versions. Validate all rules server-side and return a safe fallback ranking when simulation data is unavailable.
