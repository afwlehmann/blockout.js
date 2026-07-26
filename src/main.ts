import { createScene, createLights, onResize } from "./render/scene.js";
import { PitView } from "./render/pitView.js";
import { SplitScreenLayout } from "./render/layout.js";
import { PlayerEngine, type EngineEvent, type EngineState } from "./game/engine.js";
import { Match, type MatchResult } from "./game/match.js";
import { Rng } from "./game/rng.js";
import type { MatchConfig, PlayerId } from "./game/types.js";
import { InputSource, loadInputSettings } from "./input/input.js";
import { create, mount, type UiElement } from "./ui/dom.js";
import { Menu } from "./ui/menu.js";
import { Hud } from "./ui/hud.js";
import { GameOverScreen, recordScore } from "./ui/gameOver.js";
import { loadHighScores } from "./ui/highScores.js";
import { AudioManager } from "./audio/manager.js";
import type { SfxType } from "./audio/sfx.js";

interface PauseOverlay extends UiElement {
  readonly el: HTMLElement;
  readonly cleanup: () => void;
  dispose(): void;
}

const createPauseOverlay = (): PauseOverlay => {
  const el = create("div", "bo-overlay");
  el.style.background = "rgba(10, 10, 15, 0.7)";
  const panel = create("div", "bo-panel");
  panel.style.textAlign = "center";
  panel.style.padding = "2rem 3rem";
  const title = create("h1", "bo-title");
  title.textContent = "Game Paused";
  title.style.fontSize = "2rem";
  const hint = create("p", "bo-subtitle");
  hint.textContent = "Press Esc to resume";
  panel.appendChild(title);
  panel.appendChild(hint);
  el.appendChild(panel);
  const cleanup = mount(el);
  return {
    el,
    cleanup,
    dispose(): void {
      cleanup();
    },
  };
};

interface GameSession {
  readonly config: MatchConfig;
  readonly engines: Readonly<Partial<Record<PlayerId, PlayerEngine>>>;
  readonly pitViews: readonly PitView[];
  readonly layout: SplitScreenLayout;
  readonly match: Match | null;
  readonly crazyMode: boolean;
  readonly cleanup: (() => void)[];
}

const container = document.getElementById("app");
if (!container) throw new Error("#app container not found");

const { scene, renderer } = createScene(container);
createLights(scene);
const cleanupResize = onResize(renderer, container);
const input = InputSource.create(loadInputSettings());
const audio = new AudioManager();

const PLAYERS: readonly PlayerId[] = [1, 2];
let currentSession: GameSession | null = null;
let menu: Menu | null = null;
let hud: Hud | null = null;
let gameOverScreen: GameOverScreen | null = null;
let pauseOverlay: PauseOverlay | null = null;
let rafId: number | null = null;
let lastFrame = 0;

const startMenu = (): void => {
  if (menu) return;
  cleanupSession();
  audio.stopMusic();
  menu = new Menu();
  menu.onStart(({ config, crazyMode }) => {
    menu?.dispose();
    menu = null;
    startGame(config, crazyMode);
  });
};

const sfxForEngineEvent = (ev: EngineEvent): { type: SfxType; intensity: number } | null => {
  switch (ev.type) {
    case "move":
      return { type: "move", intensity: 0 };
    case "rotate":
      return { type: "rotate", intensity: 0 };
    case "lock":
      return { type: "lock", intensity: 0 };
    case "clear": {
      const layers = ev.clearedLayers?.length ?? 0;
      const types: Record<number, SfxType> = { 1: "clear1", 2: "clear2", 3: "clear3", 4: "clear4" };
      const type = types[layers] ?? "clear4";
      return { type, intensity: layers };
    }
    case "levelUp":
      return { type: "levelUp", intensity: 0 };
    case "gameOver":
      return { type: "gameOver", intensity: 0 };
    case "blockOut":
      return { type: "gameOver", intensity: 0 };
    default:
      return null;
  }
};

