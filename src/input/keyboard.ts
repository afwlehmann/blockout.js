import type { PlayerId } from "../game/types.js";
import type { PlayerAction, Axis, Direction } from "../game/engine.js";

export type GameAction =
  | PlayerAction
  | { readonly kind: "cameraToggle" }
  | { readonly kind: "toggleSound" }
  | { readonly kind: "toggleMusic" }
  | { readonly kind: "toggleGhost" }
  | { readonly kind: "exitToMenu" };

export type ActionHandler = (action: GameAction) => void;

export interface KeyBinding {
  readonly moveLeft: readonly string[];
  readonly moveRight: readonly string[];
  readonly moveForward: readonly string[];
  readonly moveBack: readonly string[];
  readonly rotateXPos: readonly string[];
  readonly rotateXNeg: readonly string[];
  readonly rotateYPos: readonly string[];
  readonly rotateYNeg: readonly string[];
  readonly rotateZPos: readonly string[];
  readonly rotateZNeg: readonly string[];
  readonly hardDrop: readonly string[];
  readonly softDrop: readonly string[];
  readonly pause: readonly string[];
  readonly exitToMenu: readonly string[];
  readonly cameraToggle: readonly string[];
  readonly toggleSound: readonly string[];
  readonly toggleMusic: readonly string[];
  readonly toggleGhost: readonly string[];
}

export const PLAYER1_LAYOUT: KeyBinding = {
  moveLeft: ["KeyH", "ArrowLeft"],
  moveRight: ["KeyL", "ArrowRight"],
  moveForward: ["KeyK", "ArrowUp"],
  moveBack: ["KeyJ", "ArrowDown"],
  rotateXNeg: ["KeyQ"],
  rotateXPos: ["KeyA"],
  rotateYNeg: ["KeyW"],
  rotateYPos: ["KeyS"],
  rotateZNeg: ["KeyE"],
  rotateZPos: ["KeyD"],
  hardDrop: ["Space"],
  softDrop: ["ShiftLeft"],
  pause: ["KeyP"],
  exitToMenu: ["Escape"],
  cameraToggle: ["KeyC"],
  toggleSound: ["KeyO"],
  toggleMusic: ["KeyM"],
  toggleGhost: ["KeyG"],
};

export const PLAYER2_LAYOUT: KeyBinding = {
  moveLeft: ["ArrowLeft"],
  moveRight: ["ArrowRight"],
  moveForward: ["ArrowUp"],
  moveBack: ["ArrowDown"],
  rotateXPos: ["Numpad4"],
  rotateXNeg: ["Numpad7"],
  rotateYPos: ["Numpad5"],
  rotateYNeg: ["Numpad8"],
  rotateZPos: ["Numpad6"],
  rotateZNeg: ["Numpad9"],
  hardDrop: ["Numpad0"],
  softDrop: ["NumpadEnter"],
  pause: ["KeyP"],
  exitToMenu: ["Escape"],
  cameraToggle: ["NumpadDecimal"],
  toggleSound: ["KeyN"],
  toggleMusic: ["KeyM"],
  toggleGhost: ["KeyH"],
};

const moveAction = (dx: number, dz: number): PlayerAction => ({
  kind: "move",
  dx,
  dz,
});

const rotateAction = (axis: Axis, dir: Direction): PlayerAction => ({
  kind: "rotate",
  axis,
  dir,
});

const lookup = (binding: KeyBinding, code: string): GameAction | null => {
  if (binding.moveLeft.includes(code)) return moveAction(-1, 0);
  if (binding.moveRight.includes(code)) return moveAction(1, 0);
  if (binding.moveForward.includes(code)) return moveAction(0, -1);
  if (binding.moveBack.includes(code)) return moveAction(0, 1);
  if (binding.rotateXPos.includes(code)) return rotateAction("x", 1);
  if (binding.rotateXNeg.includes(code)) return rotateAction("x", -1);
  if (binding.rotateYPos.includes(code)) return rotateAction("y", 1);
  if (binding.rotateYNeg.includes(code)) return rotateAction("y", -1);
  if (binding.rotateZPos.includes(code)) return rotateAction("z", 1);
  if (binding.rotateZNeg.includes(code)) return rotateAction("z", -1);
  if (binding.hardDrop.includes(code)) return { kind: "hardDrop" };
  if (binding.softDrop.includes(code)) return { kind: "softDrop" };
  if (binding.pause.includes(code)) return { kind: "pause" };
  if (binding.exitToMenu.includes(code)) return { kind: "exitToMenu" };
  if (binding.cameraToggle.includes(code)) return { kind: "cameraToggle" };
  if (binding.toggleSound.includes(code)) return { kind: "toggleSound" };
  if (binding.toggleMusic.includes(code)) return { kind: "toggleMusic" };
  if (binding.toggleGhost.includes(code)) return { kind: "toggleGhost" };
  return null;
};

