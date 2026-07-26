import type { MatchConfig, PlayerId } from "../game/types.js";

export interface ScoreEntry {
  readonly date: number;
  readonly score: number;
  readonly level: number;
  readonly faces: number;
  readonly mode: MatchConfig["mode"];
  readonly winner: PlayerId | null;
  readonly name: string;
}

const KEY = "blockout.highScores";
const MAX_ENTRIES = 10;
const DEFAULT_NAME = "Anonymous";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const isScoreEntry = (e: unknown): e is ScoreEntry => {
  if (!isRecord(e)) return false;
  return (
    typeof e.date === "number" &&
    typeof e.score === "number" &&
    typeof e.level === "number" &&
    typeof e.faces === "number" &&
    (e.mode === "1p" || e.mode === "2p") &&
    (e.winner === null || e.winner === 1 || e.winner === 2) &&
    typeof e.name === "string"
  );
};

export const loadHighScores = (): ScoreEntry[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isScoreEntry);
  } catch {
    return [];
  }
};

export const saveHighScore = (entry: ScoreEntry): ScoreEntry[] => {
  const scores = loadHighScores();
  const updated = [...scores, entry].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    void 0;
  }
  return updated;
};

export const isHighScore = (
  entry: ScoreEntry,
  existing: readonly ScoreEntry[] = loadHighScores(),
): boolean => {
  if (existing.length < MAX_ENTRIES) return true;
  const lowest = existing[existing.length - 1];
  if (!lowest) return true;
  return entry.score > lowest.score;
};

export { DEFAULT_NAME };
