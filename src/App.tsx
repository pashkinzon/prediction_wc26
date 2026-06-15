import { useEffect, useMemo, useState } from 'react';
import { Flag } from './components/Flag';
import { TimeOverride } from './components/TimeOverride';
import { mockMatches } from './data/mockMatches';
import { isSupabaseConfigured } from './services/supabaseClient';
import {
  fetchSupabaseGameData,
  saveSupabasePrediction,
  toggleSupabaseReaction,
  verifySupabasePlayerPin,
} from './services/supabaseGameService';
import type { Match, Prediction, PredictionReaction } from './types';
import {
  buildLeaderboard,
  calculatePoints,
  getOutcome,
  getScoringAchievements,
  getScoringBreakdown,
} from './utils/scoring';
import {
  getCurrentUserNickname,
  getPredictions,
  getReactions,
  getTimeOverride,
  savePredictions,
  setCurrentUserNickname,
  setTimeOverride,
  toggleReaction,
} from './utils/storage';

type AppTab = 'matches' | 'predictions' | 'leaderboard' | 'more';

const hardcodedPlayers = [
  { nickname: 'Pasha', pin: '6743' },
  { nickname: 'Fedor', pin: '1708' },
];

const tournamentRounds = [
  { label: 'Round 1 / Live', matchRounds: ['Group A', 'Group B', 'Group C', 'Group D'] },
  { label: 'Round 2', matchRounds: ['Group E', 'Group F', 'Group G', 'Group H'] },
  { label: 'Round 3', matchRounds: ['Group I', 'Group J', 'Group K', 'Group L'] },
  { label: 'Round of 32', matchRounds: ['Last 32'] },
  { label: 'Round of 16', matchRounds: ['Last 16'] },
  { label: 'Quarter-Finals', matchRounds: ['Quarter Finals'] },
  { label: 'Semi-Finals', matchRounds: ['Semi Finals', 'Third Place'] },
  { label: 'Final', matchRounds: ['Final'] },
];

function getStoredHardcodedPlayer() {
  const storedNickname = getCurrentUserNickname();
  return hardcodedPlayers.some((player) => player.nickname === storedNickname)
    ? storedNickname
    : '';
}

const teamMeta: Record<string, { countryCode?: string; shortName: string }> = {
  Algeria: { countryCode: 'dz', shortName: 'Algeria' },
  Argentina: { countryCode: 'ar', shortName: 'Argentina' },
  Australia: { countryCode: 'au', shortName: 'Australia' },
  Austria: { countryCode: 'at', shortName: 'Austria' },
  Belgium: { countryCode: 'be', shortName: 'Belgium' },
  'Bosnia-H.': { countryCode: 'ba', shortName: 'Bosnia-H.' },
  'Bosnia and Herzegovina': { countryCode: 'ba', shortName: 'Bosnia-H.' },
  Brazil: { countryCode: 'br', shortName: 'Brazil' },
  Canada: { countryCode: 'ca', shortName: 'Canada' },
  'Cape Verde': { countryCode: 'cv', shortName: 'Cape Verde' },
  Colombia: { countryCode: 'co', shortName: 'Colombia' },
  'Congo DR': { countryCode: 'cd', shortName: 'Congo DR' },
  Croatia: { countryCode: 'hr', shortName: 'Croatia' },
  Curaçao: { countryCode: 'cw', shortName: 'Curaçao' },
  Curacao: { countryCode: 'cw', shortName: 'Curaçao' },
  Czechia: { countryCode: 'cz', shortName: 'Czechia' },
  Ecuador: { countryCode: 'ec', shortName: 'Ecuador' },
  Egypt: { countryCode: 'eg', shortName: 'Egypt' },
  England: { countryCode: 'gb-eng', shortName: 'England' },
  France: { countryCode: 'fr', shortName: 'France' },
  Germany: { countryCode: 'de', shortName: 'Germany' },
  Ghana: { countryCode: 'gh', shortName: 'Ghana' },
  Haiti: { countryCode: 'ht', shortName: 'Haiti' },
  Iran: { countryCode: 'ir', shortName: 'Iran' },
  Iraq: { countryCode: 'iq', shortName: 'Iraq' },
  'Ivory Coast': { countryCode: 'ci', shortName: 'Ivory Coast' },
  Japan: { countryCode: 'jp', shortName: 'Japan' },
  Jordan: { countryCode: 'jo', shortName: 'Jordan' },
  'Korea Republic': { countryCode: 'kr', shortName: 'South Korea' },
  'South Korea': { countryCode: 'kr', shortName: 'South Korea' },
  Mexico: { countryCode: 'mx', shortName: 'Mexico' },
  Morocco: { countryCode: 'ma', shortName: 'Morocco' },
  Netherlands: { countryCode: 'nl', shortName: 'Netherlands' },
  'New Zealand': { countryCode: 'nz', shortName: 'New Zealand' },
  Norway: { countryCode: 'no', shortName: 'Norway' },
  Panama: { countryCode: 'pa', shortName: 'Panama' },
  Paraguay: { countryCode: 'py', shortName: 'Paraguay' },
  Portugal: { countryCode: 'pt', shortName: 'Portugal' },
  Qatar: { countryCode: 'qa', shortName: 'Qatar' },
  'Saudi Arabia': { countryCode: 'sa', shortName: 'Saudi Arabia' },
  Scotland: { countryCode: 'gb-sct', shortName: 'Scotland' },
  Senegal: { countryCode: 'sn', shortName: 'Senegal' },
  'South Africa': { countryCode: 'za', shortName: 'South Africa' },
  Spain: { countryCode: 'es', shortName: 'Spain' },
  Sweden: { countryCode: 'se', shortName: 'Sweden' },
  Switzerland: { countryCode: 'ch', shortName: 'Switzerland' },
  TBD: { shortName: 'TBD' },
  Tunisia: { countryCode: 'tn', shortName: 'Tunisia' },
  Turkey: { countryCode: 'tr', shortName: 'Turkey' },
  USA: { countryCode: 'us', shortName: 'USA' },
  Uruguay: { countryCode: 'uy', shortName: 'Uruguay' },
  'United States': { countryCode: 'us', shortName: 'USA' },
  Uzbekistan: { countryCode: 'uz', shortName: 'Uzbekistan' },
};

