import type { MatchConfig } from "../game/types.js";
import type { EngineState } from "../game/engine.js";
import type { MatchResult } from "../game/match.js";
import { create, mount, type UiElement } from "./dom.js";

export interface GameOverData {
  readonly mode: "1p" | "2p";
  readonly result: MatchResult | null;
  readonly states: Readonly<Record<1 | 2, EngineState>>;
  readonly config: MatchConfig;
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

    const buttons = create("div", "bo-options");
    buttons.style.marginTop = "1.5rem";
    const rematch = create("button", "bo-btn bo-btn-primary");
    rematch.textContent = "Rematch";
    rematch.style.width = "auto";
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