export class KeyboardInput {
  private bindings: Readonly<Record<PlayerId, KeyBinding>>;
  private readonly handlers: Map<PlayerId, ActionHandler>;
  private readonly globalHandlers: ActionHandler[];
  private readonly keyDownListener: (e: KeyboardEvent) => void;
  private readonly keyUpListener: (e: KeyboardEvent) => void;
  private readonly heldKeys: Set<string>;
  private repeatIntervalMs: number;
  private repeatDelayMs: number;
  private repeatTimers: Map<string, number>;

  constructor(bindings: Readonly<Record<PlayerId, KeyBinding>>) {
    this.bindings = bindings;
    this.handlers = new Map();
    this.globalHandlers = [];
    this.heldKeys = new Set();
    this.repeatIntervalMs = 80;
    this.repeatDelayMs = 180;
    this.repeatTimers = new Map();

    this.keyDownListener = (e: KeyboardEvent) => {
      this.handleKeyDown(e);
    };
    this.keyUpListener = (e: KeyboardEvent) => {
      this.handleKeyUp(e);
    };
  }

  attach(): () => void {
    window.addEventListener("keydown", this.keyDownListener);
    window.addEventListener("keyup", this.keyUpListener);
    return () => {
      window.removeEventListener("keydown", this.keyDownListener);
      window.removeEventListener("keyup", this.keyUpListener);
      this.repeatTimers.forEach((t) => {
        window.clearTimeout(t);
      });
      this.repeatTimers.clear();
      this.heldKeys.clear();
    };
  }

  onAction(player: PlayerId, handler: ActionHandler): void {
    this.handlers.set(player, handler);
  }

  onGlobalAction(handler: ActionHandler): void {
    this.globalHandlers.push(handler);
  }

  setBinding(player: PlayerId, binding: KeyBinding): void {
    this.bindings = { ...this.bindings, [player]: binding };
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    const code = e.code;
    if (this.heldKeys.has(code)) {
      e.preventDefault();
      return;
    }
    this.heldKeys.add(code);

    const matchedPlayers: { player: PlayerId; action: GameAction }[] = [];
    const globalActions: GameAction[] = [];

    ([1, 2] as const).forEach((player) => {
      const binding = this.bindings[player];
      const action = lookup(binding, code);
      if (!action) return;
      if (this.isGlobalAction(action)) {
        globalActions.push(action);
      } else {
        matchedPlayers.push({ player, action });
      }
    });

    if (matchedPlayers.length === 0 && globalActions.length === 0) return;
    e.preventDefault();

    matchedPlayers.forEach(({ player, action }) => {
      this.dispatch(player, action);
      if (this.shouldRepeat(action)) {
        const delay = window.setTimeout(() => {
          this.startRepeat(player, code, action);
        }, this.repeatDelayMs);
        this.repeatTimers.set(code, delay);
      }
    });

    const globalAction = globalActions[0];
    if (globalAction) {
      this.dispatchGlobal(globalAction);
    }
  }

  private isGlobalAction(action: GameAction): boolean {
    return (
      action.kind === "cameraToggle" ||
      action.kind === "toggleSound" ||
      action.kind === "toggleMusic" ||
      action.kind === "toggleGhost" ||
      action.kind === "pause" ||
      action.kind === "exitToMenu"
    );
  }

  private dispatchGlobal(action: GameAction): void {
    this.globalHandlers.forEach((h) => {
      h(action);
    });
  }

  private startRepeat(player: PlayerId, code: string, action: GameAction): void {
    if (!this.heldKeys.has(code)) return;
    this.dispatch(player, action);
    const interval = window.setTimeout(() => {
      this.startRepeat(player, code, action);
    }, this.repeatIntervalMs);
    this.repeatTimers.set(code, interval);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.heldKeys.delete(e.code);
    const timer = this.repeatTimers.get(e.code);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.repeatTimers.delete(e.code);
    }
  }

  private shouldRepeat(action: GameAction): boolean {
    return action.kind === "move" || action.kind === "softDrop";
  }

  private dispatch(player: PlayerId, action: GameAction): void {
    const handler = this.handlers.get(player);
    if (handler) {
      handler(action);
    }
  }
}

const STORAGE_KEY = "blockoutjs.settings";

export interface InputSettings {
  readonly bindings: Readonly<Record<PlayerId, KeyBinding>>;
}

export const defaultSettings = (): InputSettings => ({
  bindings: {
    1: PLAYER1_LAYOUT,
    2: PLAYER2_LAYOUT,
  },
});

export const loadSettings = (): InputSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<InputSettings>;
    const defaults = defaultSettings();
    if (!parsed.bindings) return defaults;
    return {
      bindings: {
        1: { ...defaults.bindings[1], ...parsed.bindings[1] },
        2: { ...defaults.bindings[2], ...parsed.bindings[2] },
      },
    };
  } catch {
    return defaultSettings();
  }
};

export const saveSettings = (settings: InputSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage failures
  }
};
