import type { MatchConfig, PlayerId } from "../game/types.js";

export interface ScoreEntry {
  readonly date: number;
  readonly score: number;
  readonly level: number;
  readonly faces: number;
  readonly mode: MatchConfig["mode"];
  readonly winner: PlayerId | null;
}

const KEY = "blockout.highScores";
const MAX_ENTRIES = 10;

export const loadHighScores = (): ScoreEntry[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is ScoreEntry => {
      if (typeof e !== "object" || e === null) return false;
      const obj = e as Record<string, unknown>;
      return (
        typeof obj.date === "number" &&
        typeof obj.score === "number" &&
        typeof obj.level === "number" &&
        typeof obj.faces === "number" &&
        (obj.mode === "1p" || obj.mode === "2p") &&
        (obj.winner === null || obj.winner === 1 || obj.winner === 2)
      );
    });
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
    // ignore storage failures
  }
  return updated;
};

export const isHighScore = (
  entry: ScoreEntry,
  existing: ScoreEntry[] = loadHighScores(),
): boolean => {
  if (existing.length < MAX_ENTRIES) return true;
  const lowest = existing[existing.length - 1];
  if (!lowest) return true;
  return entry.score > lowest.score;
};