const wireEngineEvents = (engine: PlayerEngine, pitView: PitView): void => {
  engine.on((ev) => {
    const sfx = sfxForEngineEvent(ev);
    if (sfx) audio.playSfx(sfx.type, sfx.intensity);
    if (ev.type === "clear" && ev.clearedLayers && ev.preClearGrid) {
      const postGrid = engine.pit.snapshot();
      const layers = ev.clearedLayers.length;
      pitView.onSlideComplete = () => {
        audio.playSfx("thud", layers);
      };
      pitView.triggerClear(ev.clearedLayers, ev.preClearGrid, postGrid);
    }
  });
};

const startGame = (config: MatchConfig, crazyMode: boolean): void => {
  const players: readonly PlayerId[] = config.mode === "2p" ? PLAYERS : [1];
  const pitGap = 2;
  const pitSpacing = config.pit.width + pitGap;

  const engines: Partial<Record<PlayerId, PlayerEngine>> = {};
  const pitViews: PitView[] = [];
  const cleanups: (() => void)[] = [];
  let match: Match | null = null;

  if (config.mode === "2p") {
    match = new Match(config, Math.floor(Math.random() * 1000000));
    const m = match;
    PLAYERS.forEach((p) => {
      engines[p] = m.engines[p];
    });
    PLAYERS.forEach((p) => {
      const e = engines[p];
      const v = pitViews[p - 1];
      if (e && v) wireEngineEvents(e, v);
    });
    m.on((ev) => {
      if (ev.type === "attack") {
        audio.playSfx("attack", ev.layers);
      }
    });
    const views = PLAYERS.map((p, i) => {
      const view = new PitView(config.pit, i * pitSpacing);
      scene.add(view.group);
      return view;
    });
    pitViews.push(...views);
    cleanups.push(() => {
      views.forEach((v) => {
        scene.remove(v.group);
        v.dispose();
      });
    });

    PLAYERS.forEach((p) => {
      input.onAction(p, (action) => {
        const m = match;
        if (!m) return;
        switch (action.kind) {
          case "move":
            m.applyAction(p, { kind: "move", dx: action.dx, dz: action.dz });
            break;
          case "rotate":
            m.applyAction(p, { kind: "rotate", axis: action.axis, dir: action.dir });
            break;
          case "hardDrop":
          case "softDrop":
            m.applyAction(p, { kind: action.kind });
            break;
          default:
            break;
        }
      });
    });
  } else {
    const engine = new PlayerEngine(config, new Rng(Math.floor(Math.random() * 1000000)));
    engines[1] = engine;
    const view = new PitView(config.pit, 0);
    scene.add(view.group);
    pitViews.push(view);
    wireEngineEvents(engine, view);
    cleanups.push(() => {
      scene.remove(view.group);
      view.dispose();
    });

    input.onAction(1, (action) => {
      switch (action.kind) {
        case "move":
          engine.applyAction({ kind: "move", dx: action.dx, dz: action.dz });
          break;
        case "rotate":
          engine.applyAction({ kind: "rotate", axis: action.axis, dir: action.dir });
          break;
        case "softDrop":
        case "hardDrop":
          engine.applyAction({ kind: action.kind });
          break;
        default:
          break;
      }
    });
  }

  input.onGlobalAction((action) => {
    if (action.kind === "cameraToggle") {
      pitViews.forEach((v) => {
        v.toggleCamera();
      });
    } else if (action.kind === "toggleSound") {
      const enabled = audio.toggleSfx();
      hud?.setSoundEnabled(enabled);
    } else if (action.kind === "toggleMusic") {
      const enabled = audio.toggleMusic();
      hud?.setMusicEnabled(enabled);
    } else if (action.kind === "pause") {
      togglePause();
    }
  });

  const layout = new SplitScreenLayout(pitViews);

  currentSession = {
    config,
    engines,
    pitViews,
    layout,
    match,
    crazyMode,
    cleanup: cleanups,
  };

  pitViews.forEach((v) => {
    v.setCrazyMode(crazyMode);
  });

  hud = new Hud(players, {
    onToggleSound: () => {
      const enabled = audio.toggleSfx();
      hud?.setSoundEnabled(enabled);
    },
    onToggleMusic: () => {
      const enabled = audio.toggleMusic();
      hud?.setMusicEnabled(enabled);
    },
    onPause: () => {
      togglePause();
    },
  });
  hud.setSoundEnabled(!audio.isSfxMuted());
  hud.setMusicEnabled(!audio.isMusicMuted());

  void audio.resume();
  audio.startMusic();

  lastFrame = performance.now();
  rafId = requestAnimationFrame(loop);
};

