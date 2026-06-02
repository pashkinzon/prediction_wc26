export type MatchStatus = 'scheduled' | 'live' | 'finished';

export type TeamScore = {
  home: number;
  away: number;
};

export type Match = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  status: MatchStatus;
  finalScore?: TeamScore;
};

export type Prediction = {
  matchId: string;
  userNickname: string;
  homeScore: number;
  awayScore: number;
  isGolden?: boolean;
  updatedAt: string;
};

export type User = {
  nickname: string;
};

export type PredictionReaction = {
  matchId: string;
  predictionUserNickname: string;
  reactorNickname: string;
  reaction: string;
  updatedAt: string;
};

export type LeaderboardRow = {
  nickname: string;
  totalPoints: number;
  exactScores: number;
  goldenHits: number;
  predictedMatches: number;
};
