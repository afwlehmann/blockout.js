import * as THREE from "three";
import type { PlayerEngine } from "../game/engine.js";
import type { PitConfig } from "../game/types.js";
import { BlockMesh } from "./blockMesh.js";
import { PieceView } from "./pieceView.js";

const PALETTE: readonly number[] = [
  0x38bdf8, 0xfbbf24, 0x4ade80, 0xa78bfa, 0xf472b6, 0xfb7185, 0x34d399, 0x818cf8, 0x22d3ee,
  0xfacc15, 0x60a5fa, 0xfb923c,
];

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

  get activeCamera(): THREE.PerspectiveCamera {
    return this.usingSideCamera ? this.sideCamera : this.camera;
  }

  update(engine: PlayerEngine): void {
    const grid = engine.pit.snapshot();
    this.blockMesh.update(grid, this.colors);

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
