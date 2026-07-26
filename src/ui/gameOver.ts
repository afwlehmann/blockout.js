import type { MatchConfig, PlayerId } from "../game/types.js";
import type { EngineState } from "../game/engine.js";
import type { MatchResult } from "../game/match.js";
import { create, mount, type UiElement } from "./dom.js";
import { isHighScore, type ScoreEntry } from "./highScores.js";

export interface GameOverData {
  readonly mode: "1p" | "2p";
  readonly result: MatchResult | null;
  readonly states: Readonly<Record<1 | 2, EngineState>>;
  readonly config: MatchConfig;
  readonly highScores: readonly ScoreEntry[];
}

export type GameOverAction = "rematch" | "menu";

interface PlayerScoreInfo {
  readonly player: 1 | 2;
  readonly state: EngineState;
  readonly qualifies: boolean;
  readonly name: string;
}

export class GameOverScreen implements UiElement {
  readonly el: HTMLElement;
  private readonly cleanup: () => void;
  private readonly actionHandler: (action: GameOverAction) => void;
  private readonly saveHandler: (player: 1 | 2, name: string) => void;
  private readonly playerScores: readonly PlayerScoreInfo[];
  private readonly highScores: readonly ScoreEntry[];
  private readonly names: Map<PlayerId, string> = new Map<PlayerId, string>();

  constructor(
    data: GameOverData,
    onAction: (action: GameOverAction) => void,
    onSave: (player: 1 | 2, name: string) => void,
  ) {
    this.el = create("div", "bo-overlay");
    this.cleanup = mount(this.el);
    this.actionHandler = onAction;
    this.saveHandler = onSave;
    this.highScores = data.highScores;

    const players: readonly (1 | 2)[] = data.mode === "2p" ? [1, 2] : [1];
    this.playerScores = players.map((p) => {
      const state = data.states[p];
      const entry: ScoreEntry = {
        date: Date.now(),
        score: state.score,
        level: state.level,
        faces: state.faces,
        mode: data.mode,
        winner: data.result?.winner ?? null,
        name: "",
      };
      return {
        player: p,
        state,
        qualifies: isHighScore(entry, data.highScores),
        name: "",
      };
    });

    this.render(data);
  }

  dispose(): void {
    this.cleanup();
  }

  private render(data: GameOverData): void {
    const panel = create("div", "bo-panel bo-gameover-panel");
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

    this.playerScores.forEach((info) => {
      if (data.mode === "2p") {
        const lbl = create("div", "bo-result-label");
        lbl.textContent = `Player ${info.player === 1 ? "1" : "2"}`;
        panel.appendChild(lbl);
      }
      const score = create("div", "bo-result-score");
      score.textContent = String(info.state.score);
      panel.appendChild(score);

      const statGrid = create("div", "bo-stat-grid");
      statGrid.appendChild(this.statCell("Level", String(info.state.level)));
      statGrid.appendChild(this.statCell("Faces", String(info.state.faces)));
      statGrid.appendChild(this.statCell("Cubes", String(info.state.cubes)));
      panel.appendChild(statGrid);

      if (info.qualifies) {
        const nameRow = create("div", "bo-name-row");
        const input = create("input", "bo-name-input");
        input.type = "text";
        input.maxLength = 12;
        input.placeholder = "Enter your name";
        input.value = info.name;
        const saveBtn = create("button", "bo-btn bo-btn-primary bo-name-save");
        saveBtn.textContent = "Save";
        saveBtn.addEventListener("click", () => {
          const name = input.value.trim();
          this.setPlayerName(info.player, name || "Anonymous");
          this.saveHandler(info.player, name || "Anonymous");
          saveBtn.disabled = true;
          input.disabled = true;
          saveBtn.textContent = "Saved!";
        });
        nameRow.appendChild(input);
        nameRow.appendChild(saveBtn);
        panel.appendChild(nameRow);
      }
    });

    const hsSection = create("div", "bo-hs-section");
    const hsTitle = create("div", "bo-result-label");
    hsTitle.textContent = "High Scores";
    hsSection.appendChild(hsTitle);
    const hsList = create("div", "bo-hs-list");
    this.highScores.slice(0, 10).forEach((entry, i) => {
      const row = create("div", "bo-hs-row");
      const rank = create("span", "bo-hs-rank");
      rank.textContent = `${String(i + 1)}.`;
      const name = create("span", "bo-hs-name");
      name.textContent = entry.name;
      const modeTag = entry.mode === "1p" ? "1P" : "2P";
      const score = create("span", "bo-hs-score");
      score.textContent = `${modeTag} ${String(entry.score)}`;
      row.appendChild(rank);
      row.appendChild(name);
      row.appendChild(score);
      hsList.appendChild(row);
    });
    hsSection.appendChild(hsList);
    panel.appendChild(hsSection);

    const buttons = create("div", "bo-options bo-gameover-buttons");
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

  private setPlayerName(player: 1 | 2, name: string): void {
    this.names.set(player, name);
  }

  private statCell(label: string, value: string): HTMLElement {
    const cell = create("div", "bo-stat-cell");
    const lbl = create("div", "bo-stat-cell-label");
    lbl.textContent = label;
    const val = create("div", "bo-stat-cell-value");
    val.textContent = value;
    cell.appendChild(lbl);
    cell.appendChild(val);
    return cell;
  }
}

export const createScoreEntry = (
  state: EngineState,
  mode: MatchConfig["mode"],
  winner: PlayerId | null,
  name: string,
): ScoreEntry => ({
  date: Date.now(),
  score: state.score,
  level: state.level,
  faces: state.faces,
  mode,
  winner,
  name,
});
