import type { PlayerId } from "../game/types.js";
import type { EngineState } from "../game/engine.js";
import { create, mount, setText, type UiElement } from "./dom.js";

export interface HudCallbacks {
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onPause: () => void;
}

export class Hud implements UiElement {
  readonly el: HTMLElement;
  private readonly cleanup: () => void;
  private readonly callbacks: HudCallbacks;
  private readonly scoreEls: Map<PlayerId, HTMLElement>;
  private readonly levelEls: Map<PlayerId, HTMLElement>;
  private readonly facesEls: Map<PlayerId, HTMLElement>;
  private soundBtn: HTMLButtonElement | null = null;
  private musicBtn: HTMLButtonElement | null = null;

  constructor(players: readonly PlayerId[], callbacks: HudCallbacks) {
    this.callbacks = callbacks;
    this.scoreEls = new Map();
    this.levelEls = new Map();
    this.facesEls = new Map();
    this.el = create("div", "bo-hud");
    this.cleanup = mount(this.el);
    this.render(players);
  }

  dispose(): void {
    this.cleanup();
  }

  private render(players: readonly PlayerId[]): void {
    this.el.innerHTML = "";
    players.forEach((p) => {
      const card = create("div", `bo-hud-player${p === 2 ? " right" : ""}`);
      const scoreLbl = create("div", "bo-hud-label");
      scoreLbl.textContent = "Score";
      const scoreVal = create("div", "bo-hud-value");
      scoreVal.textContent = "0";
      const levelLbl = create("div", "bo-hud-label");
      levelLbl.textContent = "Level";
      const levelVal = create("div", "bo-hud-value");
      levelVal.textContent = "1";
      const facesLbl = create("div", "bo-hud-label");
      facesLbl.textContent = "Faces";
      const facesVal = create("div", "bo-hud-value");
      facesVal.textContent = "0";
      card.appendChild(scoreLbl);
      card.appendChild(scoreVal);
      card.appendChild(levelLbl);
      card.appendChild(levelVal);
      card.appendChild(facesLbl);
      card.appendChild(facesVal);
      this.el.appendChild(card);
      this.scoreEls.set(p, scoreVal);
      this.levelEls.set(p, levelVal);
      this.facesEls.set(p, facesVal);
    });

    const center = create("div", "bo-hud-row");
    this.soundBtn = create("button", "bo-icon-btn");
    this.soundBtn.textContent = "🔊";
    this.soundBtn.title = "Toggle SFX (N)";
    this.soundBtn.addEventListener("click", () => {
      this.callbacks.onToggleSound();
    });
    this.musicBtn = create("button", "bo-icon-btn");
    this.musicBtn.textContent = "🎵";
    this.musicBtn.title = "Toggle Music (B)";
    this.musicBtn.addEventListener("click", () => {
      this.callbacks.onToggleMusic();
    });
    const pauseBtn = create("button", "bo-icon-btn");
    pauseBtn.textContent = "⏸";
    pauseBtn.title = "Pause (Esc)";
    pauseBtn.addEventListener("click", () => {
      this.callbacks.onPause();
    });
    center.appendChild(this.soundBtn);
    center.appendChild(this.musicBtn);
    center.appendChild(pauseBtn);
    this.el.appendChild(center);
  }

  updatePlayer(player: PlayerId, state: EngineState): void {
    const scoreEl = this.scoreEls.get(player);
    const levelEl = this.levelEls.get(player);
    const facesEl = this.facesEls.get(player);
    if (scoreEl) setText(scoreEl, String(state.score));
    if (levelEl) setText(levelEl, String(state.level));
    if (facesEl) setText(facesEl, String(state.faces));
  }

  setSoundEnabled(enabled: boolean): void {
    if (this.soundBtn) {
      this.soundBtn.textContent = enabled ? "🔊" : "🔇";
      this.soundBtn.classList.toggle("off", !enabled);
    }
  }

  setMusicEnabled(enabled: boolean): void {
    if (this.musicBtn) {
      this.musicBtn.textContent = enabled ? "🎵" : "🚫";
      this.musicBtn.classList.toggle("off", !enabled);
    }
  }
}
