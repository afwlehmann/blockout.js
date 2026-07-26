import type { PlayerId } from "../game/types.js";
import {
  KeyboardInput,
  loadSettings,
  saveSettings,
  type KeyBinding,
  type GameAction,
  type ActionHandler,
  type InputSettings,
  SINGLE_PLAYER_LAYOUT,
  PLAYER2_LAYOUT,
} from "./keyboard.js";

export type { GameAction, ActionHandler, KeyBinding, InputSettings };
export { PLAYER1_LAYOUT, PLAYER2_LAYOUT, SINGLE_PLAYER_LAYOUT } from "./keyboard.js";

export class InputSource {
  private readonly keyboard: KeyboardInput;

  private constructor(keyboard: KeyboardInput) {
    this.keyboard = keyboard;
  }

  static create(settings: InputSettings): InputSource {
    const keyboard = new KeyboardInput(settings.bindings);
    keyboard.attach();
    return new InputSource(keyboard);
  }

  static createSinglePlayer(): InputSource {
    const settings: InputSettings = {
      bindings: { 1: SINGLE_PLAYER_LAYOUT, 2: PLAYER2_LAYOUT },
    };
    return InputSource.create(settings);
  }

  onAction(player: PlayerId, handler: ActionHandler): void {
    this.keyboard.onAction(player, handler);
  }

  onGlobalAction(handler: ActionHandler): void {
    this.keyboard.onGlobalAction(handler);
  }

  rebind(player: PlayerId, binding: KeyBinding): void {
    this.keyboard.setBinding(player, binding);
    const settings = loadSettings();
    saveSettings({ ...settings, bindings: { ...settings.bindings, [player]: binding } });
  }
}

export const loadInputSettings = loadSettings;
export const saveInputSettings = saveSettings;
