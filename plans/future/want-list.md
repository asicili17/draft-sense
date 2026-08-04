# DraftSense Want List

Ideas to revisit after the MVP is working and has reliable historical data.

## Machine Learning

- Calibrate projections using historical outcomes and projection-source accuracy.
- Predict player availability at the user's next meaningful pick.
- Learn more realistic opponent draft tendencies for Monte Carlo simulations.
- Improve ADP distributions by position, scoring format, league size, and draft stage.
- Explore personalized strategy preferences, such as risk tolerance and positional preferences.
- Compare every learned signal against the deterministic baseline before using it in recommendations.

## AI and External Signals

- Create an AI-assisted ADP signal based on authorized, dated external factors such as role changes, depth charts, injury uncertainty, and market movement.
- Keep provider ADP and AI-derived ADP separate in the recommendation breakdown.
- Require source attribution, freshness dates, and a confidence score for every external signal.
- Use the AI signal as a capped adjustment to ADP, never as the final player ranking.
- Omit the adjustment when evidence is stale, conflicting, low confidence, or unavailable.
- Let explanations distinguish engine calculations, provider ADP, and outside evidence.

- Track Sleeper draft-state freshness using `last_picked` / `last_message_time` and show a clear stale-sync indicator before allowing a manual-pick fallback.
- Support Sleeper traded-pick and draft-slot mappings for keeper/dynasty leagues without assuming the original snake order is still authoritative.

## Product Ideas

- Add what-if comparisons between current-pick options.
- Support custom scoring, auction, keeper, dynasty, and additional sports.
- Add cited player news and analysis as optional explanation context.
- Add draft import/export, reconnect recovery, league collaboration, and audit history.
- Add user-adjustable strategy profiles and risk preferences.
- For commercial use, replace the initial FantasyPros projection source with a paid, explicitly licensed data service. Confirm rights for API access, caching, storage, display, and redistribution before launch.

## Guardrails

- Preserve a deterministic recommendation engine as the final decision authority.
- Version datasets, algorithm settings, learned models, prompts, and external signals.
- Keep a non-ML fallback for every draft state.
- Do not use unrestricted web content or uncited AI claims in rankings.
