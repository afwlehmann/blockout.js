import type { MatchConfig, PieceSet, Difficulty, PitConfig, PlayerId } from "../game/types.js";
import { create, mount, injectStyles, type UiElement } from "./dom.js";
import { KeyRemap } from "./keyRemap.js";
import { loadInputSettings, saveInputSettings } from "../input/input.js";

export interface MenuSelection {
  readonly config: MatchConfig;
  readonly crazyMode: boolean;
}

export type StartHandler = (selection: MenuSelection) => void;

interface MenuState {
  mode: "1p" | "2p";
  preset: "flat-fun" | "3d-mania" | "out-of-control" | "custom";
  set: PieceSet;
  difficulty: Difficulty;
  width: number;
  depth: number;
  height: number;
  startLevel: number;
  targetFaces: number;
  crazyMode: boolean;
}

const PRESETS: Record<string, { pit: PitConfig; set: PieceSet }> = {
  "flat-fun": { pit: { width: 5, depth: 5, height: 12 }, set: "flat" },
  "3d-mania": { pit: { width: 3, depth: 3, height: 10 }, set: "basic" },
  "out-of-control": { pit: { width: 5, depth: 5, height: 10 }, set: "extended" },
};

const defaultState = (): MenuState => ({
  mode: "1p",
  preset: "flat-fun",
  set: "flat",
  difficulty: "normal",
  width: 5,
  depth: 5,
  height: 12,
  startLevel: 1,
  targetFaces: 10,
  crazyMode: false,
});

const toConfig = (state: MenuState): MatchConfig => ({
  mode: state.mode,
  pit: { width: state.width, depth: state.depth, height: state.height },
  set: state.set,
  startLevel: state.startLevel,
  targetFaces: state.targetFaces,
  difficulty: state.difficulty,
});

export class Menu implements UiElement {
  readonly el: HTMLElement;
  private readonly cleanup: () => void;
  private state: MenuState;
  private startHandler: StartHandler | null = null;
  private remapPanel: KeyRemap | null = null;
  private remapPlayer: PlayerId = 1;
  private showControls = false;
  private readonly keyListener: (e: KeyboardEvent) => void;

  constructor() {
    injectStyles();
    this.state = defaultState();
    this.el = create("div", "bo-overlay");
    this.cleanup = mount(this.el);
    this.keyListener = (e: KeyboardEvent): void => {
      if (e.code === "Enter" && !this.remapPanel?.isListening) {
        e.preventDefault();
        this.start();
      }
    };
    window.addEventListener("keydown", this.keyListener);
    this.render();
  }

