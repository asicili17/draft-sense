# Simulation Design

## Monte Carlo draft simulation

For each candidate recommendation, simulate the remaining draft thousands of times from the current immutable session version. In each trial, lock the candidate as the user's next pick when evaluating that decision, model every subsequent opponent selection, and record which players and tiers remain at the user's later picks. Aggregate availability probability, expected roster value, and downside percentiles.

Seed each run deterministically from session version, dataset version, configuration, and trial index. This makes results reproducible and permits cache reuse. Store inputs and aggregate outputs, not every simulated pick by default.

## Opponent model

Each draft team has a configurable strategy profile: ADP adherence, positional-need weight, value weight, risk tolerance, stacking preference, and randomness. At a pick, create a candidate utility from ADP, projected value, tier, and roster need, then sample with a softmax/weighted distribution rather than always taking the highest utility. Default profiles are calibrated from historical drafts and vary by team so the board does not behave identically.

## ADP distributions and availability

Represent ADP as a distribution rather than a rank. Prefer provider historical pick distributions; otherwise use a bounded normal or log-normal approximation centered on ADP with position/source-specific variance. Condition distributions on players already drafted and re-normalize. Expected availability is the fraction of trials in which a player is available at a target future overall pick; report uncertainty and avoid treating close probabilities as certainties.

## Team needs

Model roster slots, starters, bench, flex eligibility, maximums, and configurable strategic targets. Need declines once a position is filled but never overrides hard roster eligibility. Opponent needs alter pick utility; the user's needs inform both recommendation scoring and the value of waiting.

## Performance

Run simulations asynchronously in workers. Cache by session version, dataset version, algorithm version, simulation configuration, and candidate set. Reuse common simulated draft prefixes across candidates, precompute eligible-player arrays, use compact numeric representations, and parallelize independent trial batches. Start with a fast default budget (for example 1,000 trials), increase adaptively when candidates are close, and publish a preliminary deterministic result while simulations run. Set deadlines and return the most recent completed summary rather than blocking the draft UI.

