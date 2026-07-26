import * as THREE from "three";
import type { PlayerEngine } from "../game/engine.js";
import type { PitConfig } from "../game/types.js";
import { BlockMesh, blockGeometry } from "./blockMesh.js";
import { PieceView } from "./pieceView.js";

const PALETTE: readonly number[] = [
  0x38bdf8, 0xfbbf24, 0x4ade80, 0xa78bfa, 0xf472b6, 0xfb7185, 0x34d399, 0x818cf8, 0x22d3ee,
  0xfacc15, 0x60a5fa, 0xfb923c,
];

interface Particle {
  readonly mesh: THREE.Mesh;
  readonly velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface SlideAnim {
  active: boolean;
  elapsed: number;
  duration: number;
  clearedLayers: readonly number[];
  preGrid: readonly number[];
  postGrid: readonly number[];
}

const PARTICLE_COUNT = 8;
const SLIDE_DURATION = 350;

export class PitView {
  readonly group: THREE.Group;
  readonly camera: THREE.PerspectiveCamera;
  private readonly config: PitConfig;
  private readonly blockMesh: BlockMesh;
  private readonly colors: THREE.Color[];
  private pieceView: PieceView | null = null;
  private readonly walls: THREE.Group;
  private readonly sideCamera: THREE.PerspectiveCamera;
  private usingSideCamera = false;
  private crazyMode = false;
  private crazyTime = 0;
  private readonly particles: Particle[] = [];
  private slideAnim: SlideAnim | null = null;
  onSlideComplete: (() => void) | null = null;

  constructor(config: PitConfig, originX: number) {
    this.config = config;
    this.group = new THREE.Group();
    this.group.position.x = originX;

    this.colors = PALETTE.map((c) => new THREE.Color(c));

    const aspect = 1;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200);
    this.sideCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200);
    this.positionCameras();

    this.blockMesh = new BlockMesh(config, PALETTE.length);
    this.blockMesh.mesh.castShadow = true;
    this.blockMesh.mesh.receiveShadow = true;
    this.group.add(this.blockMesh.mesh);

