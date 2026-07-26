import * as THREE from "three";

export interface SceneSetup {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  readonly spaceEnv: SpaceEnv;
}

export interface SpaceEnv {
  readonly starfield: THREE.Points;
  readonly nebulae: readonly THREE.Mesh[];
  readonly planets: readonly THREE.Mesh[];
  readonly dust: THREE.Points;
  update(dt: number): void;
}

const NEBULA_COLORS: readonly number[] = [0x4a1a6a, 0x1a3a6a, 0x6a1a3a, 0x1a4a4a];

const PLANET_COLORS: readonly number[] = [0x4488cc, 0xcc6644, 0x44aa77];

const createStarfield = (): THREE.Points => {
  const STAR_COUNT = 4000;
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const STAR_RADIUS = 90;

  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = STAR_RADIUS + Math.random() * 20;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const tint = Math.random();
    if (tint < 0.7) {
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 1;
    } else if (tint < 0.85) {
      colors[i * 3] = 0.7;
      colors[i * 3 + 1] = 0.8;
      colors[i * 3 + 2] = 1;
    } else {
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 0.85;
      colors[i * 3 + 2] = 0.6;
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.6,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
    depthWrite: false,
  });

  return new THREE.Points(geom, mat);
};

const createNebulaTexture = (): THREE.Texture => {
  const SIZE = 128;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();
  const grad = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
  grad.addColorStop(0, "rgba(255,255,255,0.8)");
  grad.addColorStop(0.3, "rgba(255,255,255,0.3)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
};

const createNebulae = (texture: THREE.Texture): THREE.Mesh[] => {
  const NEBULA_RADIUS = 110;
  return NEBULA_COLORS.map((color, i) => {
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      color,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(50 + i * 10, 50 + i * 10), mat);
    const angle = (i / NEBULA_COLORS.length) * Math.PI * 2;
    mesh.position.set(
      Math.cos(angle) * NEBULA_RADIUS,
      (Math.random() - 0.5) * 40,
      Math.sin(angle) * NEBULA_RADIUS,
    );
    mesh.lookAt(0, 0, 0);
    return mesh;
  });
};

const createPlanets = (): THREE.Mesh[] => {
  const PLANET_DISTANCES = [55, 68, 75];
  return PLANET_COLORS.map((color, i) => {
    const radius = 3 + Math.random() * 4;
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.25,
      roughness: 0.8,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), mat);
    const angle = (i / PLANET_COLORS.length) * Math.PI * 2 + Math.random();
    const dist = PLANET_DISTANCES[i] ?? 60;
    mesh.position.set(Math.cos(angle) * dist, (Math.random() - 0.3) * 30, Math.sin(angle) * dist);
    return mesh;
  });
};

const createDust = (): THREE.Points => {
  const DUST_COUNT = 200;
  const positions = new Float32Array(DUST_COUNT * 3);
  const DUST_MIN = 18;
  const DUST_MAX = 35;

  for (let i = 0; i < DUST_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = DUST_MIN + Math.random() * (DUST_MAX - DUST_MIN);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0x88aaff,
    size: 0.15,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  return new THREE.Points(geom, mat);
};

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
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.setClearColor(0x01010a, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x01010a, 40, 130);

  const starfield = createStarfield();
  scene.add(starfield);

  const nebulaTexture = createNebulaTexture();
  const nebulae = createNebulae(nebulaTexture);
  nebulae.forEach((n) => scene.add(n));

  const planets = createPlanets();
  planets.forEach((p) => scene.add(p));

  const dust = createDust();
  scene.add(dust);

  const spaceEnv: SpaceEnv = {
    starfield,
    nebulae,
    planets,
    dust,
    update(dt: number): void {
      const dtSec = dt / 1000;
      starfield.rotation.y += dtSec * 0.02;
      starfield.rotation.x += dtSec * 0.005;
      dust.rotation.y += dtSec * 0.04;
      dust.rotation.x += dtSec * 0.01;
      nebulae.forEach((n, i) => {
        n.rotation.z += dtSec * 0.008 * (i + 1);
      });
      planets.forEach((p) => {
        p.rotation.y += dtSec * 0.005;
      });
    },
  };

  return { scene, renderer, canvas, spaceEnv };
};

export interface Lights {
  readonly ambient: THREE.AmbientLight;
  readonly key: THREE.DirectionalLight;
  readonly fill: THREE.DirectionalLight;
}

export const createLights = (scene: THREE.Scene): Lights => {
  const ambient = new THREE.AmbientLight(0x4060a0, 0.35);
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
  key.shadow.radius = 4;
  scene.add(key);
  scene.add(key.target);

  const fill = new THREE.DirectionalLight(0x4060a0, 0.3);
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