  onStart(handler: StartHandler): void {
    this.startHandler = handler;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.keyListener);
    if (this.remapPanel) this.remapPanel.dispose();
    this.cleanup();
  }

  private start(): void {
    if (this.startHandler) {
      this.startHandler({ config: toConfig(this.state), crazyMode: this.state.crazyMode });
    }
  }

  private render(): void {
    if (this.remapPanel) {
      this.remapPanel.dispose();
      this.remapPanel = null;
    }
    this.el.innerHTML = "";
    const panel = create("div", "bo-panel");
    panel.appendChild(this.title());
    panel.appendChild(this.section("Mode", this.modeButtons()));
    panel.appendChild(this.section("Preset", this.presetButtons()));
    if (this.state.preset === "custom") {
      panel.appendChild(this.section("Piece Set", this.setButtons()));
      panel.appendChild(this.section("Pit Size", this.pitControls()));
    }
    panel.appendChild(this.section("Difficulty", this.difficultyButtons()));
    panel.appendChild(this.section("Crazy Mode", this.crazyButtons()));
    panel.appendChild(this.controlsSection());
    panel.appendChild(this.startButton());
    this.el.appendChild(panel);
  }

  private title(): HTMLElement {
    const h1 = create("h1", "bo-title");
    h1.textContent = "blockout.js";
    const p = create("p", "bo-subtitle");
    p.textContent = "3D Tetris with split-screen 2-player mode";
    const frag = create("div");
    frag.appendChild(h1);
    frag.appendChild(p);
    return frag;
  }

  private section(label: string, content: HTMLElement): HTMLElement {
    const div = create("div", "bo-section");
    const lbl = create("div", "bo-section-label");
    lbl.textContent = label;
    div.appendChild(lbl);
    div.appendChild(content);
    return div;
  }

  private modeButtons(): HTMLElement {
    return this.optionGroup(
      ["1p", "2p"],
      this.state.mode,
      (val) => {
        this.state = { ...this.state, mode: val as "1p" | "2p" };
        this.render();
      },
      { "1p": "1 Player", "2p": "2 Players" },
    );
  }

  private presetButtons(): HTMLElement {
    return this.optionGroup(
      ["flat-fun", "3d-mania", "out-of-control", "custom"],
      this.state.preset,
      (val) => {
        const preset = PRESETS[val];
        if (preset) {
          this.state = {
            ...this.state,
            preset: val as MenuState["preset"],
            set: preset.set,
            width: preset.pit.width,
            depth: preset.pit.depth,
            height: preset.pit.height,
          };
        } else {
          this.state = { ...this.state, preset: "custom" };
        }
        this.render();
      },
      {
        "flat-fun": "Flat Fun",
        "3d-mania": "3D Mania",
        "out-of-control": "Out of Control",
        custom: "Custom",
      },
    );
  }

  private setButtons(): HTMLElement {
    return this.optionGroup(
      ["flat", "basic", "extended"],
      this.state.set,
      (val) => {
        this.state = { ...this.state, set: val as PieceSet };
        this.render();
      },
      { flat: "Flat", basic: "Basic", extended: "Extended" },
    );
  }

  private difficultyButtons(): HTMLElement {
    return this.optionGroup(
      ["easy", "normal", "hard"],
      this.state.difficulty,
      (val) => {
        this.state = { ...this.state, difficulty: val as Difficulty };
        this.render();
      },
      { easy: "Easy", normal: "Normal", hard: "Hard" },
    );
  }

  private pitControls(): HTMLElement {
    const wrap = create("div");
    const dims: {
      key: "width" | "depth" | "height";
      label: string;
      min: number;
      max: number;
    }[] = [
      { key: "width", label: "Width", min: 4, max: 7 },
      { key: "depth", label: "Depth", min: 4, max: 7 },
      { key: "height", label: "Height", min: 10, max: 18 },
    ];
    dims.forEach(({ key, label, min, max }) => {
      const row = create("div");
      row.style.cssText = "display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem";
      const lbl = create("span", "bo-section-label");
      lbl.style.marginBottom = "0";
      lbl.textContent = label;
      const input = create("input", "bo-btn");
      input.type = "number";
      input.min = String(min);
      input.max = String(max);
      input.value = String(this.state[key]);
      input.style.width = "70px";
      input.addEventListener("change", () => {
        const val = Math.max(min, Math.min(max, Number(input.value)));
        this.state = { ...this.state, [key]: val };
        input.value = String(val);
      });
      row.appendChild(lbl);
      row.appendChild(input);
      wrap.appendChild(row);
    });
    return wrap;
  }

  private crazyButtons(): HTMLElement {
    return this.optionGroup(
      ["off", "on"],
      this.state.crazyMode ? "on" : "off",
      (val) => {
        this.state = { ...this.state, crazyMode: val === "on" };
        this.render();
      },
      { off: "Off", on: "Crazy!" },
    );
  }

  private controlsSection(): HTMLElement {
    const wrap = create("div", "bo-section");
    const lbl = create("div", "bo-section-label");
    lbl.textContent = "Controls";
    wrap.appendChild(lbl);

    const toggleBtn = create("button", "bo-btn");
    toggleBtn.textContent = this.showControls ? "Hide Controls" : "Show Controls";
    toggleBtn.addEventListener("click", () => {
      this.showControls = !this.showControls;
      this.render();
    });
    wrap.appendChild(toggleBtn);

    if (this.showControls) {
      const settings = loadInputSettings();
      const tabs = create("div", "bo-tabs");
      ([1, 2] as const).forEach((p) => {
        const tab = create("button", "bo-tab");
        tab.textContent = `Player ${p === 1 ? "1" : "2"}`;
        if (p === this.remapPlayer) tab.classList.add("active");
        tab.addEventListener("click", () => {
          this.remapPlayer = p;
          this.render();
        });
        tabs.appendChild(tab);
      });
      wrap.appendChild(tabs);

      this.remapPanel = new KeyRemap(
        this.remapPlayer,
        settings.bindings[this.remapPlayer],
        (player, binding) => {
          const current = loadInputSettings();
          const updated = {
            ...current,
            bindings: { ...current.bindings, [player]: binding },
          };
          saveInputSettings(updated);
        },
      );
      wrap.appendChild(this.remapPanel.el);
    }

    return wrap;
  }

  private startButton(): HTMLElement {
    const btn = create("button", "bo-btn bo-btn-primary");
    btn.textContent = "Start Game";
    btn.addEventListener("click", () => {
      this.start();
    });
    return btn;
  }

  private optionGroup(
    options: string[],
    active: string,
    onSelect: (val: string) => void,
    labels: Record<string, string>,
  ): HTMLElement {
    const wrap = create("div", "bo-options");
    options.forEach((opt) => {
      const btn = create("button", "bo-btn");
      btn.textContent = labels[opt] ?? opt;
      if (opt === active) btn.classList.add("active");
      btn.addEventListener("click", () => {
        onSelect(opt);
      });
      wrap.appendChild(btn);
    });
    return wrap;
  }
}