    this.walls = this.buildWalls();
    this.group.add(this.walls);
  }

  private positionCameras(): void {
    const { width: w, depth: d, height: h } = this.config;
    const cx = this.group.position.x + (w - 1) / 2;
    const cy = h / 2;
    const cz = (d - 1) / 2;

    const mainDist = Math.max(w, d, h) * 1.4;
    this.camera.position.set(cx + mainDist * 0.3, cy + mainDist * 0.9, cz + mainDist * 1.1);
    this.camera.lookAt(cx, cy * 0.6, cz);

    this.sideCamera.position.set(cx + mainDist * 1.3, cy + mainDist * 0.3, cz);
    this.sideCamera.lookAt(cx, cy * 0.6, cz);
  }

  private buildWalls(): THREE.Group {
    const { width: w, depth: d, height: h } = this.config;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9,
      metalness: 0.0,
    });
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xc0c0c0,
    });

    const group = new THREE.Group();
    const cx = (w - 1) / 2;
    const cz = (d - 1) / 2;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, -0.5, cz);
    floor.receiveShadow = true;
    group.add(floor);

    const wallDefs: { w: number; h: number; pos: [number, number, number]; rot: number }[] = [
      { w: w, h: h, pos: [cx, h / 2 - 0.5, -0.5], rot: 0 },
      { w: w, h: h, pos: [cx, h / 2 - 0.5, d - 0.5], rot: 0 },
      { w: d, h: h, pos: [-0.5, h / 2 - 0.5, cz], rot: Math.PI / 2 },
      { w: d, h: h, pos: [w - 0.5, h / 2 - 0.5, cz], rot: Math.PI / 2 },
    ];
    wallDefs.forEach(({ w: ww, h: hh, pos, rot }) => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), wallMat);
      wall.position.set(pos[0], pos[1], pos[2]);
      wall.rotation.y = rot;
      wall.receiveShadow = true;
      group.add(wall);
    });

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
    const line = new THREE.LineSegments(edges, edgeMat);
    line.position.set(cx, h / 2 - 0.5, cz);
    group.add(line);

    return group;
  }

  toggleCamera(): void {
    this.usingSideCamera = !this.usingSideCamera;
  }

  setCrazyMode(enabled: boolean): void {
    this.crazyMode = enabled;
    if (!enabled) {
      this.group.rotation.z = 0;
      this.group.rotation.x = 0;
    }
  }

  triggerClear(
    clearedLayers: readonly number[],
    preGrid: readonly number[],
    postGrid: readonly number[],
  ): void {
    this.spawnExplosion(clearedLayers, preGrid);
    this.slideAnim = {
      active: true,
      elapsed: 0,
      duration: SLIDE_DURATION,
      clearedLayers,
      preGrid,
      postGrid,
    };
  }

  private spawnExplosion(clearedLayers: readonly number[], grid: readonly number[]): void {
    const { width: w, depth: d } = this.config;
    clearedLayers.forEach((y) => {
      for (let x = 0; x < w; x++) {
        for (let z = 0; z < d; z++) {
          const idx = x + w * (z + d * y);
          const colorIdx = grid[idx] ?? 0;
          if (colorIdx === 0) continue;
          const colorHex = PALETTE[colorIdx - 1] ?? PALETTE[0] ?? 0xffffff;
          const color = new THREE.Color(colorHex);

          for (let p = 0; p < PARTICLE_COUNT; p++) {
            const geom = blockGeometry.clone();
            const mat = new THREE.MeshStandardMaterial({
              color,
              emissive: color,
              emissiveIntensity: 0.5,
              transparent: true,
              opacity: 1.0,
            });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.scale.setScalar(0.3 + Math.random() * 0.3);
            mesh.position.set(x, y, z);
            mesh.castShadow = false;

            const angle = Math.random() * Math.PI * 2;
            const upward = 2 + Math.random() * 4;
            const outward = 1 + Math.random() * 3;
            const velocity = new THREE.Vector3(
              Math.cos(angle) * outward,
              upward,
              Math.sin(angle) * outward,
            );

            this.group.add(mesh);
            this.particles.push({
              mesh,
              velocity,
              life: 0,
              maxLife: 0.4 + Math.random() * 0.3,
            });
          }
        }
      }
    });
  }

  private updateParticles(dt: number): void {
    const dtSec = dt / 1000;
    const gravity = 12;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;
      p.life += dtSec;
      if (p.life >= p.maxLife) {
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
        const mat = p.mesh.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            m.dispose();
          });
        } else {
          mat.dispose();
        }
        this.particles.splice(i, 1);
        continue;
      }
      p.velocity.y -= gravity * dtSec;
      p.mesh.position.x += p.velocity.x * dtSec;
      p.mesh.position.y += p.velocity.y * dtSec;
      p.mesh.position.z += p.velocity.z * dtSec;
      const lifeRatio = p.life / p.maxLife;
      const mat = p.mesh.material;
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.opacity = 1.0 - lifeRatio;
      }
      p.mesh.rotation.x += dtSec * 8;
      p.mesh.rotation.z += dtSec * 6;
    }
  }

  private updateSlide(dt: number): void {
    if (!this.slideAnim?.active) return;
    this.slideAnim.elapsed += dt;
    const progress = Math.min(this.slideAnim.elapsed / this.slideAnim.duration, 1.0);

    if (progress >= 1.0) {
      this.slideAnim.active = false;
      this.slideAnim = null;
      if (this.onSlideComplete) {
        this.onSlideComplete();
      }
    }
  }

  isAnimating(): boolean {
    return (this.slideAnim?.active ?? false) || this.particles.length > 0;
  }

  tick(dt: number): void {
    this.updateParticles(dt);
    this.updateSlide(dt);
  }

  get activeCamera(): THREE.PerspectiveCamera {
    return this.usingSideCamera ? this.sideCamera : this.camera;
  }

  update(engine: PlayerEngine): void {
    const grid = engine.pit.snapshot();

    if (this.slideAnim?.active) {
      const { preGrid, postGrid, clearedLayers } = this.slideAnim;
      void preGrid;
      this.blockMesh.updateWithSlide(
        postGrid,
        preGrid,
        this.colors,
        clearedLayers,
        this.slideAnim.elapsed / this.slideAnim.duration,
      );
    } else {
      this.blockMesh.update(grid, this.colors);
    }

    if (this.crazyMode) {
      const dt = 0.016;
      this.crazyTime += dt;
      this.group.rotation.z = Math.sin(this.crazyTime * 0.5) * 0.15;
      this.group.rotation.x = Math.sin(this.crazyTime * 0.3) * 0.08;
    }

    const state = engine.state();
    const active = state.active;
    if (!active) {
      if (this.pieceView) {
        this.group.remove(this.pieceView.group);
        this.pieceView.removeGhost(this.group);
        this.pieceView.dispose();
        this.pieceView = null;
      }
      return;
    }

    const cells = engine.activeCells();
    const ghost = engine.ghostOrigin();

    if (!this.pieceView) {
      this.pieceView = new PieceView(active.def.color);
      this.group.add(this.pieceView.group);
      this.pieceView.addGhostTo(this.group);
    }
    this.pieceView.update(cells, active.origin, ghost);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.sideCamera.aspect = aspect;
    this.sideCamera.updateProjectionMatrix();
  }

  dispose(): void {
    this.blockMesh.dispose();
    this.pieceView?.dispose();
    this.disposeGroup(this.walls);
  }

  private disposeGroup(group: THREE.Group): void {
    group.children.forEach((child) => {
      this.disposeObject(child);
    });
  }

  private disposeObject(obj: THREE.Object3D): void {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const mat = obj.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => {
          m.dispose();
        });
      } else {
        mat.dispose();
      }
    } else if (obj instanceof THREE.Group) {
      obj.children.forEach((child) => {
        this.disposeObject(child);
      });
    }
  }
}
