import type { FormEvent } from 'react';
import type { Prediction } from '../types';

type PredictionFormProps = {
  prediction?: Prediction;
  disabled: boolean;
  onSave: (homeScore: number, awayScore: number) => void;
};

export function PredictionForm({
  prediction,
  disabled,
  onSave,
}: PredictionFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const homeScore = Number(formData.get('homeScore'));
    const awayScore = Number(formData.get('awayScore'));
    onSave(homeScore, awayScore);
  }

  return (
    <form className="prediction-form" onSubmit={handleSubmit}>
      <input
        aria-label="Home score"
        name="homeScore"
        type="number"
        min="0"
        max="30"
        defaultValue={prediction?.homeScore ?? ''}
        disabled={disabled}
        required
      />
      <span>:</span>
      <input
        aria-label="Away score"
        name="awayScore"
        type="number"
        min="0"
        max="30"
        defaultValue={prediction?.awayScore ?? ''}
        disabled={disabled}
        required
      />
      <button type="submit" disabled={disabled}>
        Save
      </button>
    </form>
  );
}
