import type { PlayerId } from "../game/types.js";
import type { PlayerAction, Axis, Direction } from "../game/engine.js";

export type GameAction =
  | PlayerAction
  | { readonly kind: "cameraToggle" }
  | { readonly kind: "toggleSound" }
  | { readonly kind: "toggleMusic" }
  | { readonly kind: "toggleGhost" };

export type ActionHandler = (action: GameAction) => void;

export interface KeyBinding {
  readonly moveLeft: string;
  readonly moveRight: string;
  readonly moveForward: string;
  readonly moveBack: string;
  readonly rotateXPos: string;
  readonly rotateXNeg: string;
  readonly rotateYPos: string;
  readonly rotateYNeg: string;
  readonly rotateZPos: string;
  readonly rotateZNeg: string;
  readonly hardDrop: string;
  readonly softDrop: string;
  readonly pause: string;
  readonly cameraToggle: string;
  readonly toggleSound: string;
  readonly toggleMusic: string;
  readonly toggleGhost: string;
}

export const PLAYER1_LAYOUT: KeyBinding = {
  moveLeft: "KeyA",
  moveRight: "KeyD",
  moveForward: "KeyW",
  moveBack: "KeyS",
  rotateXPos: "KeyQ",
  rotateXNeg: "KeyE",
  rotateYPos: "Digit1",
  rotateYNeg: "Digit3",
  rotateZPos: "KeyZ",
  rotateZNeg: "KeyC",
  hardDrop: "ShiftLeft",
  softDrop: "ControlLeft",
  pause: "Escape",
  cameraToggle: "KeyR",
  toggleSound: "KeyN",
  toggleMusic: "KeyB",
  toggleGhost: "KeyH",
};

export const PLAYER2_LAYOUT: KeyBinding = {
  moveLeft: "ArrowLeft",
  moveRight: "ArrowRight",
  moveForward: "ArrowUp",
  moveBack: "ArrowDown",
  rotateXPos: "KeyU",
  rotateXNeg: "KeyO",
  rotateYPos: "Digit7",
  rotateYNeg: "Digit9",
  rotateZPos: "KeyM",
  rotateZNeg: "Period",
  hardDrop: "ShiftRight",
  softDrop: "ControlRight",
  pause: "Escape",
  cameraToggle: "Slash",
  toggleSound: "KeyN",
  toggleMusic: "KeyB",
  toggleGhost: "KeyH",
};

export const SINGLE_PLAYER_LAYOUT: KeyBinding = PLAYER2_LAYOUT;

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
  switch (code) {
    case binding.moveLeft:
      return moveAction(-1, 0);
    case binding.moveRight:
      return moveAction(1, 0);
    case binding.moveForward:
      return moveAction(0, -1);
    case binding.moveBack:
      return moveAction(0, 1);
    case binding.rotateXPos:
      return rotateAction("x", 1);
    case binding.rotateXNeg:
      return rotateAction("x", -1);
    case binding.rotateYPos:
      return rotateAction("y", 1);
    case binding.rotateYNeg:
      return rotateAction("y", -1);
    case binding.rotateZPos:
      return rotateAction("z", 1);
    case binding.rotateZNeg:
      return rotateAction("z", -1);
    case binding.hardDrop:
      return { kind: "hardDrop" };
    case binding.softDrop:
      return { kind: "softDrop" };
    case binding.pause:
      return { kind: "pause" };
    case binding.cameraToggle:
      return { kind: "cameraToggle" };
    case binding.toggleSound:
      return { kind: "toggleSound" };
    case binding.toggleMusic:
      return { kind: "toggleMusic" };
    case binding.toggleGhost:
      return { kind: "toggleGhost" };
    default:
      return null;
  }
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
      action.kind === "pause"
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
