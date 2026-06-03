import { createClient } from '@supabase/supabase-js';

const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';
const WORLD_CUP_COMPETITION_CODE = 'WC';

const FOOTBALL_DATA_HEADERS = [
  'X-API-Version',
  'X-Authenticated-Client',
  'X-RequestCounter-Reset',
  'X-RequestsAvailable',
];

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getThrottleHeaders(headers) {
  return Object.fromEntries(
    FOOTBALL_DATA_HEADERS.map((name) => [name, headers.get(name)]),
  );
}

function titleCaseToken(value) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getRoundName(match) {
  if (match.group) {
    return titleCaseToken(match.group);
  }

  if (match.stage) {
    return titleCaseToken(match.stage);
  }

  if (match.matchday) {
    return `Matchday ${match.matchday}`;
  }

  return 'World Cup';
}

export function mapFootballDataStatus(status) {
  if (status === 'FINISHED') return 'finished';
  if (['IN_PLAY', 'PAUSED'].includes(status)) return 'live';
  return 'scheduled';
}

function getTeamName(team) {
  return team?.shortName || team?.name || 'TBD';
}

function getScore(score) {
  const fullTime = score?.fullTime;
  const regularTime = score?.regularTime;

  if (typeof fullTime?.home === 'number' && typeof fullTime?.away === 'number') {
    return { home: fullTime.home, away: fullTime.away };
  }

  if (
    typeof regularTime?.home === 'number' &&
    typeof regularTime?.away === 'number'
  ) {
    return { home: regularTime.home, away: regularTime.away };
  }

  return { home: null, away: null };
}

export function normalizeFootballDataMatch(match) {
  const score = getScore(match.score);

  return {
    id: `fd-${match.id}`,
    home_team: getTeamName(match.homeTeam),
    away_team: getTeamName(match.awayTeam),
    kickoff_time: match.utcDate,
    status: mapFootballDataStatus(match.status),
    final_home_score: score.home,
    final_away_score: score.away,
    round_name: getRoundName(match),
  };
}

async function fetchWorldCupMatches(apiToken) {
  const response = await fetch(
    `${FOOTBALL_DATA_BASE_URL}/competitions/${WORLD_CUP_COMPETITION_CODE}/matches`,
    {
      headers: {
        'X-Auth-Token': apiToken,
      },
    },
  );
  const throttleHeaders = getThrottleHeaders(response.headers);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof body?.message === 'string'
        ? body.message
        : `football-data.org responded with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.throttleHeaders = throttleHeaders;
    throw error;
  }

  return {
    matches: Array.isArray(body.matches) ? body.matches : [],
    throttleHeaders,
  };
}

async function upsertMatches(matches) {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (matches.length === 0) {
    return { syncedCount: 0 };
  }

  const { error } = await supabase.from('matches').upsert(matches, {
    onConflict: 'id',
  });

  if (error) {
    throw error;
  }

  return { syncedCount: matches.length };
}

export async function syncWorldCupMatches() {
  const apiToken = requiredEnv('FOOTBALL_DATA_API_KEY');
  const { matches, throttleHeaders } = await fetchWorldCupMatches(apiToken);
  const normalizedMatches = matches.map(normalizeFootballDataMatch);
  const result = await upsertMatches(normalizedMatches);
  const syncedAt = new Date().toISOString();

  console.log('World Cup match sync completed', {
    syncedCount: result.syncedCount,
    syncedAt,
    throttleHeaders,
  });

  return {
    ...result,
    throttleHeaders,
    syncedAt,
  };
}
