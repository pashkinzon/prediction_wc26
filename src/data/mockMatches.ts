import type { Match } from '../types';

// Later Phase 3: replace or hydrate this file from a backend route that calls
// football-data.org and stores normalized fixtures/results in Supabase.
export const mockMatches: Match[] = [
  {
    id: 'wc2026-001',
    homeTeam: 'Mexico',
    awayTeam: 'Portugal',
    kickoffTime: '2026-06-11T20:00:00.000Z',
    status: 'scheduled',
  },
  {
    id: 'wc2026-002',
    homeTeam: 'Canada',
    awayTeam: 'Japan',
    kickoffTime: '2026-06-12T00:00:00.000Z',
    status: 'scheduled',
  },
  {
    id: 'wc2026-003',
    homeTeam: 'United States',
    awayTeam: 'Ghana',
    kickoffTime: '2026-06-02T10:00:00.000Z',
    status: 'live',
  },
  {
    id: 'wc2026-004',
    homeTeam: 'Brazil',
    awayTeam: 'Germany',
    kickoffTime: '2026-06-01T19:00:00.000Z',
    status: 'finished',
    finalScore: { home: 2, away: 1 },
  },
  {
    id: 'wc2026-005',
    homeTeam: 'Argentina',
    awayTeam: 'France',
    kickoffTime: '2026-05-31T19:00:00.000Z',
    status: 'finished',
    finalScore: { home: 1, away: 1 },
  },
  {
    id: 'wc2026-006',
    homeTeam: 'Spain',
    awayTeam: 'Morocco',
    kickoffTime: '2026-06-15T18:00:00.000Z',
    status: 'scheduled',
  },
];
