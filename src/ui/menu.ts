import type { MatchConfig, PieceSet, Difficulty, PitConfig, PlayerId } from "../game/types.js";
import { create, mount, injectStyles, type UiElement } from "./dom.js";
import { KeyRemap, GLOBAL_ACTIONS, bindingToLabel, codeToLabel } from "./keyRemap.js";
import { loadInputSettings, saveInputSettings, type KeyBinding } from "../input/input.js";
import { loadHighScores, type ScoreEntry } from "./highScores.js";

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
  private remapPanels: readonly KeyRemap[] = [];
  private remapPlayer: PlayerId = 1;
  private showControls = false;
  private showHighScores = false;
  private readonly keyListener: (e: KeyboardEvent) => void;
  private focusLabel: string | null = null;

  constructor() {
    injectStyles();
    this.state = defaultState();
    this.el = create("div", "bo-overlay");
    this.cleanup = mount(this.el);
    this.keyListener = (e: KeyboardEvent): void => {
      if (this.remapPanels.some((p) => p.isListening)) return;
      if (e.code === "Enter" || e.code === "Space") {
        const focused = document.activeElement;
        if (focused instanceof HTMLButtonElement && this.el.contains(focused)) {
          e.preventDefault();
          focused.click();
        } else if (e.code === "Enter") {
          e.preventDefault();
          this.start();
        }
      }
    };
    window.addEventListener("keydown", this.keyListener);
    this.el.addEventListener("mousedown", (e) => {
      if (e.target instanceof HTMLButtonElement) e.preventDefault();
    });
    this.render();
  }

  onStart(handler: StartHandler): void {
    this.startHandler = handler;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.keyListener);
    this.remapPanels.forEach((p) => {
      p.dispose();
    });
    this.cleanup();
  }

  private start(): void {
    if (this.startHandler) {
      this.startHandler({ config: toConfig(this.state), crazyMode: this.state.crazyMode });
    }
  }

  private render(): void {
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement && this.el.contains(active)) {
      this.focusLabel = active.textContent;
    }
    this.remapPanels.forEach((p) => {
      p.dispose();
    });
    this.remapPanels = [];
    this.el.innerHTML = "";
    const panel = create("div", "bo-panel");

    if (this.showHighScores) {
      panel.appendChild(this.highScoresContent());
      this.el.appendChild(panel);
      if (this.focusLabel) {
        const btn = Array.from(panel.querySelectorAll("button")).find(
          (b) => b.textContent === this.focusLabel,
        );
        if (btn) btn.focus();
        this.focusLabel = null;
      }
      return;
    }

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
    panel.appendChild(this.startButtonRow());
    this.el.appendChild(panel);

    if (this.showControls) {
      this.el.appendChild(this.controlsModal());
    }

    const credit = create("div", "bo-credit");
    credit.textContent = "2026 Alexander Lehmann";
    this.el.appendChild(credit);
    if (this.focusLabel) {
      const btn = Array.from(panel.querySelectorAll("button")).find(
        (b) => b.textContent === this.focusLabel,
      );
      if (btn) btn.focus();
      this.focusLabel = null;
    }
  }

  private title(): HTMLElement {
    const h1 = create("h1", "bo-title");
    h1.textContent = "blockout.js";
    const p = create("p", "bo-subtitle");
    p.textContent = "A tribute to Blockout (1989) by Michael Kosh — the original 3D Tetris";
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
        this.state = {
          ...this.state,
          mode: val as "1p" | "2p",
          crazyMode: val === "2p" ? false : this.state.crazyMode,
        };
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
      this.state.mode === "2p",
    );
  }

  private controlsSection(): HTMLElement {
    const wrap = create("div", "bo-section");
    const lbl = create("div", "bo-section-label");
    lbl.textContent = "Controls";
    wrap.appendChild(lbl);

    const toggleBtn = create("button", "bo-btn");
    toggleBtn.textContent = "Show Controls";
    toggleBtn.addEventListener("click", () => {
      this.showControls = true;
      this.render();
    });
    wrap.appendChild(toggleBtn);
    return wrap;
  }

  private controlsModal(): HTMLElement {
    const overlay = create("div", "bo-overlay");
    overlay.style.background = "rgba(1, 1, 10, 0.6)";
    const panel = create("div", "bo-panel");
    panel.style.maxWidth = "900px";
    panel.style.maxHeight = "85vh";
    panel.style.overflowY = "auto";

    const title = create("h1", "bo-title");
    title.textContent = "Controls";
    title.style.fontSize = "1.8rem";
    panel.appendChild(title);

    const initialSettings = loadInputSettings();
    const saveBinding = (player: PlayerId, binding: KeyBinding): void => {
      const current = loadInputSettings();
      const updated = {
        ...current,
        bindings: { ...current.bindings, [player]: binding },
      };
      saveInputSettings(updated);
    };

    const grid = create("div", "bo-remap-grid-2col");
    const panels: KeyRemap[] = [];
    ([1, 2] as const).forEach((p) => {
      const remap = new KeyRemap(p, initialSettings.bindings[p], saveBinding);
      panels.push(remap);
      grid.appendChild(remap.el);
    });
    this.remapPanels = panels;
    panel.appendChild(grid);

    const globalSection = create("div", "bo-section");
    globalSection.style.marginTop = "1.5rem";
    const globalLbl = create("div", "bo-section-label");
    globalLbl.textContent = "Global Controls";
    globalSection.appendChild(globalLbl);
    const globalGrid = create("div", "bo-remap-grid");
    globalGrid.style.width = "calc(50% - 0.75rem)";
    globalGrid.style.maxWidth = "420px";
    GLOBAL_ACTIONS.forEach(({ key, label }) => {
      const row = create("div", "bo-remap-row");
      const lbl = create("span", "bo-remap-label");
      lbl.textContent = label;
      const btn = create("button", "bo-btn bo-remap-btn");
      btn.textContent = bindingToLabel(initialSettings.bindings[1][key]);
      btn.addEventListener("click", () => {
        btn.textContent = "Press key…";
        btn.classList.add("active");
        const handler = (e: KeyboardEvent): void => {
          e.preventDefault();
          e.stopPropagation();
          window.removeEventListener("keydown", handler, true);
          btn.classList.remove("active");
          const code = e.code;
          const b1 = { ...initialSettings.bindings[1], [key]: [code] };
          const b2 = { ...initialSettings.bindings[2], [key]: [code] };
          saveInputSettings({
            bindings: { 1: b1, 2: b2 },
          });
          btn.textContent = codeToLabel(code);
        };
        window.addEventListener("keydown", handler, true);
      });
      row.appendChild(lbl);
      row.appendChild(btn);
      globalGrid.appendChild(row);
    });
    globalSection.appendChild(globalGrid);
    panel.appendChild(globalSection);

    const closeBtn = create("button", "bo-btn bo-btn-primary");
    closeBtn.textContent = "Close";
    closeBtn.style.marginTop = "1.5rem";
    closeBtn.addEventListener("click", () => {
      this.showControls = false;
      this.render();
    });
    panel.appendChild(closeBtn);

    overlay.appendChild(panel);
    return overlay;
  }

  private startButtonRow(): HTMLElement {
    const row = create("div", "bo-options bo-gameover-buttons");
    row.style.marginTop = "1.5rem";
    const startBtn = create("button", "bo-btn bo-btn-primary");
    startBtn.textContent = "Start Game";
    startBtn.addEventListener("click", () => {
      this.start();
    });
    const hsBtn = create("button", "bo-btn");
    hsBtn.textContent = "High Scores";
    hsBtn.addEventListener("click", () => {
      this.showHighScores = true;
      this.render();
    });
    row.appendChild(startBtn);
    row.appendChild(hsBtn);
    return row;
  }

  private highScoresContent(): HTMLElement {
    const frag = create("div");
    frag.style.textAlign = "center";
    const title = create("h1", "bo-title");
    title.textContent = "High Scores";
    title.style.fontSize = "2rem";
    const subtitle = create("p", "bo-subtitle");
    subtitle.textContent = "Top 10 players";
    frag.appendChild(title);
    frag.appendChild(subtitle);

    const scores: readonly ScoreEntry[] = loadHighScores();
    if (scores.length === 0) {
      const empty = create("p", "bo-subtitle");
      empty.textContent = "No scores yet. Play a game!";
      frag.appendChild(empty);
    } else {
      const list = create("div", "bo-hs-list");
      list.style.maxHeight = "none";
      scores.forEach((entry, i) => {
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
        list.appendChild(row);
      });
      frag.appendChild(list);
    }

    const backBtn = create("button", "bo-btn bo-btn-primary");
    backBtn.textContent = "Back";
    backBtn.style.marginTop = "1.5rem";
    backBtn.addEventListener("click", () => {
      this.showHighScores = false;
      this.render();
    });
    frag.appendChild(backBtn);
    return frag;
  }

  private optionGroup(
    options: string[],
    active: string,
    onSelect: (val: string) => void,
    labels: Record<string, string>,
    disabled = false,
  ): HTMLElement {
    const wrap = create("div", "bo-options");
    if (disabled) wrap.classList.add("bo-options-disabled");
    options.forEach((opt) => {
      const btn = create("button", "bo-btn");
      btn.textContent = labels[opt] ?? opt;
      if (opt === active) btn.classList.add("active");
      btn.disabled = disabled;
      btn.addEventListener("click", () => {
        if (disabled) return;
        onSelect(opt);
      });
      wrap.appendChild(btn);
    });
    return wrap;
  }
}
