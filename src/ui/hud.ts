import type { PlayerId } from "../game/types.js";
import type { EngineState } from "../game/engine.js";
import type { PieceDef } from "../game/types.js";
import { create, mount, setText, type UiElement } from "./dom.js";

export interface HudCallbacks {
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onPause: () => void;
}

const PREVIEW_SIZE = 64;
const PREVIEW_CELL = 12;

const drawPreview = (canvas: HTMLCanvasElement, piece: PieceDef): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  const cells = piece.cells;
  const maxX = Math.max(...cells.map((c) => c.x));
  const maxZ = Math.max(...cells.map((c) => c.z));
  const offsetX = (PREVIEW_SIZE - (maxX + 1) * PREVIEW_CELL) / 2;
  const offsetZ = (PREVIEW_SIZE - (maxZ + 1) * PREVIEW_CELL) / 2;
  const hex = `#${piece.color.toString(16).padStart(6, "0")}`;
  cells.forEach((c) => {
    const px = offsetX + c.x * PREVIEW_CELL;
    const py = offsetZ + c.z * PREVIEW_CELL;
    ctx.fillStyle = hex;
    ctx.fillRect(px, py, PREVIEW_CELL - 1, PREVIEW_CELL - 1);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, PREVIEW_CELL - 2, PREVIEW_CELL - 2);
  });
};

export class Hud implements UiElement {
  readonly el: HTMLElement;
  private readonly cleanup: () => void;
  private readonly callbacks: HudCallbacks;
  private readonly scoreEls: Map<PlayerId, HTMLElement>;
  private readonly levelEls: Map<PlayerId, HTMLElement>;
  private readonly facesEls: Map<PlayerId, HTMLElement>;
  private readonly previewCanvases: Map<PlayerId, HTMLCanvasElement>;
  private soundBtn: HTMLButtonElement | null = null;
  private musicBtn: HTMLButtonElement | null = null;

  constructor(players: readonly PlayerId[], callbacks: HudCallbacks) {
    this.callbacks = callbacks;
    this.scoreEls = new Map();
    this.levelEls = new Map();
    this.facesEls = new Map();
    this.previewCanvases = new Map();
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
      const nextLbl = create("div", "bo-hud-label");
      nextLbl.textContent = "Next";
      const canvas = create("canvas", "bo-preview");
      canvas.width = PREVIEW_SIZE;
      canvas.height = PREVIEW_SIZE;
      card.appendChild(scoreLbl);
      card.appendChild(scoreVal);
      card.appendChild(levelLbl);
      card.appendChild(levelVal);
      card.appendChild(facesLbl);
      card.appendChild(facesVal);
      card.appendChild(nextLbl);
      card.appendChild(canvas);
      this.el.appendChild(card);
      this.scoreEls.set(p, scoreVal);
      this.levelEls.set(p, levelVal);
      this.facesEls.set(p, facesVal);
      this.previewCanvases.set(p, canvas);
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
    const canvas = this.previewCanvases.get(player);
    if (scoreEl) setText(scoreEl, String(state.score));
    if (levelEl) setText(levelEl, String(state.level));
    if (facesEl) setText(facesEl, String(state.faces));
    if (canvas) drawPreview(canvas, state.next);
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
