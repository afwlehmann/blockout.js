import * as THREE from "three";
import { createScene, createLights, onResize } from "./render/scene.js";
import { PitView } from "./render/pitView.js";
import { SplitScreenLayout } from "./render/layout.js";
import { PlayerEngine } from "./game/engine.js";
import { Rng } from "./game/rng.js";
import type { MatchConfig } from "./game/types.js";

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

const cameraOffset = new THREE.Object3D();
cameraOffset.position.set(
  (config.pit.width - 1) / 2,
  config.pit.height / 2,
  (config.pit.depth - 1) / 2,
);
scene.add(cameraOffset);

const keys = new Set<string>();
window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  switch (e.code) {
    case "ArrowLeft":
      engine.applyAction({ kind: "move", dx: -1, dz: 0 });
      break;
    case "ArrowRight":
      engine.applyAction({ kind: "move", dx: 1, dz: 0 });
      break;
    case "ArrowUp":
      engine.applyAction({ kind: "move", dx: 0, dz: -1 });
      break;
    case "ArrowDown":
      engine.applyAction({ kind: "move", dx: 0, dz: 1 });
      break;
    case "Space":
      engine.applyAction({ kind: "hardDrop" });
      break;
    case "KeyQ":
      engine.applyAction({ kind: "rotate", axis: "x", dir: 1 });
      break;
    case "KeyA":
      engine.applyAction({ kind: "rotate", axis: "x", dir: -1 });
      break;
    case "KeyW":
      engine.applyAction({ kind: "rotate", axis: "y", dir: 1 });
      break;
    case "KeyS":
      engine.applyAction({ kind: "rotate", axis: "y", dir: -1 });
      break;
    case "KeyE":
      engine.applyAction({ kind: "rotate", axis: "z", dir: 1 });
      break;
    case "KeyD":
      engine.applyAction({ kind: "rotate", axis: "z", dir: -1 });
      break;
    case "KeyC":
      pitView.toggleCamera();
      break;
    case "ShiftLeft":
      engine.applyAction({ kind: "softDrop" });
      break;
  }
  void keys;
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
void cameraOffset;
