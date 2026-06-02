import type { Match, Prediction } from '../types';
import { calculatePoints, getOutcome } from '../utils/scoring';
import { PredictionForm } from './PredictionForm';

type MatchCardProps = {
  match: Match;
  currentNickname: string;
  effectiveNow: Date;
  predictions: Prediction[];
  onSavePrediction: (matchId: string, homeScore: number, awayScore: number) => void;
};

function formatScore(score?: { home: number; away: number }) {
  if (!score) return 'TBD';
  return `${score.home} : ${score.away}`;
}

export function MatchCard({
  match,
  currentNickname,
  effectiveNow,
  predictions,
  onSavePrediction,
}: MatchCardProps) {
  const kickoff = new Date(match.kickoffTime);
  const isLocked = effectiveNow >= kickoff;
  const hasStarted = isLocked || match.status === 'live' || match.status === 'finished';
  const userPrediction = predictions.find(
    (prediction) =>
      prediction.matchId === match.id &&
      prediction.userNickname === currentNickname,
  );
  const matchPredictions = predictions.filter(
    (prediction) => prediction.matchId === match.id,
  );
  const points = calculatePoints(match, userPrediction);

  return (
    <article className="match-card">
      <div className="match-top">
        <span className={`status status-${match.status}`}>{match.status}</span>
        <time dateTime={match.kickoffTime}>{kickoff.toLocaleString()}</time>
      </div>

      <div className="teams">
        <strong>{match.homeTeam}</strong>
        <span>vs</span>
        <strong>{match.awayTeam}</strong>
      </div>

      <div className="result-row">
        <span>Result</span>
        <strong>{formatScore(match.finalScore)}</strong>
      </div>

      {currentNickname ? (
        <>
          <PredictionForm
            key={`${currentNickname}-${match.id}-${userPrediction?.updatedAt ?? 'empty'}`}
            prediction={userPrediction}
            disabled={isLocked}
            onSave={(homeScore, awayScore) =>
              onSavePrediction(match.id, homeScore, awayScore)
            }
          />
          <div className="match-meta">
            <span>{isLocked ? 'Locked at kickoff' : 'Open for predictions'}</span>
            <strong>{points} pts</strong>
          </div>
        </>
      ) : (
        <p className="muted">Add or choose a nickname to predict.</p>
      )}

      <div className="other-predictions">
        <h3>Predictions</h3>
        {hasStarted ? (
          matchPredictions.length > 0 ? (
            <ul>
              {matchPredictions.map((prediction) => {
                const score = {
                  home: prediction.homeScore,
                  away: prediction.awayScore,
                };

                return (
                  <li key={`${prediction.matchId}-${prediction.userNickname}`}>
                    <span>{prediction.userNickname}</span>
                    <strong>
                      {prediction.homeScore} : {prediction.awayScore}
                    </strong>
                    <em>{getOutcome(score)}</em>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">No predictions saved yet.</p>
          )
        ) : (
          <p className="muted">Visible after kickoff.</p>
        )}
      </div>
    </article>
  );
}
