import type { Match, Prediction } from '../types';
import { MatchCard } from './MatchCard';

type MatchListProps = {
  matches: Match[];
  currentNickname: string;
  effectiveNow: Date;
  predictions: Prediction[];
  onSavePrediction: (matchId: string, homeScore: number, awayScore: number) => void;
};

export function MatchList(props: MatchListProps) {
  return (
    <section>
      <div className="section-heading">
        <h2>Matches</h2>
        <p className="muted">Predictions lock when kickoff time arrives.</p>
      </div>
      <div className="match-grid">
        {props.matches.map((match) => (
          <MatchCard key={match.id} match={match} {...props} />
        ))}
      </div>
    </section>
  );
}
