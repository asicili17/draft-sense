export interface SimulationCandidate { playerId: string; adp?: number | undefined; score: number; }
export interface AvailabilitySummary { playerId: string; availableProbability: number; }
function random(seed: number): () => number { let value = seed >>> 0; return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; }; }
export function runSimulation(input: { candidates: readonly SimulationCandidate[]; picksUntilNextTurn: number; trials: number; seed: string }): readonly AvailabilitySummary[] {
  const seed = [...input.seed].reduce((total, char) => total + char.charCodeAt(0), 0); const rand = random(seed); const taken = new Map<string, number>();
  for (let trial = 0; trial < input.trials; trial++) for (const candidate of input.candidates) { const draftPressure = Math.max(0.05, Math.min(0.95, (250 - (candidate.adp ?? 180)) / 260 + candidate.score / 200)); if (rand() > draftPressure * input.picksUntilNextTurn / 8) taken.set(candidate.playerId, (taken.get(candidate.playerId) ?? 0) + 1); }
  return input.candidates.map((candidate) => ({ playerId: candidate.playerId, availableProbability: Number(((taken.get(candidate.playerId) ?? 0) / input.trials).toFixed(3)) }));
}
