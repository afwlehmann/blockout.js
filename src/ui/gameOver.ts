import type { MatchConfig, PlayerId } from "../game/types.js";
import type { EngineState } from "../game/engine.js";
import type { MatchResult } from "../game/match.js";
import { create, mount, type UiElement } from "./dom.js";
import { saveHighScore, type ScoreEntry } from "./highScores.js";

export interface GameOverData {
  readonly mode: "1p" | "2p";
  readonly result: MatchResult | null;
  readonly states: Readonly<Record<1 | 2, EngineState>>;
  readonly config: MatchConfig;
  readonly highScores: readonly ScoreEntry[];
}

export type GameOverAction = "rematch" | "menu";

export class GameOverScreen implements UiElement {
  readonly el: HTMLElement;
  private readonly cleanup: () => void;
  private readonly actionHandler: (action: GameOverAction) => void;

  constructor(data: GameOverData, onAction: (action: GameOverAction) => void) {
    this.el = create("div", "bo-overlay");
    this.cleanup = mount(this.el);
    this.actionHandler = onAction;
    this.render(data);
  }

  dispose(): void {
    this.cleanup();
  }

  private render(data: GameOverData): void {
    const panel = create("div", "bo-panel");
    panel.style.textAlign = "center";

    if (data.mode === "2p" && data.result) {
      const winner = create("div", "bo-winner");
      if (data.result.winner === null) {
        winner.textContent = "Draw!";
      } else {
        winner.textContent = `Player ${data.result.winner === 1 ? "1" : "2"} wins!`;
      }
      panel.appendChild(winner);
      const reason = create("p", "bo-subtitle");
      reason.textContent = data.result.reason;
      panel.appendChild(reason);
    } else {
      const title = create("h1", "bo-title");
      title.textContent = "Game Over";
      panel.appendChild(title);
    }

    const states: readonly (readonly [1 | 2, EngineState])[] = [
      [1, data.states[1]],
      [2, data.states[2]],
    ];
    states.forEach(([player, state]) => {
      if (data.mode === "2p") {
        const lbl = create("div", "bo-result-label");
        lbl.textContent = `Player ${player === 1 ? "1" : "2"}`;
        panel.appendChild(lbl);
      }
      const score = create("div", "bo-result-score");
      score.textContent = String(state.score);
      panel.appendChild(score);
      panel.appendChild(this.statRow("Level", String(state.level)));
      panel.appendChild(this.statRow("Faces", String(state.faces)));
      panel.appendChild(this.statRow("Cubes", String(state.cubes)));
    });

    if (data.highScores.length > 0) {
      const hsTitle = create("div", "bo-result-label");
      hsTitle.textContent = "High Scores";
      hsTitle.style.marginTop = "1.5rem";
      panel.appendChild(hsTitle);
      data.highScores.slice(0, 5).forEach((entry, i) => {
        const row = create("div", "bo-result-row");
        const lbl = create("span", "bo-result-label");
        const modeTag = entry.mode === "1p" ? "1P" : "2P";
        lbl.textContent = `${String(i + 1)}. ${modeTag} ${String(entry.score)}`;
        const val = create("span", "bo-result-val");
        const date = new Date(entry.date);
        val.textContent = `${String(date.getMonth() + 1)}/${String(date.getDate())}`;
        row.appendChild(lbl);
        row.appendChild(val);
        panel.appendChild(row);
      });
    }

    const buttons = create("div", "bo-options bo-gameover-buttons");
    buttons.style.marginTop = "1.5rem";
    const rematch = create("button", "bo-btn bo-btn-primary");
    rematch.textContent = "Rematch";
    rematch.addEventListener("click", () => {
      this.actionHandler("rematch");
    });
    const menu = create("button", "bo-btn");
    menu.textContent = "Main Menu";
    menu.addEventListener("click", () => {
      this.actionHandler("menu");
    });
    buttons.appendChild(rematch);
    buttons.appendChild(menu);
    panel.appendChild(buttons);

    this.el.appendChild(panel);
  }

  private statRow(label: string, value: string): HTMLElement {
    const row = create("div", "bo-result-row");
    const lbl = create("span", "bo-result-label");
    lbl.textContent = label;
    const val = create("span", "bo-result-val");
    val.textContent = value;
    row.appendChild(lbl);
    row.appendChild(val);
    return row;
  }
}

export const recordScore = (
  state: EngineState,
  mode: MatchConfig["mode"],
  winner: PlayerId | null,
): ScoreEntry => {
  const entry: ScoreEntry = {
    date: Date.now(),
    score: state.score,
    level: state.level,
    faces: state.faces,
    mode,
    winner,
  };
  return saveHighScore(entry)[0] ?? entry;
};