const togglePause = (): void => {
  const session = currentSession;
  if (!session) return;
  const anyPaused = PLAYERS.some((p) => {
    const e = session.engines[p];
    return e ? e.state().paused : false;
  });
  const newPaused = !anyPaused;
  PLAYERS.forEach((p) => {
    const e = session.engines[p];
    if (e) e.setPaused(newPaused);
  });
  if (newPaused) {
    audio.pauseMusic();
    pauseOverlay = createPauseOverlay();
  } else {
    if (pauseOverlay) {
      pauseOverlay.dispose();
      pauseOverlay = null;
    }
    audio.resumeMusic();
  }
};

const loop = (now: number): void => {
  const session = currentSession;
  if (!session) return;
  const dt = now - lastFrame;
  lastFrame = now;

  PLAYERS.forEach((p) => {
    const engine = session.engines[p];
    if (engine && !engine.state().paused) engine.update(dt);
  });

  session.pitViews.forEach((v, i) => {
    const engine = session.engines[PLAYERS[i] ?? 1];
    if (engine) v.update(engine);
    v.tick(dt);
  });

  session.layout.render(renderer, scene, container.clientWidth, container.clientHeight);

  PLAYERS.forEach((p) => {
    const engine = session.engines[p];
    if (engine) hud?.updatePlayer(p, engine.state());
  });

  const anyGameOver = PLAYERS.some((p) => {
    const engine = session.engines[p];
    return engine ? engine.state().gameOver : false;
  });

  if (!anyGameOver) {
    rafId = requestAnimationFrame(loop);
  } else {
    showGameOver(session);
  }
};

const showGameOver = (session: GameSession): void => {
  if (pauseOverlay) {
    pauseOverlay.dispose();
    pauseOverlay = null;
  }
  const e1 = session.engines[1];
  const e2 = session.engines[2];
  const p1State = e1 ? e1.state() : fallbackState();
  const p2State = e2 ? e2.state() : p1State;
  const states: Record<1 | 2, EngineState> = { 1: p1State, 2: p2State };
  const result: MatchResult | null = session.match ? session.match.state().result : null;

  const winner = result?.winner ?? null;
  if (session.config.mode === "1p") {
    recordScore(p1State, "1p", null);
  } else {
    if (e1) recordScore(p1State, "2p", winner);
    if (e2) recordScore(p2State, "2p", winner);
  }

  gameOverScreen = new GameOverScreen(
    {
      mode: session.config.mode,
      result,
      states,
      config: session.config,
      highScores: loadHighScores(),
    },
    (action) => {
      gameOverScreen?.dispose();
      gameOverScreen = null;
      if (action === "rematch") {
        startGame(session.config, session.crazyMode);
      } else {
        startMenu();
      }
    },
  );
};

const fallbackState = (): EngineState => ({
  score: 0,
  level: 1,
  faces: 0,
  cubes: 0,
  active: null,
  next: { id: "", set: "flat", color: 0, cells: [] },
  gameOver: true,
  paused: false,
  elapsedMs: 0,
});

const cleanupSession = (): void => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (currentSession) {
    currentSession.cleanup.forEach((fn) => {
      fn();
    });
    currentSession = null;
  }
  if (hud) {
    hud.dispose();
    hud = null;
  }
  if (gameOverScreen) {
    gameOverScreen.dispose();
    gameOverScreen = null;
  }
};

void fallbackState;
void cleanupResize;
startMenu();