function parseOverride(value: string): Date {
  return value ? new Date(value) : new Date();
}

function getMatchGroup(match: Match) {
  if (match.roundName) return match.roundName;

  const groups = ['Group A', 'Group B', 'Group C'];
  const index = mockMatches.findIndex((item) => item.id === match.id);
  return groups[index % groups.length];
}

function isMatchOpenForPrediction(match: Match, effectiveNow: Date) {
  return match.status === 'scheduled' && effectiveNow < new Date(match.kickoffTime);
}

function sortMatchesByKickoff(matches: Match[]) {
  return [...matches].sort(
    (a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime(),
  );
}

function getMatchDateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function getMatchDateTimeLabel(value: string, effectiveNow: Date) {
  const kickoff = new Date(value);
  const dayLabel = new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
  }).format(kickoff);
  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(kickoff);

  if (kickoff.toDateString() === effectiveNow.toDateString()) {
    return `Today ${timeLabel}`;
  }

  const tomorrow = new Date(effectiveNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (kickoff.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow ${timeLabel}`;
  }

  return `${dayLabel} ${timeLabel}`;
}

function formatCountdown(targetDate: Date, effectiveNow: Date) {
  const diffMs = targetDate.getTime() - effectiveNow.getTime();
  if (diffMs <= 0) return 'Live';

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  return `${days}D · ${hours.toString().padStart(2, '0')}H · ${minutes
    .toString()
    .padStart(2, '0')}M`;
}

function getRoundCountdownLabel(
  round: { matchRounds: string[] },
  matches: Match[],
  effectiveNow: Date,
) {
  const roundMatches = matches.filter((match) => round.matchRounds.includes(getMatchGroup(match)));
  if (roundMatches.some((match) => match.status === 'live')) return 'Live';

  const futureStarts = roundMatches
    .map((match) => new Date(match.kickoffTime))
    .filter((kickoff) => kickoff > effectiveNow)
    .sort((a, b) => a.getTime() - b.getTime());

  if (futureStarts[0]) return formatCountdown(futureStarts[0], effectiveNow);
  if (roundMatches.length > 0) return 'Done';
  return 'TBD';
}

function getStageGoldPick(
  match: Match,
  currentNickname: string,
  matches: Match[],
  predictions: Prediction[],
) {
  return predictions.find((prediction) => {
    if (prediction.userNickname !== currentNickname || !prediction.isGolden) return false;
    const predictedMatch = matches.find((item) => item.id === prediction.matchId);
    return Boolean(predictedMatch && getMatchGroup(predictedMatch) === getMatchGroup(match));
  });
}

function getPreferredSelectedMatch(matches: Match[], effectiveNow: Date) {
  const sortedMatches = sortMatchesByKickoff(matches);
  return (
    sortedMatches.find((match) => isMatchOpenForPrediction(match, effectiveNow)) ??
    sortedMatches.find((match) => match.status === 'live') ??
    sortedMatches[0]
  );
}

function formatKickoff(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatKickoffFull(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getTeamMeta(team: string) {
  return teamMeta[team] ?? { shortName: team };
}

function TeamBadge({ team, align = 'center' }: { team: string; align?: 'left' | 'center' | 'right' }) {
  const meta = getTeamMeta(team);

  return (
    <div className={`team-badge team-badge-${align}`}>
      <Flag countryCode={meta.countryCode} label={meta.shortName} />
      <strong>{meta.shortName}</strong>
    </div>
  );
}

function App() {
  const [currentNickname, setCurrentNickname] = useState(getStoredHardcodedPlayer);
  const [loginNickname, setLoginNickname] = useState(
    getStoredHardcodedPlayer() || hardcodedPlayers[0].nickname,
  );
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [matches, setMatches] = useState<Match[]>(mockMatches);
  const [predictions, setPredictions] = useState<Prediction[]>(getPredictions);
  const [reactions, setReactions] = useState<PredictionReaction[]>(getReactions);
  const [timeOverride, setTimeOverrideState] = useState(getTimeOverride);
  const [activeTab, setActiveTab] = useState<AppTab>('matches');
  const [selectedMatchId, setSelectedMatchId] = useState(mockMatches[0]?.id ?? '');

  const effectiveNow = useMemo(() => parseOverride(timeOverride), [timeOverride]);
  const selectedMatch =
    matches.find((match) => match.id === selectedMatchId) ?? matches[0];
  const visiblePredictions = useMemo(() => {
    const allowedNicknames = new Set(hardcodedPlayers.map((player) => player.nickname));
    return predictions.filter((prediction) =>
      allowedNicknames.has(prediction.userNickname),
    );
  }, [predictions]);
  const leaderboardRows = useMemo(
    () => buildLeaderboard(matches, visiblePredictions),
    [matches, visiblePredictions],
  );
  const currentUserRank = leaderboardRows.findIndex(
    (row) => row.nickname === currentNickname,
  );

  async function loadGameData() {
    if (!isSupabaseConfigured) return;

    setIsLoadingData(true);
    setSyncError('');
    try {
      const gameData = await fetchSupabaseGameData();
      if (gameData.matches.length > 0) {
        setMatches(gameData.matches);
        setSelectedMatchId((currentId) => {
          if (currentId && gameData.matches.some((match) => match.id === currentId)) {
            return currentId;
          }

          return getPreferredSelectedMatch(gameData.matches, effectiveNow)?.id ?? '';
        });
      }
      setPredictions(gameData.predictions);
      setReactions(gameData.reactions);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Could not load Supabase data.');
    } finally {
      setIsLoadingData(false);
    }
  }

  useEffect(() => {
    void loadGameData();
  }, []);

  async function handleLogin() {
    let isValidLogin = false;

    if (isSupabaseConfigured) {
      try {
        isValidLogin = await verifySupabasePlayerPin(loginNickname, loginPin);
      } catch (error) {
        setLoginError(
          error instanceof Error ? error.message : 'Could not verify this player.',
        );
        return;
      }
    } else {
      isValidLogin = hardcodedPlayers.some(
        (item) => item.nickname === loginNickname && item.pin === loginPin,
      );
    }

    if (!isValidLogin) {
      setLoginError('Wrong PIN for this player.');
      return;
    }

    setCurrentUserNickname(loginNickname);
    setCurrentNickname(loginNickname);
    setLoginPin('');
    setLoginError('');
    void loadGameData();
  }

  function handleLogout() {
    setCurrentUserNickname('');
    setCurrentNickname('');
    setLoginNickname(hardcodedPlayers[0].nickname);
    setLoginPin('');
    setLoginError('');
  }

  async function handleSavePrediction(
    matchId: string,
    homeScore: number,
    awayScore: number,
    isGolden: boolean,
  ) {
    if (!currentNickname) return;

    const match = matches.find((item) => item.id === matchId);
    if (
      !match ||
      effectiveNow >= new Date(match.kickoffTime) ||
      match.status === 'live' ||
      match.status === 'finished'
    ) {
      return;
    }

    const savedPrediction: Prediction = {
      matchId,
      userNickname: currentNickname,
      homeScore,
      awayScore,
      isGolden,
      updatedAt: new Date().toISOString(),
    };

    const sourcePredictions = isSupabaseConfigured ? predictions : getPredictions();
    const nextPredictions = sourcePredictions
      .filter(
        (prediction) =>
          prediction.matchId !== matchId || prediction.userNickname !== currentNickname,
      )
      .map((prediction) => {
        if (!isGolden || prediction.userNickname !== currentNickname) return prediction;

        const predictedMatch = matches.find((item) => item.id === prediction.matchId);
        if (!predictedMatch || getMatchGroup(predictedMatch) !== getMatchGroup(match)) {
          return prediction;
        }

        return { ...prediction, isGolden: false };
      });

    const optimisticPredictions = [...nextPredictions, savedPrediction];
    setPredictions(optimisticPredictions);

    if (isSupabaseConfigured) {
      try {
        await saveSupabasePrediction(savedPrediction);
        await loadGameData();
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : 'Could not save prediction.');
      }
    } else {
      savePredictions(optimisticPredictions);
      setPredictions(getPredictions());
    }
  }

  async function handleToggleReaction(
    matchId: string,
    predictionUserNickname: string,
    reaction: string,
  ) {
    if (!currentNickname || currentNickname === predictionUserNickname) return;

    const nextReaction = {
      matchId,
      predictionUserNickname,
      reactorNickname: currentNickname,
      reaction,
      updatedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        await toggleSupabaseReaction(nextReaction);
        await loadGameData();
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : 'Could not save reaction.');
      }
    } else {
      toggleReaction(nextReaction);
      setReactions(getReactions());
    }
  }

  function handleTimeOverrideChange(value: string) {
    setTimeOverride(value);
    setTimeOverrideState(value);
  }

  function openMatch(matchId: string) {
    setSelectedMatchId(matchId);
    setActiveTab('matches');
    window.setTimeout(() => {
      document.querySelector('.detail-screen')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  }

  return (
    <main className="app-shell">
      <div className={`phone-frame ${!currentNickname ? 'auth-frame' : ''}`}>
        {currentNickname ? (
          <header className="top-bar">
            <div className="brand-block">
              <div className="brand-mark" aria-hidden="true">
                🏆
              </div>
              <div>
                <strong>WC 2026</strong>
                <span>Score Predictor</span>
              </div>
            </div>
            <TournamentRoundNav
              activeRound={selectedMatch ? getMatchGroup(selectedMatch) : ''}
              effectiveNow={effectiveNow}
              matches={matches}
            />
            <button className="icon-button" type="button" aria-label="Menu">
              ›
            </button>
          </header>
        ) : null}

        <section className={`screen-content ${!currentNickname ? 'auth-content' : ''}`}>
          {!currentNickname ? (
            <LoginScreen
              error={loginError}
              loginNickname={loginNickname}
              loginPin={loginPin}
              players={hardcodedPlayers}
              onLogin={handleLogin}
              onLoginNicknameChange={setLoginNickname}
              onLoginPinChange={setLoginPin}
            />
          ) : null}

          {currentNickname && activeTab === 'matches' && selectedMatch ? (
            <MatchesScreen
              currentNickname={currentNickname}
              currentUserRank={currentUserRank}
              effectiveNow={effectiveNow}
              leaderboardRows={leaderboardRows}
              isLoadingData={isLoadingData}
              matches={matches}
              predictions={visiblePredictions}
              reactions={reactions}
              selectedMatch={selectedMatch}
              syncError={syncError}
              onLogout={handleLogout}
              onOpenMatch={openMatch}
              onSavePrediction={handleSavePrediction}
              onToggleReaction={handleToggleReaction}
            />
          ) : null}

          {currentNickname && activeTab === 'predictions' ? (
            <PredictionsScreen
              currentNickname={currentNickname}
              matches={matches}
              predictions={visiblePredictions}
              onOpenMatch={openMatch}
            />
          ) : null}

          {currentNickname && activeTab === 'leaderboard' ? (
            <LeaderboardScreen
              currentNickname={currentNickname}
              currentUserRank={currentUserRank}
              rows={leaderboardRows}
            />
          ) : null}

          {currentNickname && activeTab === 'more' ? (
            <MoreScreen
              effectiveNow={effectiveNow}
              timeOverride={timeOverride}
              onTimeOverrideChange={handleTimeOverrideChange}
            />
          ) : null}
        </section>

        {currentNickname ? <BottomNav activeTab={activeTab} onChange={setActiveTab} /> : null}
      </div>
    </main>
  );
}

type MatchesScreenProps = {
  currentNickname: string;
  currentUserRank: number;
  effectiveNow: Date;
  isLoadingData: boolean;
  leaderboardRows: ReturnType<typeof buildLeaderboard>;
  matches: Match[];
  predictions: Prediction[];
  reactions: PredictionReaction[];
  selectedMatch: Match;
  syncError: string;
  onLogout: () => void;
  onOpenMatch: (matchId: string) => void;
  onSavePrediction: (
    matchId: string,
    homeScore: number,
    awayScore: number,
    isGolden: boolean,
  ) => void;
  onToggleReaction: (
    matchId: string,
    predictionUserNickname: string,
    reaction: string,
  ) => void;
};

function MatchesScreen({
  currentNickname,
  currentUserRank,
  effectiveNow,
  isLoadingData,
  leaderboardRows,
  matches,
  predictions,
  reactions,
  selectedMatch,
  syncError,
  onLogout,
  onOpenMatch,
  onSavePrediction,
  onToggleReaction,
}: MatchesScreenProps) {
  const [showPreviousMatches, setShowPreviousMatches] = useState(false);
  const liveMatches = sortMatchesByKickoff(matches.filter((match) => match.status === 'live'));
  const futureMatches = sortMatchesByKickoff(
    matches.filter((match) => isMatchOpenForPrediction(match, effectiveNow)),
  );
  const previousMatches = sortMatchesByKickoff(
    matches.filter(
      (match) =>
        match.status === 'finished' ||
        (match.status !== 'live' && new Date(match.kickoffTime) <= effectiveNow),
    ),
  );
  const currentUserPoints =
    leaderboardRows.find((row) => row.nickname === currentNickname)?.totalPoints ?? 0;

  return (
    <div className="matches-layout">
      <section className="home-screen">
        <div className="welcome-block">
          <p className="eyebrow">Welcome back, {currentNickname}</p>
          <h1>Match Center</h1>
          <p className="muted">Live, upcoming, and recent matches at a glance.</p>
        </div>

        {isLoadingData ? <p className="sync-note">Syncing Supabase data...</p> : null}
        {syncError ? <p className="sync-error">{syncError}</p> : null}

        <UserCard
          currentNickname={currentNickname}
          onLogout={onLogout}
        />

        <MatchCenterStats
          currentUserPoints={currentUserPoints}
          futureMatchesCount={futureMatches.length}
          leaderboardSize={leaderboardRows.length}
          matchesPassedCount={previousMatches.length}
          rank={currentUserRank >= 0 ? currentUserRank + 1 : undefined}
        />

        <AllMatchesSection
          effectiveNow={effectiveNow}
          futureMatches={futureMatches}
          liveMatches={liveMatches}
          previousMatches={previousMatches}
          selectedMatch={selectedMatch}
          showPreviousMatches={showPreviousMatches}
          onShowPreviousMatchesChange={setShowPreviousMatches}
          onOpenMatch={onOpenMatch}
        />

        <LeaderboardPreview rows={leaderboardRows} />
      </section>

      <MatchDetailScreen
        currentNickname={currentNickname}
        currentUserRank={currentUserRank}
        effectiveNow={effectiveNow}
        match={selectedMatch}
        matches={matches}
        predictions={predictions}
        reactions={reactions}
        onSavePrediction={onSavePrediction}
        onToggleReaction={onToggleReaction}
      />
    </div>
  );
}

function LoginScreen({
  error,
  loginNickname,
  loginPin,
  players,
  onLogin,
  onLoginNicknameChange,
  onLoginPinChange,
}: {
  error: string;
  loginNickname: string;
  loginPin: string;
  players: typeof hardcodedPlayers;
  onLogin: () => void;
  onLoginNicknameChange: (nickname: string) => void;
  onLoginPinChange: (pin: string) => void;
}) {
  return (
    <section className="login-screen">
      <div className="welcome-block">
        <p className="eyebrow">Private game</p>
        <h1>Who is predicting?</h1>
        <p className="muted">Select your player and enter your 4-digit PIN.</p>
      </div>
      <PlayerPinForm
        buttonLabel="Enter"
        error={error}
        loginNickname={loginNickname}
        loginPin={loginPin}
        players={players}
        onLogin={onLogin}
        onLoginNicknameChange={onLoginNicknameChange}
        onLoginPinChange={onLoginPinChange}
      />
    </section>
  );
}

function TournamentRoundNav({
  activeRound,
  effectiveNow,
  matches,
}: {
  activeRound: string;
  effectiveNow: Date;
  matches: Match[];
}) {
  return (
    <nav className="round-nav" aria-label="Tournament rounds">
      {tournamentRounds.map((round) => {
        const isActive = round.matchRounds.includes(activeRound);

        return (
          <button
            className={isActive ? 'round-nav-item active' : 'round-nav-item'}
            key={round.label}
            type="button"
            aria-current={isActive ? 'step' : undefined}
          >
            <span>{round.label}</span>
            <small>{getRoundCountdownLabel(round, matches, effectiveNow)}</small>
          </button>
        );
      })}
    </nav>
  );
}

function UserCard({
  currentNickname,
  onLogout,
}: {
  currentNickname: string;
  onLogout: () => void;
}) {
  return (
    <section className="user-card">
      <div className="user-avatar" aria-hidden="true">
        {currentNickname.slice(0, 1)}
      </div>
      <div className="signed-in-copy">
        <span>Signed in as</span>
        <strong>{currentNickname}</strong>
      </div>
      <button className="secondary-button" type="button" onClick={onLogout}>
        Log out
      </button>
    </section>
  );
}

function MatchCenterStats({
  currentUserPoints,
  futureMatchesCount,
  leaderboardSize,
  matchesPassedCount,
  rank,
}: {
  currentUserPoints: number;
  futureMatchesCount: number;
  leaderboardSize: number;
  matchesPassedCount: number;
  rank?: number;
}) {
  const stats: {
    icon: string;
    label: string;
    value: number | string;
    suffix?: string;
    tone: string;
  }[] = [
    { icon: '✓', label: 'Matches passed', value: matchesPassedCount, tone: 'green' },
    { icon: '◷', label: 'Future matches', value: futureMatchesCount, tone: 'blue' },
    { icon: '☆', label: 'Amount of points', value: currentUserPoints, tone: 'gold' },
    {
      icon: '♙',
      label: 'Rank among friends',
      value: rank ? `${rank}` : '-',
      suffix: leaderboardSize > 0 ? `of ${leaderboardSize}` : '',
      tone: 'purple',
    },
  ];

  return (
    <section className="match-center-stats" aria-label="Match center overview">
      {stats.map((stat) => (
        <article className={`stat-card stat-card-${stat.tone}`} key={stat.label}>
          <span aria-hidden="true">{stat.icon}</span>
          <div>
            <small>{stat.label}</small>
            <strong>
              {stat.value}
              {stat.suffix ? <em> {stat.suffix}</em> : null}
            </strong>
          </div>
        </article>
      ))}
    </section>
  );
}

function AllMatchesSection({
  effectiveNow,
  futureMatches,
  liveMatches,
  previousMatches,
  selectedMatch,
  showPreviousMatches,
  onShowPreviousMatchesChange,
  onOpenMatch,
}: {
  effectiveNow: Date;
  futureMatches: Match[];
  liveMatches: Match[];
  previousMatches: Match[];
  selectedMatch: Match;
  showPreviousMatches: boolean;
  onShowPreviousMatchesChange: (showPreviousMatches: boolean) => void;
  onOpenMatch: (matchId: string) => void;
}) {
  const visibleMatches = [
    ...liveMatches,
    ...futureMatches,
    ...(showPreviousMatches ? previousMatches : []),
  ];

  return (
    <section className="all-matches-card">
      <div className="all-matches-toolbar">
        <button
          className="show-previous-button"
          type="button"
          onClick={() => onShowPreviousMatchesChange(!showPreviousMatches)}
        >
          {showPreviousMatches ? 'Hide previous matches' : 'Show previous matches'}
          <span aria-hidden="true">{showPreviousMatches ? '⌃' : '⌄'}</span>
        </button>
        <h2>All Matches</h2>
        <span>{visibleMatches.length} shown</span>
      </div>
      {visibleMatches.length > 0 ? (
        <div className="all-match-list">
          {visibleMatches.map((match) => (
            <CompactMatchCard
              effectiveNow={effectiveNow}
              isPast={previousMatches.some((item) => item.id === match.id)}
              isSelected={match.id === selectedMatch.id}
              key={match.id}
              match={match}
              onOpenMatch={onOpenMatch}
            />
          ))}
        </div>
      ) : (
        <p className="empty-state">No matches available yet.</p>
      )}
    </section>
  );
}

function PlayerPinForm({
  buttonLabel,
  error,
  loginNickname,
  loginPin,
  players,
  onLogin,
  onLoginNicknameChange,
  onLoginPinChange,
}: {
  buttonLabel: string;
  error: string;
  loginNickname: string;
  loginPin: string;
  players: typeof hardcodedPlayers;
  onLogin: () => void;
  onLoginNicknameChange: (nickname: string) => void;
  onLoginPinChange: (pin: string) => void;
}) {
  return (
    <form
      className="player-pin-form"
      onSubmit={(event) => {
        event.preventDefault();
        onLogin();
      }}
    >
      <label>
        Player
        <select
          value={loginNickname}
          onChange={(event) => onLoginNicknameChange(event.target.value)}
        >
          {players.map((player) => (
            <option key={player.nickname} value={player.nickname}>
              {player.nickname}
            </option>
          ))}
        </select>
      </label>
      <label>
        4-digit PIN
        <input
          className="pin-input"
          inputMode="numeric"
          maxLength={4}
          pattern="[0-9]{4}"
          placeholder="••••"
          type="text"
          value={loginPin}
          onChange={(event) =>
            onLoginPinChange(event.target.value.replace(/\D/g, '').slice(0, 4))
          }
        />
      </label>
      <button type="submit">{buttonLabel}</button>
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}

function CompactMatchCard({
  effectiveNow,
  isPast = false,
  isSelected,
  match,
  onOpenMatch,
}: {
  effectiveNow: Date;
  isPast?: boolean;
  isSelected: boolean;
  match: Match;
  onOpenMatch: (matchId: string) => void;
}) {
  const kickoff = new Date(match.kickoffTime);
  const isLocked =
    effectiveNow >= kickoff || match.status === 'live' || match.status === 'finished';
  const statusLabel = match.status === 'finished' ? 'Result' : match.status;

  return (
    <article
      className={`compact-match ${isSelected ? 'compact-match-active' : ''} ${
        isPast ? 'compact-match-past' : ''
      }`}
    >
      <div className="compact-time">
        {match.status === 'live' ? (
          <em className="live-pill">Live</em>
        ) : (
          <time dateTime={match.kickoffTime}>
            {getMatchDateTimeLabel(match.kickoffTime, effectiveNow)}
          </time>
        )}
        {match.status !== 'scheduled' ? (
          <em className={`match-status match-status-${match.status}`}>{statusLabel}</em>
        ) : null}
      </div>
      <span className="compact-stage">{getMatchGroup(match)}</span>
      <TeamBadge team={match.homeTeam} align="left" />
      <strong className="compact-vs">vs</strong>
      <TeamBadge team={match.awayTeam} align="right" />
      <div className="compact-result">
        {match.status === 'live' ? <small>{statusLabel}</small> : null}
        {match.finalScore ? (
          <strong>
            {match.finalScore.home} - {match.finalScore.away}
          </strong>
        ) : (
          <span aria-hidden="true">◷</span>
        )}
        <button type="button" onClick={() => onOpenMatch(match.id)}>
          {isLocked ? 'View' : 'Predict'}
        </button>
      </div>
      <span className="match-chevron" aria-hidden="true">
        ›
      </span>
    </article>
  );
}

function MatchDetailScreen({
  currentNickname,
  currentUserRank,
  effectiveNow,
  match,
  matches,
  predictions,
  reactions,
  onSavePrediction,
  onToggleReaction,
}: {
  currentNickname: string;
  currentUserRank: number;
  effectiveNow: Date;
  match: Match;
  matches: Match[];
  predictions: Prediction[];
  reactions: PredictionReaction[];
  onSavePrediction: (
    matchId: string,
    homeScore: number,
    awayScore: number,
    isGolden: boolean,
  ) => void;
  onToggleReaction: (
    matchId: string,
    predictionUserNickname: string,
    reaction: string,
  ) => void;
}) {
  const kickoff = new Date(match.kickoffTime);
  const isLocked =
    effectiveNow >= kickoff || match.status === 'live' || match.status === 'finished';
  const hasStarted = isLocked || match.status === 'live' || match.status === 'finished';
  const userPrediction = predictions.find(
    (prediction) =>
      prediction.matchId === match.id && prediction.userNickname === currentNickname,
  );
  const matchPredictions = predictions.filter(
    (prediction) => prediction.matchId === match.id,
  );
  const points = calculatePoints(match, userPrediction);
  const homeScore = userPrediction?.homeScore ?? '';
  const awayScore = userPrediction?.awayScore ?? '';
  const selectedOutcome = userPrediction
    ? getOutcome({ home: userPrediction.homeScore, away: userPrediction.awayScore })
    : undefined;
  const stageGoldPick = getStageGoldPick(match, currentNickname, matches, predictions);
  const stageGoldMatch = stageGoldPick
    ? matches.find((item) => item.id === stageGoldPick.matchId)
    : undefined;

  return (
    <section className="detail-screen">
      <div className="match-hero">
        <p>{getMatchGroup(match)}</p>
        <h2>
          {match.homeTeam} vs {match.awayTeam}
        </h2>
        <time dateTime={match.kickoffTime}>{formatKickoffFull(match.kickoffTime)}</time>

        <div className="hero-teams">
          <TeamBadge team={match.homeTeam} />
          <div className="hero-score">
            {match.finalScore ? (
              <>
                <strong>{match.finalScore.home}</strong>
                <span>-</span>
                <strong>{match.finalScore.away}</strong>
              </>
            ) : (
              <strong>vs</strong>
            )}
            {match.status === 'live' ? <em>Live</em> : null}
          </div>
          <TeamBadge team={match.awayTeam} />
        </div>
      </div>

      <div className="prediction-sheet">
        <div className="sheet-handle" />
        <div className="sheet-title">
          <span aria-hidden="true">🔒</span>
          <div>
            <h2>{isLocked ? 'Prediction locked' : 'Make your prediction'}</h2>
            <p className="muted">Predictions lock at kickoff.</p>
          </div>
        </div>

        {match.status === 'live' ? (
          <div className="info-banner">
            <strong>Match is live</strong>
            <span>You can now see other people&apos;s predictions.</span>
          </div>
        ) : null}

        {currentNickname ? (
          <form
            className="detail-form"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              onSavePrediction(
                match.id,
                Number(formData.get('homeScore')),
                Number(formData.get('awayScore')),
                formData.get('isGolden') === 'on',
              );
            }}
          >
            <div className="golden-pick-card">
              <div>
                <strong>Confidence Bets</strong>
                <span>
                  One golden prediction per {getMatchGroup(match)}. Gold doubles earned points.
                  {stageGoldMatch && stageGoldMatch.id !== match.id
                    ? ` Current: ${getTeamMeta(stageGoldMatch.homeTeam).shortName} vs ${getTeamMeta(stageGoldMatch.awayTeam).shortName}.`
                    : ''}
                </span>
              </div>
              <label className="gold-toggle">
                <input
                  key={`${match.id}-${currentNickname}-gold-${userPrediction?.updatedAt}-${userPrediction?.isGolden}`}
                  defaultChecked={Boolean(userPrediction?.isGolden)}
                  disabled={isLocked}
                  name="isGolden"
                  type="checkbox"
                />
                <span>⭐ Gold Pick</span>
              </label>
            </div>

            <h3>Exact Score</h3>
            <div className="score-inputs">
              <label>
                <input
                  key={`${match.id}-${currentNickname}-home-${userPrediction?.updatedAt}`}
                  defaultValue={homeScore}
                  disabled={isLocked}
                  max="30"
                  min="0"
                  name="homeScore"
                  required
                  type="number"
                />
                <span>{getTeamMeta(match.homeTeam).shortName}</span>
              </label>
              <strong>-</strong>
              <label>
                <input
                  key={`${match.id}-${currentNickname}-away-${userPrediction?.updatedAt}`}
                  defaultValue={awayScore}
                  disabled={isLocked}
                  max="30"
                  min="0"
                  name="awayScore"
                  required
                  type="number"
                />
                <span>{getTeamMeta(match.awayTeam).shortName}</span>
              </label>
            </div>

            <h3>Match Result</h3>
            <div className="result-options">
              <div className={selectedOutcome === 'home' ? 'result-option active' : 'result-option'}>
                <strong>1</strong>
                <span>{getTeamMeta(match.homeTeam).shortName} win</span>
              </div>
              <div className={selectedOutcome === 'draw' ? 'result-option active' : 'result-option'}>
                <strong>X</strong>
                <span>Draw</span>
              </div>
              <div className={selectedOutcome === 'away' ? 'result-option active' : 'result-option'}>
                <strong>2</strong>
                <span>{getTeamMeta(match.awayTeam).shortName} win</span>
              </div>
            </div>

            <div className="scoring-card">
              <strong>Scoring System</strong>
              <span>Exact score <b>5 pts</b></span>
              <span>Correct goal difference <b>3 pts</b></span>
              <span>Correct winner/draw <b>2 pts</b></span>
              <span>Gold pick multiplier <b>x2</b></span>
            </div>

            <div className="save-row">
              <button type="submit" disabled={isLocked}>
                Save Prediction
              </button>
              <span className={`points-pill ${points > 0 ? 'points-positive' : ''}`}>
                {getScoringBreakdown(match, userPrediction)}
              </span>
            </div>
          </form>
        ) : (
          <p className="muted">Choose or add a nickname before predicting.</p>
        )}

        <OtherPredictions
          currentNickname={currentNickname}
          hasStarted={hasStarted}
          match={match}
          predictions={matchPredictions}
          reactions={reactions}
          onToggleReaction={onToggleReaction}
        />

        {currentUserRank >= 0 ? (
          <p className="rank-note">You are currently #{currentUserRank + 1}.</p>
        ) : null}
      </div>
    </section>
  );
}

function OtherPredictions({
  currentNickname,
  hasStarted,
  match,
  predictions,
  reactions,
  onToggleReaction,
}: {
  currentNickname: string;
  hasStarted: boolean;
  match: Match;
  predictions: Prediction[];
  reactions: PredictionReaction[];
  onToggleReaction: (
    matchId: string,
    predictionUserNickname: string,
    reaction: string,
  ) => void;
}) {
  const reactionOptions = ['🔥', '👏', '😮'];

  return (
    <div className="other-list">
      <h3>Other Predictions</h3>
      {!hasStarted ? <p className="muted">Visible after kickoff.</p> : null}
      {hasStarted && predictions.length === 0 ? (
        <p className="muted">No predictions saved yet.</p>
      ) : null}
      {hasStarted && predictions.length > 0 ? (
        <ul>
          {predictions.map((prediction) => {
            const points = calculatePoints(match, prediction);
            const predictionReactions = reactions.filter(
              (reaction) =>
                reaction.matchId === prediction.matchId &&
                reaction.predictionUserNickname === prediction.userNickname,
            );

            return (
              <li
                className={prediction.isGolden ? 'prediction-row prediction-row-gold' : 'prediction-row'}
                key={`${prediction.matchId}-${prediction.userNickname}`}
              >
                <div className="prediction-main">
                  <span className="avatar-dot">{prediction.userNickname.slice(0, 1)}</span>
                  <strong>{prediction.userNickname}</strong>
                  {prediction.isGolden ? <b className="gold-badge">⭐ Gold</b> : null}
                  <span>
                    {prediction.homeScore} - {prediction.awayScore}
                  </span>
                  <em className={points > 0 ? 'points-good' : 'points-zero'}>{points} pts</em>
                </div>
                <div className="reaction-bar">
                  {reactionOptions.map((reaction) => {
                    const count = predictionReactions.filter(
                      (item) => item.reaction === reaction,
                    ).length;
                    const isMine = predictionReactions.some(
                      (item) =>
                        item.reaction === reaction &&
                        item.reactorNickname === currentNickname,
                    );

                    return (
                      <button
                        className={isMine ? 'reaction-button active' : 'reaction-button'}
                        disabled={currentNickname === prediction.userNickname}
                        key={reaction}
                        type="button"
                        onClick={() =>
                          onToggleReaction(
                            prediction.matchId,
                            prediction.userNickname,
                            reaction,
                          )
                        }
                      >
                        {reaction}
                        {count > 0 ? <span>{count}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function LeaderboardPreview({ rows }: { rows: ReturnType<typeof buildLeaderboard> }) {
  return (
    <section className="leaderboard-preview">
      <h2>Leaderboard Top 3</h2>
      {rows.length === 0 ? (
        <p>No predictions yet.</p>
      ) : (
        <ol>
          {rows.slice(0, 3).map((row, index) => (
            <li key={row.nickname}>
              <span>{index + 1}</span>
              <strong>{row.nickname}</strong>
              <em>{row.totalPoints} pts</em>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ScoringIcons({
  match,
  prediction,
}: {
  match: Match;
  prediction: Prediction;
}) {
  const achievements = getScoringAchievements(match, prediction);
  const items = [
    { key: 'exact', icon: '◎', label: 'Exact score', earned: achievements.exactScore },
    { key: 'diff', icon: '▥', label: 'Goal difference', earned: achievements.goalDifference },
    { key: 'result', icon: '♕', label: 'Winner/draw', earned: achievements.outcome },
  ];

  return (
    <div className="scoring-icons" aria-label="Scoring achievements">
      {items.map((item) => (
        <span
          className={item.earned ? `score-icon score-icon-${item.key} earned` : 'score-icon'}
          key={item.key}
          title={item.label}
        >
          <b aria-hidden="true">{item.icon}</b>
          <small>{item.label}</small>
        </span>
      ))}
      {prediction.isGolden ? (
        <span
          className={achievements.goldApplied ? 'score-icon score-icon-gold earned' : 'score-icon score-icon-gold'}
          title="Gold pick"
        >
          <b aria-hidden="true">☆</b>
          <small>Gold x2</small>
        </span>
      ) : null}
    </div>
  );
}

function PredictionsScreen({
  currentNickname,
  matches,
  predictions,
  onOpenMatch,
}: {
  currentNickname: string;
  matches: Match[];
  predictions: Prediction[];
  onOpenMatch: (matchId: string) => void;
}) {
  const myPredictions = predictions.filter(
    (prediction) => prediction.userNickname === currentNickname,
  );
  const predictionHistory = sortMatchesByKickoff(
    myPredictions
      .map((prediction) => matches.find((item) => item.id === prediction.matchId))
      .filter((match): match is Match => Boolean(match?.finalScore && match.status === 'finished')),
  );

  return (
    <section className="predictions-screen">
      <div className="predictions-hero">
        <h1>My Predictions</h1>
        <p>{currentNickname || 'Choose a nickname on Matches first.'}</p>
      </div>
      <div className="prediction-history-card">
        <div className="prediction-history-heading">
          <div>
            <h2>Prediction History</h2>
            <p>All previous predictions in chronological order.</p>
          </div>
          <div className="scoring-legend">
            <strong>Scoring System</strong>
            <span><b>◎</b> Exact score <em>5 pts</em></span>
            <span><b>▥</b> Goal difference <em>3 pts</em></span>
            <span><b>♕</b> Winner / Draw <em>2 pts</em></span>
            <span><b>☆</b> Gold pick <em>x2</em></span>
          </div>
        </div>
        <div className="prediction-history-header" aria-hidden="true">
          <span>Date & time</span>
          <span>Match</span>
          <span>Actual final score</span>
          <span>Points earned</span>
          <span>How points were earned</span>
        </div>
        {predictionHistory.length === 0 ? (
          <p className="empty-state">No finished predictions yet.</p>
        ) : null}
        <div className="prediction-history-list">
          {predictionHistory.map((match, index) => {
            const prediction = myPredictions.find((item) => item.matchId === match.id);
            if (!prediction || !match.finalScore) return null;

            const previousMatch = predictionHistory[index - 1];
            const dateLabel = getMatchDateLabel(match.kickoffTime);
            const previousDateLabel = previousMatch
              ? getMatchDateLabel(previousMatch.kickoffTime)
              : '';
            const shouldShowDate = dateLabel !== previousDateLabel;
            const points = calculatePoints(match, prediction);

            return (
              <div className="prediction-history-group" key={`${prediction.matchId}-${prediction.userNickname}`}>
                {shouldShowDate ? <h3>{dateLabel}</h3> : null}
                <button
                  className="prediction-history-row"
                  type="button"
                  onClick={() => onOpenMatch(match.id)}
                >
                  <div className="prediction-time">
                    <time dateTime={match.kickoffTime}>
                      {new Intl.DateTimeFormat(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(match.kickoffTime))}
                    </time>
                    <span>{getMatchGroup(match)}</span>
                  </div>
                  <div className="prediction-matchup">
                    <TeamBadge team={match.homeTeam} align="left" />
                    <strong>vs</strong>
                    <TeamBadge team={match.awayTeam} align="right" />
                  </div>
                  <div className="actual-score-block">
                    <strong>
                      {match.finalScore.home} - {match.finalScore.away}
                    </strong>
                    <span>
                      Your pick {prediction.homeScore} - {prediction.awayScore}
                    </span>
                  </div>
                  <em className={points > 0 ? 'history-points earned' : 'history-points'}>
                    {points} pts
                  </em>
                  <ScoringIcons match={match} prediction={prediction} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LeaderboardScreen({
  currentNickname,
  currentUserRank,
  rows,
}: {
  currentNickname: string;
  currentUserRank: number;
  rows: ReturnType<typeof buildLeaderboard>;
}) {
  return (
    <section className="leaderboard-screen">
      <div className="leaderboard-heading">
        <h1>Leaderboard</h1>
        <div className="leaderboard-tabs">
          <span className="active">Overall</span>
          <span>This Round</span>
        </div>
      </div>
      <div className="trophy-band">
        <span aria-hidden="true">🏆</span>
        <h2>{currentUserRank >= 0 ? 'Well done!' : 'Start predicting'}</h2>
        <p>
          {currentUserRank >= 0
            ? `You are in ${currentUserRank + 1}${currentUserRank === 0 ? 'st' : currentUserRank === 1 ? 'nd' : 'th'} place`
            : 'Your ranking appears after your first pick.'}
        </p>
      </div>
      <ol className="leaderboard-list">
        {rows.length === 0 ? <li className="empty-state">No predictions yet.</li> : null}
        {rows.map((row, index) => (
          <li
            className={row.nickname === currentNickname ? 'current-user-row' : ''}
            key={row.nickname}
          >
            <span className="rank-number">{index + 1}</span>
            <span className="avatar-dot">{row.nickname.slice(0, 1)}</span>
            <strong>{row.nickname}</strong>
            <small>{row.goldenHits} gold hits</small>
            <em>{row.totalPoints} pts</em>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MoreScreen({
  effectiveNow,
  timeOverride,
  onTimeOverrideChange,
}: {
  effectiveNow: Date;
  timeOverride: string;
  onTimeOverrideChange: (value: string) => void;
}) {
  return (
    <section className="simple-screen">
      <h1>More</h1>
      <p className="muted">Local testing helpers and future integration notes.</p>
      <TimeOverride
        effectiveNow={effectiveNow}
        value={timeOverride}
        onChange={onTimeOverrideChange}
      />
      <div className="future-card">
        <h2>Later-ready</h2>
        <p>Supabase can replace localStorage for users, matches, and predictions.</p>
        <p>football-data.org should be called from a backend route so the API key stays private.</p>
      </div>
    </section>
  );
}

function BottomNav({
  activeTab,
  onChange,
}: {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  const items: { id: AppTab; icon: string; label: string }[] = [
    { id: 'matches', icon: '⚽', label: 'Matches' },
    { id: 'predictions', icon: '📋', label: 'My Predictions' },
    { id: 'leaderboard', icon: '🏆', label: 'Leaderboard' },
    { id: 'more', icon: '•••', label: 'More' },
  ];

  return (
    <nav className="bottom-nav" aria-label="App sections">
      {items.map((item) => (
        <button
          className={activeTab === item.id ? 'active' : ''}
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
        >
          <span aria-hidden="true">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export default App;
