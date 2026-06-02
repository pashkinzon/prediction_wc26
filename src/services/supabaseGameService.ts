import type { Match, Prediction, PredictionReaction } from '../types';
import { supabase } from './supabaseClient';

type PlayerRow = {
  id: string;
  nickname: string;
  pin_code: string;
};

type MatchRow = {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  status: Match['status'];
  final_home_score: number | null;
  final_away_score: number | null;
  round_name: string;
};

type PredictionRow = {
  id: string;
  player_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  is_golden: boolean;
  updated_at: string;
  players: { nickname: string } | null;
};

type ReactionRow = {
  id: string;
  prediction_id: string;
  reaction: string;
  updated_at: string;
  predictions: {
    match_id: string;
    players: { nickname: string } | null;
  } | null;
  players: { nickname: string } | null;
};

export type SupabaseGameData = {
  matches: Match[];
  predictions: Prediction[];
  reactions: PredictionReaction[];
};

function mapMatch(row: MatchRow): Match {
  return {
    id: row.id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    kickoffTime: row.kickoff_time,
    status: row.status,
    roundName: row.round_name,
    finalScore:
      row.final_home_score !== null && row.final_away_score !== null
        ? { home: row.final_home_score, away: row.final_away_score }
        : undefined,
  };
}

function mapPrediction(row: PredictionRow): Prediction | null {
  const nickname = row.players?.nickname;
  if (!nickname) return null;

  return {
    matchId: row.match_id,
    userNickname: nickname,
    homeScore: row.home_score,
    awayScore: row.away_score,
    isGolden: row.is_golden,
    updatedAt: row.updated_at,
  };
}

function mapReaction(row: ReactionRow): PredictionReaction | null {
  const predictionNickname = row.predictions?.players?.nickname;
  const reactorNickname = row.players?.nickname;
  const matchId = row.predictions?.match_id;
  if (!predictionNickname || !reactorNickname || !matchId) return null;

  return {
    matchId,
    predictionUserNickname: predictionNickname,
    reactorNickname,
    reaction: row.reaction,
    updatedAt: row.updated_at,
  };
}

async function getPlayerByNickname(nickname: string): Promise<PlayerRow | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('players')
    .select('id,nickname,pin_code')
    .eq('nickname', nickname)
    .single();

  if (error) throw error;
  return data;
}

async function getPredictionId(matchId: string, playerId: string): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('predictions')
    .select('id')
    .eq('match_id', matchId)
    .eq('player_id', playerId)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

async function getMatchRoundMatchIds(matchId: string): Promise<string[]> {
  if (!supabase) return [];

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('round_name')
    .eq('id', matchId)
    .single();

  if (matchError) throw matchError;

  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('id')
    .eq('round_name', match.round_name);

  if (matchesError) throw matchesError;
  return (matches ?? []).map((item) => item.id);
}

export async function verifySupabasePlayerPin(
  nickname: string,
  pin: string,
): Promise<boolean> {
  const player = await getPlayerByNickname(nickname);
  return Boolean(player && player.pin_code === pin);
}

export async function fetchSupabaseGameData(): Promise<SupabaseGameData> {
  if (!supabase) {
    return { matches: [], predictions: [], reactions: [] };
  }

  const [matchesResult, predictionsResult, reactionsResult] = await Promise.all([
    supabase.from('matches').select('*').order('kickoff_time', { ascending: true }),
    supabase
      .from('predictions')
      .select('id,player_id,match_id,home_score,away_score,is_golden,updated_at,players(nickname)'),
    supabase
      .from('prediction_reactions')
      .select('id,prediction_id,reaction,updated_at,players(nickname),predictions(match_id,players(nickname))'),
  ]);

  if (matchesResult.error) throw matchesResult.error;
  if (predictionsResult.error) throw predictionsResult.error;
  if (reactionsResult.error) throw reactionsResult.error;

  return {
    matches: ((matchesResult.data ?? []) as MatchRow[]).map(mapMatch),
    predictions: ((predictionsResult.data ?? []) as unknown as PredictionRow[])
      .map(mapPrediction)
      .filter((prediction): prediction is Prediction => Boolean(prediction)),
    reactions: ((reactionsResult.data ?? []) as unknown as ReactionRow[])
      .map(mapReaction)
      .filter((reaction): reaction is PredictionReaction => Boolean(reaction)),
  };
}

export async function saveSupabasePrediction(prediction: Prediction) {
  if (!supabase) return;

  const player = await getPlayerByNickname(prediction.userNickname);
  if (!player) throw new Error('Player not found');

  if (prediction.isGolden) {
    const roundMatchIds = await getMatchRoundMatchIds(prediction.matchId);
    await supabase
      .from('predictions')
      .update({ is_golden: false })
      .eq('player_id', player.id)
      .in('match_id', roundMatchIds);
  }

  const { error } = await supabase.from('predictions').upsert(
    {
      player_id: player.id,
      match_id: prediction.matchId,
      home_score: prediction.homeScore,
      away_score: prediction.awayScore,
      is_golden: Boolean(prediction.isGolden),
      updated_at: prediction.updatedAt,
    },
    { onConflict: 'player_id,match_id' },
  );

  if (error) throw error;
}

export async function toggleSupabaseReaction(reaction: PredictionReaction) {
  if (!supabase) return;

  const [predictionPlayer, reactor] = await Promise.all([
    getPlayerByNickname(reaction.predictionUserNickname),
    getPlayerByNickname(reaction.reactorNickname),
  ]);

  if (!predictionPlayer || !reactor) throw new Error('Player not found');

  const predictionId = await getPredictionId(reaction.matchId, predictionPlayer.id);
  if (!predictionId) throw new Error('Prediction not found');

  const { data: existing, error: findError } = await supabase
    .from('prediction_reactions')
    .select('id,reaction')
    .eq('prediction_id', predictionId)
    .eq('reactor_id', reactor.id)
    .maybeSingle();

  if (findError) throw findError;

  if (existing?.reaction === reaction.reaction) {
    const { error } = await supabase
      .from('prediction_reactions')
      .delete()
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('prediction_reactions').upsert(
    {
      prediction_id: predictionId,
      reactor_id: reactor.id,
      reaction: reaction.reaction,
      updated_at: reaction.updatedAt,
    },
    { onConflict: 'prediction_id,reactor_id' },
  );

  if (error) throw error;
}
