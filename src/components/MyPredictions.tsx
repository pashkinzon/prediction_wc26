import type { Match, Prediction } from '../types';
import { calculatePoints } from '../utils/scoring';

type MyPredictionsProps = {
  currentNickname: string;
  matches: Match[];
  predictions: Prediction[];
};

export function MyPredictions({
  currentNickname,
  matches,
  predictions,
}: MyPredictionsProps) {
  const myPredictions = predictions.filter(
    (prediction) => prediction.userNickname === currentNickname,
  );

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>My predictions</h2>
        <p className="muted">{currentNickname || 'Choose a nickname first'}</p>
      </div>
      {myPredictions.length > 0 ? (
        <ul className="prediction-list">
          {myPredictions.map((prediction) => {
            const match = matches.find((item) => item.id === prediction.matchId);
            if (!match) return null;

            return (
              <li key={`${prediction.matchId}-${prediction.userNickname}`}>
                <span>
                  {match.homeTeam} vs {match.awayTeam}
                </span>
                <strong>
                  {prediction.homeScore} : {prediction.awayScore}
                </strong>
                <small>{calculatePoints(match, prediction)} pts</small>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">No predictions saved for this user.</p>
      )}
    </section>
  );
}
