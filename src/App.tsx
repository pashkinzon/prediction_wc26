import { useEffect, useMemo, useState } from 'react';
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

function getStoredHardcodedPlayer() {
  const storedNickname = getCurrentUserNickname();
  return hardcodedPlayers.some((player) => player.nickname === storedNickname)
    ? storedNickname
    : '';
}

const teamMeta: Record<string, { flag: string; shortName: string }> = {
  Argentina: { flag: '🇦🇷', shortName: 'Argentina' },
  Brazil: { flag: '🇧🇷', shortName: 'Brazil' },
  Canada: { flag: '🇨🇦', shortName: 'Canada' },
  France: { flag: '🇫🇷', shortName: 'France' },
  Germany: { flag: '🇩🇪', shortName: 'Germany' },
  Ghana: { flag: '🇬🇭', shortName: 'Ghana' },
  Japan: { flag: '🇯🇵', shortName: 'Japan' },
  Mexico: { flag: '🇲🇽', shortName: 'Mexico' },
  Morocco: { flag: '🇲🇦', shortName: 'Morocco' },
  Portugal: { flag: '🇵🇹', shortName: 'Portugal' },
  Spain: { flag: '🇪🇸', shortName: 'Spain' },
  'United States': { flag: '🇺🇸', shortName: 'USA' },
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
  return teamMeta[team] ?? { flag: '🏳️', shortName: team };
}

function TeamBadge({ team, align = 'center' }: { team: string; align?: 'left' | 'center' | 'right' }) {
  const meta = getTeamMeta(team);

  return (
    <div className={`team-badge team-badge-${align}`}>
      <span className="flag-tile" aria-hidden="true">
        {meta.flag}
      </span>
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
        setSelectedMatchId((currentId) => currentId || gameData.matches[0].id);
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
          <div className="brand-mark" aria-hidden="true">
            🏆
          </div>
          <div>
            <strong>WC 2026</strong>
            <span>Score Predictor</span>
          </div>
          <button className="icon-button" type="button" aria-label="Menu">
            ☰
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
              loginError={loginError}
              loginNickname={loginNickname}
              loginPin={loginPin}
              isLoadingData={isLoadingData}
              matches={matches}
              players={hardcodedPlayers}
              predictions={visiblePredictions}
              reactions={reactions}
              selectedMatch={selectedMatch}
              syncError={syncError}
              onLogin={handleLogin}
              onLoginNicknameChange={setLoginNickname}
              onLoginPinChange={setLoginPin}
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
  loginError: string;
  loginNickname: string;
  loginPin: string;
  matches: Match[];
  players: typeof hardcodedPlayers;
  predictions: Prediction[];
  reactions: PredictionReaction[];
  selectedMatch: Match;
  syncError: string;
  onLogin: () => void;
  onLoginNicknameChange: (nickname: string) => void;
  onLoginPinChange: (pin: string) => void;
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
  loginError,
  loginNickname,
  loginPin,
  matches,
  players,
  predictions,
  reactions,
  selectedMatch,
  syncError,
  onLogin,
  onLoginNicknameChange,
  onLoginPinChange,
  onLogout,
  onOpenMatch,
  onSavePrediction,
  onToggleReaction,
}: MatchesScreenProps) {
  return (
    <div className="matches-layout">
      <section className="home-screen">
        <div className="welcome-block">
          <p className="eyebrow">Welcome back</p>
          <h1>{currentNickname ? currentNickname : 'Ready for kickoff?'}</h1>
          <p className="muted">Make your predictions before kickoff.</p>
        </div>

        {isLoadingData ? <p className="sync-note">Syncing Supabase data...</p> : null}
        {syncError ? <p className="sync-error">{syncError}</p> : null}

        <UserCard
          currentNickname={currentNickname}
          error={loginError}
          loginNickname={loginNickname}
          loginPin={loginPin}
          players={players}
          onLogin={onLogin}
          onLoginNicknameChange={onLoginNicknameChange}
          onLoginPinChange={onLoginPinChange}
          onLogout={onLogout}
        />

        <div className="section-title">
          <div>
            <h2>Upcoming Matches</h2>
            <p className="muted">Tap predict to open match details.</p>
          </div>
        </div>

        <div className="match-list">
          {matches.map((match) => (
            <CompactMatchCard
              key={match.id}
              effectiveNow={effectiveNow}
              isSelected={match.id === selectedMatch.id}
              match={match}
              onOpenMatch={onOpenMatch}
            />
          ))}
        </div>

        <LeaderboardPreview rows={leaderboardRows} />
      </section>

      <MatchDetailScreen
        currentNickname={currentNickname}
        currentUserRank={currentUserRank}
        effectiveNow={effectiveNow}
        match={selectedMatch}
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

function UserCard({
  currentNickname,
  error,
  loginNickname,
  loginPin,
  players,
  onLogin,
  onLoginNicknameChange,
  onLoginPinChange,
  onLogout,
}: {
  currentNickname: string;
  error: string;
  loginNickname: string;
  loginPin: string;
  players: typeof hardcodedPlayers;
  onLogin: () => void;
  onLoginNicknameChange: (nickname: string) => void;
  onLoginPinChange: (pin: string) => void;
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
      <PlayerPinForm
        buttonLabel="Switch"
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
  isSelected,
  match,
  onOpenMatch,
}: {
  effectiveNow: Date;
  isSelected: boolean;
  match: Match;
  onOpenMatch: (matchId: string) => void;
}) {
  const kickoff = new Date(match.kickoffTime);
  const isLocked =
    effectiveNow >= kickoff || match.status === 'live' || match.status === 'finished';

  return (
    <article className={`compact-match ${isSelected ? 'compact-match-active' : ''}`}>
      <TeamBadge team={match.homeTeam} />
      <div className="compact-center">
        <span>{getMatchGroup(match)}</span>
        <strong>vs</strong>
        <time dateTime={match.kickoffTime}>{formatKickoff(match.kickoffTime)}</time>
        <button type="button" onClick={() => onOpenMatch(match.id)}>
          {isLocked ? 'View' : 'Predict'}
        </button>
      </div>
      <TeamBadge team={match.awayTeam} />
    </article>
  );
}

function MatchDetailScreen({
  currentNickname,
  currentUserRank,
  effectiveNow,
  match,
  predictions,
  reactions,
  onSavePrediction,
  onToggleReaction,
}: {
  currentNickname: string;
  currentUserRank: number;
  effectiveNow: Date;
  match: Match;
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
                <span>One golden prediction per group. Gold doubles your points.</span>
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

  return (
    <section className="simple-screen">
      <h1>My Predictions</h1>
      <p className="muted">{currentNickname || 'Choose a nickname on Matches first.'}</p>
      <div className="prediction-summary-list">
        {myPredictions.length === 0 ? <p className="empty-state">No predictions saved yet.</p> : null}
        {myPredictions.map((prediction) => {
          const match = matches.find((item) => item.id === prediction.matchId);
          if (!match) return null;

          return (
            <button
              className="prediction-summary"
              key={`${prediction.matchId}-${prediction.userNickname}`}
              type="button"
              onClick={() => onOpenMatch(match.id)}
            >
              <span>
                {match.homeTeam} vs {match.awayTeam}
                {prediction.isGolden ? <b className="inline-gold">⭐ Gold</b> : null}
              </span>
              <strong>
                {prediction.homeScore} - {prediction.awayScore}
              </strong>
              <em>{calculatePoints(match, prediction)} pts</em>
            </button>
          );
        })}
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
