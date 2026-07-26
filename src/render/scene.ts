import * as THREE from "three";

export interface SceneSetup {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
}

export const createScene = (container: HTMLElement): SceneSetup => {
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0a0a0f, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0a0f, 20, 60);

  return { scene, renderer, canvas };
};

export interface Lights {
  readonly ambient: THREE.AmbientLight;
  readonly key: THREE.DirectionalLight;
  readonly fill: THREE.DirectionalLight;
}

export const createLights = (scene: THREE.Scene): Lights => {
  const ambient = new THREE.AmbientLight(0xb0c4de, 0.45);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(0, 30, 0.01);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 60;
  key.shadow.camera.left = -15;
  key.shadow.camera.right = 15;
  key.shadow.camera.top = 15;
  key.shadow.camera.bottom = -15;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  scene.add(key.target);

  const fill = new THREE.DirectionalLight(0x6080a0, 0.35);
  fill.position.set(-5, 10, -3);
  scene.add(fill);

  return { ambient, key, fill };
};

export const onResize = (renderer: THREE.WebGLRenderer, container: HTMLElement): (() => void) => {
  const handle = (): void => {
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener("resize", handle);
  return () => {
    window.removeEventListener("resize", handle);
  };
};
