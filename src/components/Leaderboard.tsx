import type { LeaderboardRow } from '../types';

type LeaderboardProps = {
  rows: LeaderboardRow[];
};

export function Leaderboard({ rows }: LeaderboardProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Leaderboard</h2>
        <p className="muted">Ranked by total points, then exact scores.</p>
      </div>
      {rows.length > 0 ? (
        <ol className="leaderboard">
          {rows.map((row) => (
            <li key={row.nickname}>
              <span>{row.nickname}</span>
              <strong>{row.totalPoints} pts</strong>
              <small>
                {row.exactScores} exact / {row.predictedMatches} picks
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">No predictions yet.</p>
      )}
    </section>
  );
}
