import { createScene, createLights, onResize } from "./render/scene.js";
import { PitView } from "./render/pitView.js";
import { SplitScreenLayout } from "./render/layout.js";
import { PlayerEngine, type EngineState } from "./game/engine.js";
import { Match, type MatchResult } from "./game/match.js";
import { Rng } from "./game/rng.js";
import type { MatchConfig, PlayerId } from "./game/types.js";
import { InputSource, loadInputSettings } from "./input/input.js";
import { Menu } from "./ui/menu.js";
import { Hud } from "./ui/hud.js";
import { GameOverScreen } from "./ui/gameOver.js";

interface GameSession {
  readonly config: MatchConfig;
  readonly engines: Readonly<Partial<Record<PlayerId, PlayerEngine>>>;
  readonly pitViews: readonly PitView[];
  readonly layout: SplitScreenLayout;
  readonly match: Match | null;
  readonly cleanup: (() => void)[];
}

const container = document.getElementById("app");
if (!container) throw new Error("#app container not found");

const { scene, renderer } = createScene(container);
createLights(scene);
const cleanupResize = onResize(renderer, container);
const input = InputSource.create(loadInputSettings());

const PLAYERS: readonly PlayerId[] = [1, 2];
let soundEnabled = true;
let musicEnabled = true;
let currentSession: GameSession | null = null;
let menu: Menu | null = null;
let hud: Hud | null = null;
let gameOverScreen: GameOverScreen | null = null;
let rafId: number | null = null;
let lastFrame = 0;

const startMenu = (): void => {
  if (menu) return;
  cleanupSession();
  menu = new Menu();
  menu.onStart(({ config }) => {
    menu?.dispose();
    menu = null;
    startGame(config);
  });
};

const startGame = (config: MatchConfig): void => {
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
      input.onAction((action) => {
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
          case "pause":
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
    cleanups.push(() => {
      scene.remove(view.group);
      view.dispose();
    });

    input.onAction((action) => {
      switch (action.kind) {
        case "move":
          engine.applyAction({ kind: "move", dx: action.dx, dz: action.dz });
          break;
        case "rotate":
          engine.applyAction({ kind: "rotate", axis: action.axis, dir: action.dir });
          break;
        case "softDrop":
        case "hardDrop":
        case "pause":
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
      soundEnabled = !soundEnabled;
      hud?.setSoundEnabled(soundEnabled);
    } else if (action.kind === "toggleMusic") {
      musicEnabled = !musicEnabled;
      hud?.setMusicEnabled(musicEnabled);
    }
  });

  const layout = new SplitScreenLayout(pitViews);

  currentSession = {
    config,
    engines,
    pitViews,
    layout,
    match,
    cleanup: cleanups,
  };

  hud = new Hud(players, {
    onToggleSound: () => {
      soundEnabled = !soundEnabled;
      hud?.setSoundEnabled(soundEnabled);
    },
    onToggleMusic: () => {
      musicEnabled = !musicEnabled;
      hud?.setMusicEnabled(musicEnabled);
    },
    onPause: () => {
      PLAYERS.forEach((p) => {
        const e = currentSession?.engines[p];
        if (e) e.setPaused(!e.state().paused);
      });
    },
  });
  hud.setSoundEnabled(soundEnabled);
  hud.setMusicEnabled(musicEnabled);

  lastFrame = performance.now();
  rafId = requestAnimationFrame(loop);
};

const loop = (now: number): void => {
  const session = currentSession;
  if (!session) return;
  const dt = now - lastFrame;
  lastFrame = now;

  PLAYERS.forEach((p) => {
    const engine = session.engines[p];
    if (engine) engine.update(dt);
  });

  session.pitViews.forEach((v, i) => {
    const engine = session.engines[PLAYERS[i] ?? 1];
    if (engine) v.update(engine);
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
  const e1 = session.engines[1];
  const e2 = session.engines[2];
  const p1State = e1 ? e1.state() : fallbackState();
  const p2State = e2 ? e2.state() : p1State;
  const states: Record<1 | 2, EngineState> = { 1: p1State, 2: p2State };
  const result: MatchResult | null = session.match ? session.match.state().result : null;

  gameOverScreen = new GameOverScreen(
    {
      mode: session.config.mode,
      result,
      states,
      config: session.config,
    },
    (action) => {
      gameOverScreen?.dispose();
      gameOverScreen = null;
      if (action === "rematch") {
        startGame(session.config);
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
