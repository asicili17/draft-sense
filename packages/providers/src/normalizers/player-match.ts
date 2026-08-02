export interface PlayerIdentityCandidate {
  readonly id: string;
  readonly fullName: string;
  readonly team?: string | undefined;
  readonly position?: string | undefined;
}
export type PlayerMatch =
  | { readonly kind: "matched"; readonly playerId: string }
  | { readonly kind: "unmatched" }
  | { readonly kind: "ambiguous"; readonly candidateIds: readonly string[] };
const normalized = (value: string) => value.toLocaleLowerCase().replace(/[^a-z]/g, "");
export function matchPlayer(
  input: Omit<PlayerIdentityCandidate, "id">,
  candidates: readonly PlayerIdentityCandidate[],
): PlayerMatch {
  const matches = candidates.filter(
    (candidate) =>
      normalized(candidate.fullName) === normalized(input.fullName) &&
      (!input.team || candidate.team === input.team) &&
      (!input.position || candidate.position === input.position),
  );
  return matches.length === 1
    ? { kind: "matched", playerId: matches[0]!.id }
    : matches.length > 1
      ? {
          kind: "ambiguous",
          candidateIds: matches.map((candidate) => candidate.id),
        }
      : { kind: "unmatched" };
}
