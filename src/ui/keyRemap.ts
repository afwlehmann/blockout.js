import type { PlayerId } from "../game/types.js";
import type { KeyBinding } from "../input/keyboard.js";
import { create, type UiElement } from "./dom.js";

const ACTION_LABELS: readonly { key: keyof KeyBinding; label: string }[] = [
  { key: "moveLeft", label: "Move Left" },
  { key: "moveRight", label: "Move Right" },
  { key: "moveForward", label: "Move Forward" },
  { key: "moveBack", label: "Move Back" },
  { key: "rotateXPos", label: "Rotate X+" },
  { key: "rotateXNeg", label: "Rotate X-" },
  { key: "rotateYPos", label: "Rotate Y+" },
  { key: "rotateYNeg", label: "Rotate Y-" },
  { key: "rotateZPos", label: "Rotate Z+" },
  { key: "rotateZNeg", label: "Rotate Z-" },
  { key: "hardDrop", label: "Hard Drop" },
  { key: "softDrop", label: "Soft Drop" },
  { key: "pause", label: "Pause" },
  { key: "exitToMenu", label: "Exit to Menu" },
  { key: "cameraToggle", label: "Camera" },
  { key: "toggleSound", label: "Toggle SFX" },
  { key: "toggleMusic", label: "Toggle Music" },
  { key: "toggleGhost", label: "Toggle Ghost" },
];

const codeToLabel = (code: string): string => {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return code.slice(5);
  if (code === "ShiftLeft") return "L-Shift";
  if (code === "ShiftRight") return "R-Shift";
  if (code === "ControlLeft") return "L-Ctrl";
  if (code === "ControlRight") return "R-Ctrl";
  if (code === "Escape") return "Esc";
  if (code === "Space") return "Space";
  if (code === "Period") return ".";
  if (code === "Slash") return "/";
  return code;
};

const bindingToLabel = (codes: readonly string[]): string => {
  return codes.map(codeToLabel).join(", ");
};

export class KeyRemap implements UiElement {
  readonly el: HTMLElement;
  private readonly playerId: PlayerId;
  private binding: KeyBinding;
  private readonly onRebind: (player: PlayerId, binding: KeyBinding) => void;
  private listeningFor: keyof KeyBinding | null = null;
  private listeningBtn: HTMLButtonElement | null = null;
  private readonly keyListener: (e: KeyboardEvent) => void;

  constructor(
    playerId: PlayerId,
    binding: KeyBinding,
    onRebind: (player: PlayerId, binding: KeyBinding) => void,
  ) {
    this.playerId = playerId;
    this.binding = binding;
    this.onRebind = onRebind;
    this.el = create("div", "bo-remap");
    this.keyListener = (e: KeyboardEvent) => {
      this.handleKey(e);
    };
    this.render();
  }

  dispose(): void {
    this.stopListening();
  }

  get isListening(): boolean {
    return this.listeningFor !== null;
  }

  private render(): void {
    this.el.innerHTML = "";
    const title = create("div", "bo-section-label");
    title.textContent = `Player ${this.playerId === 1 ? "1" : "2"} Controls`;
    this.el.appendChild(title);

    const grid = create("div", "bo-remap-grid");
    ACTION_LABELS.forEach(({ key, label }) => {
      const row = create("div", "bo-remap-row");
      const lbl = create("span", "bo-remap-label");
      lbl.textContent = label;
      const btn = create("button", "bo-btn bo-remap-btn");
      btn.textContent = bindingToLabel(this.binding[key]);
      btn.addEventListener("click", () => {
        this.startListening(key, btn);
      });
      row.appendChild(lbl);
      row.appendChild(btn);
      grid.appendChild(row);
    });
    this.el.appendChild(grid);
  }

  private startListening(key: keyof KeyBinding, btn: HTMLButtonElement): void {
    this.stopListening();
    this.listeningFor = key;
    this.listeningBtn = btn;
    btn.textContent = "Press key…";
    btn.classList.add("active");
    window.addEventListener("keydown", this.keyListener, true);
  }

  private stopListening(): void {
    if (this.listeningBtn) {
      this.listeningBtn.classList.remove("active");
      this.listeningBtn = null;
    }
    this.listeningFor = null;
    window.removeEventListener("keydown", this.keyListener, true);
  }

  private handleKey(e: KeyboardEvent): void {
    if (!this.listeningFor || !this.listeningBtn) return;
    e.preventDefault();
    e.stopPropagation();
    const code = e.code;
    this.binding = { ...this.binding, [this.listeningFor]: [code] };
    this.listeningBtn.textContent = codeToLabel(code);
    this.stopListening();
    this.onRebind(this.playerId, this.binding);
  }
}
