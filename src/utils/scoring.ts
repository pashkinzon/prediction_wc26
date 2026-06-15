import type { LeaderboardRow, Match, Prediction, TeamScore } from '../types';

export function getOutcome(score: TeamScore): 'home' | 'away' | 'draw' {
  if (score.home > score.away) return 'home';
  if (score.away > score.home) return 'away';
  return 'draw';
}

export function calculatePoints(match: Match, prediction?: Prediction): number {
  if (!prediction || match.status !== 'finished' || !match.finalScore) {
    return 0;
  }

  const predictedScore = {
    home: prediction.homeScore,
    away: prediction.awayScore,
  };

  const exactScore =
    predictedScore.home === match.finalScore.home &&
    predictedScore.away === match.finalScore.away;
  const correctGoalDifference =
    predictedScore.home - predictedScore.away ===
    match.finalScore.home - match.finalScore.away;
  const correctOutcome = getOutcome(predictedScore) === getOutcome(match.finalScore);

  const basePoints =
    (exactScore ? 5 : 0) +
    (correctGoalDifference ? 3 : 0) +
    (correctOutcome ? 2 : 0);

  return prediction.isGolden ? basePoints * 2 : basePoints;
}

export function getScoringAchievements(match: Match, prediction?: Prediction) {
  if (!prediction || match.status !== 'finished' || !match.finalScore) {
    return {
      exactScore: false,
      goalDifference: false,
      outcome: false,
      goldApplied: false,
    };
  }

  const predictedScore = {
    home: prediction.homeScore,
    away: prediction.awayScore,
  };

  const exactScore =
    predictedScore.home === match.finalScore.home &&
    predictedScore.away === match.finalScore.away;
  const goalDifference =
    predictedScore.home - predictedScore.away ===
    match.finalScore.home - match.finalScore.away;
  const outcome = getOutcome(predictedScore) === getOutcome(match.finalScore);
  const hasBasePoints = exactScore || goalDifference || outcome;

  return {
    exactScore,
    goalDifference,
    outcome,
    goldApplied: Boolean(prediction.isGolden && hasBasePoints),
  };
}

export function calculateBasePoints(match: Match, prediction?: Prediction): number {
  if (!prediction) return 0;
  return calculatePoints(match, { ...prediction, isGolden: false });
}

export function isGoldenHit(match: Match, prediction?: Prediction): boolean {
  if (!prediction?.isGolden) return false;
  return calculateBasePoints(match, prediction) > 0;
}

export function getGoldenMultiplierLabel(prediction?: Prediction): string {
  return prediction?.isGolden ? '2x' : '1x';
}

export function getScoringBreakdown(match: Match, prediction?: Prediction): string {
  const basePoints = calculateBasePoints(match, prediction);
  if (!prediction?.isGolden) return `${basePoints} pts`;
  return `${basePoints} x 2 = ${basePoints * 2} pts`;
}

export function calculateSingleRulePoints(match: Match, prediction?: Prediction): number {
  if (!prediction || match.status !== 'finished' || !match.finalScore) {
    return 0;
  }

  const predictedScore = {
    home: prediction.homeScore,
    away: prediction.awayScore,
  };

  const exactScore =
    predictedScore.home === match.finalScore.home &&
    predictedScore.away === match.finalScore.away;

  if (exactScore) {
    return 5;
  }

  const correctGoalDifference =
    predictedScore.home - predictedScore.away ===
    match.finalScore.home - match.finalScore.away;

  if (correctGoalDifference) {
    return 3;
  }

  if (getOutcome(predictedScore) === getOutcome(match.finalScore)) {
    return 2;
  }

  return 0;
}

export function buildLeaderboard(
  matches: Match[],
  predictions: Prediction[],
): LeaderboardRow[] {
  const rows = new Map<string, LeaderboardRow>();

  predictions.forEach((prediction) => {
    const match = matches.find((item) => item.id === prediction.matchId);
    if (!match) return;

    const points = calculatePoints(match, prediction);
    const existing = rows.get(prediction.userNickname) ?? {
      nickname: prediction.userNickname,
      totalPoints: 0,
      exactScores: 0,
      goldenHits: 0,
      predictedMatches: 0,
    };

    rows.set(prediction.userNickname, {
      ...existing,
      totalPoints: existing.totalPoints + points,
      exactScores:
        existing.exactScores + (calculateSingleRulePoints(match, prediction) === 5 ? 1 : 0),
      goldenHits: existing.goldenHits + (isGoldenHit(match, prediction) ? 1 : 0),
      predictedMatches: existing.predictedMatches + 1,
    });
  });

  return Array.from(rows.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
    return a.nickname.localeCompare(b.nickname);
  });
}
