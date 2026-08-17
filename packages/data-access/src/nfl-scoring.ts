type NumericStats = Readonly<Record<string, number>>;

const aliases: Record<string, readonly string[]> = {
  pass_yd: ["passYds", "passingYards", "pass_yd"],
  pass_td: ["passTD", "passingTouchdowns", "pass_td"],
  pass_int: ["passInt", "interceptionsThrown", "pass_int"],
  rush_yd: ["rushYds", "rushingYards", "rush_yd"],
  rush_td: ["rushTD", "rushingTouchdowns", "rush_td"],
  rec: ["receptions", "rec"],
  rec_yd: ["recYds", "receivingYards", "rec_yd"],
  rec_td: ["recTD", "receivingTouchdowns", "rec_td"],
  fumble_lost: ["fumblesLost", "fumble_lost"],
  two_pt: ["twoPtConversions", "two_pt", "2pt_tds"],
  pass_2pt: ["passTwoPtConversions", "pass_2pt"],
  rush_2pt: ["rushTwoPtConversions", "rush_2pt"],
  rec_2pt: ["recTwoPtConversions", "rec_2pt"],
};

const valueFor = (stats: NumericStats, keys: readonly string[]) =>
  keys.reduce((value, key) => value ?? stats[key], undefined as number | undefined) ?? 0;

/** Converts raw player-stat projections into points using Sleeper's scoring-setting keys. */
export function scoreNflProjection(
  stats: NumericStats,
  scoringRules: Readonly<Record<string, number>>,
) {
  return Number(
    Object.entries(scoringRules)
      .reduce(
        (total, [rule, multiplier]) =>
          total + valueFor(stats, aliases[rule] ?? [rule]) * multiplier,
        0,
      )
      .toFixed(2),
  );
}
