import type { Prediction, PredictionReaction } from '../types';

const PREDICTIONS_KEY = 'wc2026-predictions';
const REACTIONS_KEY = 'wc2026-reactions';
const CURRENT_USER_KEY = 'wc2026-current-user';
const TIME_OVERRIDE_KEY = 'wc2026-time-override';

function readJson<T>(key: string, fallback: T): T {
  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) return fallback;

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getPredictions(): Prediction[] {
  return readJson<Prediction[]>(PREDICTIONS_KEY, []);
}

export function savePrediction(prediction: Prediction) {
  const predictions = getPredictions();
  const nextPredictions = predictions.filter(
    (item) =>
      item.matchId !== prediction.matchId ||
      item.userNickname !== prediction.userNickname,
  );

  writeJson(PREDICTIONS_KEY, [...nextPredictions, prediction]);
}

export function savePredictions(predictions: Prediction[]) {
  writeJson(PREDICTIONS_KEY, predictions);
}

export function getReactions(): PredictionReaction[] {
  return readJson<PredictionReaction[]>(REACTIONS_KEY, []);
}

export function toggleReaction(reaction: PredictionReaction) {
  const reactions = getReactions();
  const existingReaction = reactions.find(
    (item) =>
      item.matchId === reaction.matchId &&
      item.predictionUserNickname === reaction.predictionUserNickname &&
      item.reactorNickname === reaction.reactorNickname &&
      item.reaction === reaction.reaction,
  );

  if (existingReaction) {
    const nextReactions = reactions.filter(
      (item) =>
        !(
          item.matchId === reaction.matchId &&
          item.predictionUserNickname === reaction.predictionUserNickname &&
          item.reactorNickname === reaction.reactorNickname &&
          item.reaction === reaction.reaction
        ),
    );
    writeJson(REACTIONS_KEY, nextReactions);
    return;
  }

  const nextReactions = reactions.filter(
    (item) =>
      !(
        item.matchId === reaction.matchId &&
        item.predictionUserNickname === reaction.predictionUserNickname &&
        item.reactorNickname === reaction.reactorNickname
      ),
  );
  writeJson(REACTIONS_KEY, [...nextReactions, reaction]);
}

export function getCurrentUserNickname(): string {
  return window.localStorage.getItem(CURRENT_USER_KEY) ?? '';
}

export function setCurrentUserNickname(nickname: string) {
  window.localStorage.setItem(CURRENT_USER_KEY, nickname);
}

export function getTimeOverride(): string {
  return window.localStorage.getItem(TIME_OVERRIDE_KEY) ?? '';
}

export function setTimeOverride(value: string) {
  if (value) {
    window.localStorage.setItem(TIME_OVERRIDE_KEY, value);
  } else {
    window.localStorage.removeItem(TIME_OVERRIDE_KEY);
  }
}
