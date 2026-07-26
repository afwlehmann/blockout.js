import { createScene, createLights, onResize } from "./render/scene.js";
import { PitView } from "./render/pitView.js";
import { SplitScreenLayout } from "./render/layout.js";
import { PlayerEngine } from "./game/engine.js";
import { Rng } from "./game/rng.js";
import type { MatchConfig } from "./game/types.js";
import { InputSource, loadInputSettings } from "./input/input.js";

const config: MatchConfig = {
  mode: "1p",
  pit: { width: 5, depth: 5, height: 12 },
  set: "flat",
  startLevel: 1,
  targetFaces: 10,
  difficulty: "normal",
};

const container = document.getElementById("app");
if (!container) throw new Error("#app container not found");

const { scene, renderer } = createScene(container);
createLights(scene);

const engine = new PlayerEngine(config, new Rng(12345));
const pitView = new PitView(config.pit, 0);
scene.add(pitView.group);

const layout = new SplitScreenLayout([pitView]);
const cleanupResize = onResize(renderer, container);

const input = InputSource.create(loadInputSettings());

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

input.onGlobalAction((action) => {
  if (action.kind === "cameraToggle") {
    pitView.toggleCamera();
  }
});

let last = performance.now();
const loop = (now: number): void => {
  const dt = now - last;
  last = now;

  engine.update(dt);
  pitView.update(engine);

  layout.render(renderer, scene, container.clientWidth, container.clientHeight);

  if (!engine.state().gameOver) {
    requestAnimationFrame(loop);
  } else {
    console.log("Game over! Score:", engine.state().score);
  }
};

requestAnimationFrame(loop);

void cleanupResize;
