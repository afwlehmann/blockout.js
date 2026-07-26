import { createScene, createLights, populateSpaceEnv, onResize } from "./render/scene.js";
import * as THREE from "three";
import { PitView } from "./render/pitView.js";
import { SplitScreenLayout } from "./render/layout.js";
import { PlayerEngine, type EngineEvent, type EngineState } from "./game/engine.js";
import { Match, type MatchResult } from "./game/match.js";
import { Rng } from "./game/rng.js";
import type { MatchConfig, PlayerId } from "./game/types.js";
import { InputSource, loadInputSettings, stripArrows } from "./input/input.js";
import { create, mount, type UiElement } from "./ui/dom.js";
import { Menu } from "./ui/menu.js";
import { Hud } from "./ui/hud.js";
import { GameOverScreen, createScoreEntry } from "./ui/gameOver.js";
import { loadHighScores, saveHighScore } from "./ui/highScores.js";
import { AudioManager } from "./audio/manager.js";
import type { SfxType } from "./audio/sfx.js";

interface PauseOverlay extends UiElement {
  readonly el: HTMLElement;
  readonly cleanup: () => void;
  dispose(): void;
}

const createPauseOverlay = (): PauseOverlay => {
  const el = create("div", "bo-overlay");
  el.style.background = "rgba(1, 1, 10, 0.7)";
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
  readonly players: readonly PlayerId[];
  readonly engines: Readonly<Partial<Record<PlayerId, PlayerEngine>>>;
  readonly pitViews: readonly PitView[];
  readonly layout: SplitScreenLayout;
  readonly match: Match | null;
  readonly crazyMode: boolean;
  readonly cleanup: (() => void)[];
}

const container = document.getElementById("app");
if (!container) throw new Error("#app container not found");

const { scene, renderer, spaceEnv } = createScene(container);
createLights(scene);
const cleanupResize = onResize(renderer, container);
const input = InputSource.create(loadInputSettings());
const audio = new AudioManager();

const PLAYERS: readonly PlayerId[] = [1, 2];

const MS_PER_SEC = 1000;
const AMBIENT_ROTATION_SPEED = 0.01;
const MAX_DROP_DISTANCE = 20;
const SHAKE_FACTOR = 0.06;
const CLEAR_SFX: readonly SfxType[] = ["clear1", "clear2", "clear3", "clear4"];
const DEFAULT_CLEAR_SFX: SfxType = "clear4";

interface AppState {
  session: GameSession | null;
  menu: Menu | null;
  hud: Hud | null;
  gameOverScreen: GameOverScreen | null;
  pauseOverlay: PauseOverlay | null;
  exitConfirmOverlay: PauseOverlay | null;
  rafId: number | null;
  lastFrame: number;
  ambientActive: boolean;
  ambientLast: number;
}

const state: AppState = {
  session: null,
  menu: null,
  hud: null,
  gameOverScreen: null,
  pauseOverlay: null,
  exitConfirmOverlay: null,
  rafId: null,
  lastFrame: 0,
  ambientActive: false,
  ambientLast: 0,
};

const ambientCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
ambientCamera.position.set(0, 0, 0);
ambientCamera.lookAt(0, 0, -1);

const ambientLoop = (now: number): void => {
  const dt = now - state.ambientLast;
  state.ambientLast = now;
  spaceEnv.update(dt);
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (ambientCamera.aspect !== w / h) {
    ambientCamera.aspect = w / h;
    ambientCamera.updateProjectionMatrix();
  }
  ambientCamera.rotation.y += (dt / MS_PER_SEC) * AMBIENT_ROTATION_SPEED;
  renderer.setViewport(0, 0, w, h);
  renderer.setScissorTest(false);
  renderer.render(scene, ambientCamera);
  if (state.ambientActive) requestAnimationFrame(ambientLoop);
};

const startAmbient = (): void => {
  if (state.ambientActive) return;
  state.ambientActive = true;
  state.ambientLast = performance.now();
  requestAnimationFrame(ambientLoop);
};

const stopAmbient = (): void => {
  state.ambientActive = false;
};

const startMenu = (): void => {
  if (state.menu) return;
  cleanupSession();
  audio.stopMusic();
  startAmbient();
  state.menu = new Menu();
  state.menu.onStart(({ config, crazyMode }) => {
    state.menu?.dispose();
    state.menu = null;
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
      const type = CLEAR_SFX[layers - 1] ?? DEFAULT_CLEAR_SFX;
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
    if (ev.type === "lock" && ev.dropDistance && ev.dropDistance > 0) {
      const intensity = Math.min(ev.dropDistance, MAX_DROP_DISTANCE);
      pitView.triggerShake(intensity * SHAKE_FACTOR);
      audio.playSfx("rumble", intensity);
    }
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
  stopAmbient();
  container.classList.add("bo-fade-in");
  const players: readonly PlayerId[] = config.mode === "2p" ? PLAYERS : [1];
  const is2P = config.mode === "2p";
  const effectiveCrazy = is2P ? false : crazyMode;

  const engines: Partial<Record<PlayerId, PlayerEngine>> = {};
  const pitViews: PitView[] = [];
  const cleanups: (() => void)[] = [];

  const createPlayerScene = (): THREE.Scene => {
    const s = new THREE.Scene();
    s.fog = new THREE.Fog(0x01010a, 40, 130);
    populateSpaceEnv(s);
    createLights(s);
    return s;
  };

  if (is2P) {
    const match = new Match(config, Math.floor(Math.random() * 1000000));
    players.forEach((p) => {
      engines[p] = match.engines[p];
    });
    match.on((ev) => {
      if (ev.type === "attack") {
        audio.playSfx("attack", ev.layers);
      }
    });

    players.forEach((p) => {
      const ps = createPlayerScene();
      const view = new PitView(config.pit, 0, ps);
      pitViews.push(view);
      const e = engines[p];
      if (e) wireEngineEvents(e, view);
    });

    cleanups.push(() => {
      pitViews.forEach((v) => {
        v.dispose();
      });
    });

    const settings = loadInputSettings();
    const p1: PlayerId = 1;
    input.setBinding(p1, stripArrows(settings.bindings[p1]));

    cleanups.push(() => {
      input.setBinding(p1, settings.bindings[p1]);
    });

    players.forEach((p) => {
      input.onAction(p, (action) => {
        switch (action.kind) {
          case "move":
            match.applyAction(p, { kind: "move", dx: action.dx, dz: action.dz });
            break;
          case "rotate":
            match.applyAction(p, { kind: "rotate", axis: action.axis, dir: action.dir });
            break;
          case "hardDrop":
          case "softDrop":
            match.applyAction(p, { kind: action.kind });
            break;
          default:
            break;
        }
      });
    });
    state.session = {
      config,
      players,
      engines,
      pitViews,
      layout: new SplitScreenLayout(pitViews),
      match,
      crazyMode: effectiveCrazy,
      cleanup: cleanups,
    };
  } else {
    const engine = new PlayerEngine(config, new Rng(Math.floor(Math.random() * 1000000)));
    engines[1] = engine;
    const view = new PitView(config.pit, 0, scene);
    pitViews.push(view);
    wireEngineEvents(engine, view);
    cleanups.push(() => {
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
    state.session = {
      config,
      players,
      engines,
      pitViews,
      layout: new SplitScreenLayout(pitViews),
      match: null,
      crazyMode: effectiveCrazy,
      cleanup: cleanups,
    };
  }

  input.onGlobalAction((action) => {
    if (action.kind === "cameraToggle" && !is2P && state.session) {
      pitViews.forEach((v) => {
        v.toggleCamera();
      });
      state.session.layout.invalidateCache();
    } else if (action.kind === "toggleSound") {
      const enabled = audio.toggleSfx();
      state.hud?.setSoundEnabled(enabled);
    } else if (action.kind === "toggleMusic") {
      const enabled = audio.toggleMusic();
      state.hud?.setMusicEnabled(enabled);
    } else if (action.kind === "pause") {
      togglePause();
    } else if (action.kind === "exitToMenu") {
      confirmExitToMenu();
    }
  });

  pitViews.forEach((v) => {
    v.setCrazyMode(effectiveCrazy);
  });

  state.hud = new Hud(players, {
    onToggleSound: () => {
      const enabled = audio.toggleSfx();
      state.hud?.setSoundEnabled(enabled);
    },
    onToggleMusic: () => {
      const enabled = audio.toggleMusic();
      state.hud?.setMusicEnabled(enabled);
    },
    onPause: () => {
      togglePause();
    },
  });
  state.hud.setSoundEnabled(!audio.isSfxMuted());
  state.hud.setMusicEnabled(!audio.isMusicMuted());

  void audio.resume();
  audio.startMusic();

  state.lastFrame = performance.now();
  state.rafId = requestAnimationFrame(loop);
};

const togglePause = (): void => {
  const session = state.session;
  if (!session) return;
  const anyPaused = session.players.some((p) => {
    const e = session.engines[p];
    return e ? e.state().paused : false;
  });
  const newPaused = !anyPaused;
  session.players.forEach((p) => {
    const e = session.engines[p];
    if (e) e.setPaused(newPaused);
  });
  if (newPaused) {
    audio.pauseMusic();
    state.pauseOverlay = createPauseOverlay();
  } else {
    if (state.pauseOverlay) {
      state.pauseOverlay.dispose();
      state.pauseOverlay = null;
    }
    audio.resumeMusic();
  }
};

const confirmExitToMenu = (): void => {
  const session = state.session;
  if (!session) return;
  if (state.exitConfirmOverlay) return;
  session.players.forEach((p) => {
    const e = session.engines[p];
    if (e && !e.state().paused) e.setPaused(true);
  });
  audio.pauseMusic();

  const el = create("div", "bo-overlay");
  el.style.background = "rgba(1, 1, 10, 0.8)";
  const panel = create("div", "bo-panel");
  panel.style.textAlign = "center";
  panel.style.padding = "2rem 3rem";
  const title = create("h1", "bo-title");
  title.textContent = "Exit to Menu?";
  title.style.fontSize = "2rem";
  const hint = create("p", "bo-subtitle");
  hint.textContent = "Your current game will be lost.";
  const btnRow = create("div", "bo-gameover-buttons");
  btnRow.style.marginTop = "1.5rem";
  const confirmBtn = create("button", "bo-btn-primary");
  confirmBtn.textContent = "Exit to Menu";
  const cancelBtn = create("button", "bo-btn");
  cancelBtn.textContent = "Cancel";

  const cancelExit = (): void => {
    if (state.exitConfirmOverlay) {
      state.exitConfirmOverlay.dispose();
      state.exitConfirmOverlay = null;
    }
    session.players.forEach((p) => {
      const e = session.engines[p];
      if (e) e.setPaused(false);
    });
    audio.resumeMusic();
  };

  const confirmExit = (): void => {
    if (state.exitConfirmOverlay) {
      state.exitConfirmOverlay.dispose();
      state.exitConfirmOverlay = null;
    }
    cleanupSession();
    startMenu();
  };

  confirmBtn.addEventListener("click", confirmExit);
  cancelBtn.addEventListener("click", cancelExit);

  const keyHandler = (e: KeyboardEvent): void => {
    if (e.code === "Escape") {
      e.preventDefault();
      cancelExit();
      window.removeEventListener("keydown", keyHandler);
    } else if (e.code === "Enter") {
      e.preventDefault();
      confirmExit();
      window.removeEventListener("keydown", keyHandler);
    }
  };
  window.addEventListener("keydown", keyHandler);

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  panel.appendChild(title);
  panel.appendChild(hint);
  panel.appendChild(btnRow);
  el.appendChild(panel);
  const cleanup = mount(el);
  state.exitConfirmOverlay = {
    el,
    cleanup,
    dispose(): void {
      window.removeEventListener("keydown", keyHandler);
      cleanup();
    },
  };
};

const loop = (now: number): void => {
  const session = state.session;
  if (!session) return;
  const dt = now - state.lastFrame;
  state.lastFrame = now;

  session.players.forEach((p) => {
    const engine = session.engines[p];
    if (engine && !engine.state().paused) engine.update(dt);
  });

  spaceEnv.update(dt);

  session.pitViews.forEach((v, i) => {
    const engine = session.engines[session.players[i] ?? 1];
    if (engine) v.update(engine);
    v.tick(dt);
  });

  session.layout.render(renderer, container.clientWidth, container.clientHeight);

  session.players.forEach((p) => {
    const engine = session.engines[p];
    if (engine) state.hud?.updatePlayer(p, engine.state());
  });

  const anyGameOver = session.players.some((p) => {
    const engine = session.engines[p];
    return engine ? engine.state().gameOver : false;
  });

  if (!anyGameOver) {
    state.rafId = requestAnimationFrame(loop);
  } else {
    showGameOver(session);
    startAmbient();
  }
};

const showGameOver = (session: GameSession): void => {
  if (state.pauseOverlay) {
    state.pauseOverlay.dispose();
    state.pauseOverlay = null;
  }
  const e1 = session.engines[1];
  const e2 = session.engines[2];
  const p1State = e1 ? e1.state() : fallbackState();
  const p2State = e2 ? e2.state() : p1State;
  const states: Record<1 | 2, EngineState> = { 1: p1State, 2: p2State };
  const result: MatchResult | null = session.match ? session.match.state().result : null;

  const winner = result?.winner ?? null;

  const existingScores = loadHighScores();

  state.gameOverScreen = new GameOverScreen(
    {
      mode: session.config.mode,
      result,
      states,
      config: session.config,
      highScores: existingScores,
    },
    (action) => {
      state.gameOverScreen?.dispose();
      state.gameOverScreen = null;
      if (action === "rematch") {
        startGame(session.config, session.crazyMode);
      } else {
        startMenu();
      }
    },
    (player, name) => {
      const playerState = states[player];
      const entry = createScoreEntry(playerState, session.config.mode, winner, name);
      saveHighScore(entry);
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
  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  container.classList.remove("bo-fade-in");
  if (state.session) {
    state.session.layout.dispose();
    state.session.cleanup.forEach((fn) => {
      fn();
    });
    state.session = null;
  }
  if (state.hud) {
    state.hud.dispose();
    state.hud = null;
  }
  if (state.gameOverScreen) {
    state.gameOverScreen.dispose();
    state.gameOverScreen = null;
  }
  if (state.pauseOverlay) {
    state.pauseOverlay.dispose();
    state.pauseOverlay = null;
  }
  if (state.exitConfirmOverlay) {
    state.exitConfirmOverlay.dispose();
    state.exitConfirmOverlay = null;
  }
};

void fallbackState;
void cleanupResize;
startMenu();
