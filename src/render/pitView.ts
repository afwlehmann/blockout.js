import * as THREE from "three";
import type { PlayerEngine } from "../game/engine.js";
import type { PitConfig } from "../game/types.js";
import { BlockMesh, blockGeometry } from "./blockMesh.js";
import { PieceView } from "./pieceView.js";

const PALETTE: readonly number[] = [
  0x0000aa, 0x00aa00, 0x00aaaa, 0xaa0000, 0xaa00aa, 0xaa5500, 0xaaaaaa, 0x555555, 0x5555ff,
  0x55ff55, 0x55ffff, 0xff5555, 0xff55ff, 0xffff55, 0xffffff,
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

interface CrazyWaypoint {
  readonly posOffset: THREE.Vector3;
  readonly quat: THREE.Quaternion;
}

const PARTICLE_COUNT = 8;
const SLIDE_DURATION = 350;

export class PitView {
  readonly group: THREE.Group;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly sideCameras: readonly THREE.OrthographicCamera[];
  readonly sideLabels: readonly string[];
  private readonly config: PitConfig;
  private readonly blockMesh: BlockMesh;
  private readonly colors: THREE.Color[];
  private pieceView: PieceView | null = null;
  private readonly walls: THREE.Group;
  private gridLines: THREE.LineSegments | null = null;
  private readonly solidGridMat: THREE.LineBasicMaterial;
  private readonly dashedGridMat: THREE.LineDashedMaterial;
  private readonly sideCamera: THREE.PerspectiveCamera;
  private usingSideCamera = false;
  private crazyMode = false;
  private crazySegTime = 0;
  private crazySegIndex = 0;
  private crazySegDuration = 4;
  private crazyElapsed = 0;
  private readonly crazyMinSegDuration = 1.5;
  private readonly crazyStartSegDuration = 4;
  private readonly crazyRampUpTime = 30;
  private crazyWaypoints: CrazyWaypoint[] = [];
  private baseMainPos = new THREE.Vector3();
  private baseMainQuat = new THREE.Quaternion();
  private baseSidePos = new THREE.Vector3();
  private baseSideQuat = new THREE.Quaternion();
  private pitCenter = new THREE.Vector3();
  private shakeTime = 0;
  private shakeIntensity = 0;
  private readonly particles: Particle[] = [];
  private slideAnim: SlideAnim | null = null;
  private readonly dirArrows: THREE.Group[];
  private readonly dirLabels: THREE.Sprite[];
  onSlideComplete: (() => void) | null = null;

  constructor(config: PitConfig, originX: number, scene: THREE.Scene) {
    this.config = config;
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.x = originX;
    this.scene.add(this.group);

    this.colors = PALETTE.map((c) => new THREE.Color(c));

    this.solidGridMat = new THREE.LineBasicMaterial({
      color: 0x808080,
      transparent: true,
      opacity: 0.5,
    });
    this.dashedGridMat = new THREE.LineDashedMaterial({
      color: 0x808080,
      transparent: true,
      opacity: 0.5,
      dashSize: 0.15,
      gapSize: 0.1,
    });

    const aspect = 1;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200);
    this.sideCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200);
    this.sideCameras = this.buildSideCameras();
    this.sideLabels = ["Front", "Right", "Left", "Back"];
    this.positionCameras();
    const { width: w0, depth: d0, height: h0 } = this.config;
    this.pitCenter.set(this.group.position.x + (w0 - 1) / 2, h0 * 0.3, (d0 - 1) / 2);
    this.baseMainPos.copy(this.camera.position);
    this.baseMainQuat.copy(this.camera.quaternion);
    this.baseSidePos.copy(this.sideCamera.position);
    this.baseSideQuat.copy(this.sideCamera.quaternion);

    this.blockMesh = new BlockMesh(config, PALETTE.length);
    this.blockMesh.mesh.castShadow = true;
    this.blockMesh.mesh.receiveShadow = true;
    this.group.add(this.blockMesh.mesh);
    this.group.add(this.blockMesh.edgeObject);

    this.walls = this.buildWalls();
    this.group.add(this.walls);

    const { arrows, labels } = this.buildDirArrows();
    this.dirArrows = arrows;
    this.dirLabels = labels;
    arrows.forEach((a) => this.group.add(a));
    labels.forEach((l) => this.group.add(l));
    this.updateDirArrowsVisibility();
  }

  private buildDirArrows(): { arrows: THREE.Group[]; labels: THREE.Sprite[] } {
    const { width: w, depth: d, height: h } = this.config;
    const cx = this.group.position.x + (w - 1) / 2;
    const cz = (d - 1) / 2;
    const y = -0.4;
    const arrowLen = 1.2;
    const offset = 1.5;

    const makeArrow = (dir: THREE.Vector3, pos: THREE.Vector3): THREE.Group => {
      const grp = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 8), mat);
      cone.position.copy(dir.clone().multiplyScalar(arrowLen * 0.5));
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, arrowLen * 0.7, 8), mat);
      shaft.position.copy(dir.clone().multiplyScalar(arrowLen * 0.25));
      shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      grp.add(cone);
      grp.add(shaft);
      grp.position.copy(pos);
      return grp;
    };

    const makeLabel = (text: string, pos: THREE.Vector3): THREE.Sprite => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "rgba(56, 189, 248, 0.9)";
        ctx.font = "bold 36px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, 64, 32);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.position.copy(pos);
      sprite.scale.set(1.5, 0.75, 1);
      return sprite;
    };

    const dirs: { dir: THREE.Vector3; pos: THREE.Vector3; label: string }[] = [
      {
        dir: new THREE.Vector3(-1, 0, 0),
        pos: new THREE.Vector3(cx - w / 2 - offset, y, cz),
        label: "H",
      },
      {
        dir: new THREE.Vector3(1, 0, 0),
        pos: new THREE.Vector3(cx + w / 2 + offset, y, cz),
        label: "L",
      },
      {
        dir: new THREE.Vector3(0, 0, -1),
        pos: new THREE.Vector3(cx, y, cz - d / 2 - offset),
        label: "K",
      },
      {
        dir: new THREE.Vector3(0, 0, 1),
        pos: new THREE.Vector3(cx, y, cz + d / 2 + offset),
        label: "J",
      },
    ];

    const arrows = dirs.map((d) => makeArrow(d.dir, d.pos));
    const labels = dirs.map((d) =>
      makeLabel(d.label, d.pos.clone().add(new THREE.Vector3(0, 0.8, 0))),
    );
    void h;
    return { arrows, labels };
  }

  private updateDirArrowsVisibility(): void {
    const visible = this.crazyMode;
    this.dirArrows.forEach((a) => {
      a.visible = visible;
    });
    this.dirLabels.forEach((l) => {
      l.visible = visible;
    });
  }

  private buildSideCameras(): THREE.OrthographicCamera[] {
    const { width: w, depth: d, height: h } = this.config;
    const cx = this.group.position.x + (w - 1) / 2;
    const cy = h / 2;
    const cz = (d - 1) / 2;
    const halfW = w / 2 + 1;
    const halfD = d / 2 + 1;
    const halfH = h / 2 + 1;
    const dist = Math.max(w, d, h) * 2;

    const make = (x: number, y: number, z: number, horiz: number): THREE.OrthographicCamera => {
      const cam = new THREE.OrthographicCamera(-horiz, horiz, halfH, -halfH, 0.1, dist * 2);
      cam.position.set(x, y, z);
      cam.lookAt(cx, cy, cz);
      return cam;
    };

    return [
      make(cx, cy, cz + dist, halfW),
      make(cx + dist, cy, cz, halfD),
      make(cx - dist, cy, cz, halfD),
      make(cx, cy, cz - dist, halfW),
    ];
  }

  private positionCameras(): void {
    const { width: w, depth: d, height: h } = this.config;
    const cx = this.group.position.x + (w - 1) / 2;
    const cy = h / 2;
    const cz = (d - 1) / 2;

    const mainDist = Math.max(w, d) * 4.0;
    this.camera.position.set(cx, mainDist, cz);
    this.camera.lookAt(cx, 0, cz);

    const sideDist = Math.max(w, d, h) * 1.8;
    const sideHoriz = sideDist * 0.7;
    const sideAngle = (35 * Math.PI) / 180;
    this.sideCamera.position.set(
      cx + sideHoriz * Math.sin(sideAngle),
      cy + sideDist * 0.5,
      cz + sideHoriz * Math.cos(sideAngle),
    );
    this.sideCamera.lookAt(cx, h * 0.45, cz);
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
      color: 0x3a4055,
      roughness: 0.95,
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

    this.addWallGrid(group, this.solidGridMat, w, d, h);

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
    const line = new THREE.LineSegments(edges, edgeMat);
    line.position.set(cx, h / 2 - 0.5, cz);
    group.add(line);

    return group;
  }

  private addWallGrid(
    group: THREE.Group,
    mat: THREE.LineBasicMaterial,
    w: number,
    d: number,
    h: number,
  ): void {
    const pts: THREE.Vector3[] = [];
    const z0 = -0.5;
    const z1 = d - 0.5;
    const x0 = -0.5;
    const x1 = w - 0.5;
    const y0 = -0.5;
    const y1 = h - 0.5;

    for (let gx = 0; gx <= w; gx++) {
      const x = x0 + gx;
      pts.push(new THREE.Vector3(x, y0, z0), new THREE.Vector3(x, y1, z0));
      pts.push(new THREE.Vector3(x, y0, z1), new THREE.Vector3(x, y1, z1));
      pts.push(new THREE.Vector3(x, y0 + 0.01, z0), new THREE.Vector3(x, y0 + 0.01, z1));
    }
    for (let gy = 0; gy <= h; gy++) {
      const y = y0 + gy;
      pts.push(new THREE.Vector3(x0, y, z0), new THREE.Vector3(x1, y, z0));
      pts.push(new THREE.Vector3(x0, y, z1), new THREE.Vector3(x1, y, z1));
      pts.push(new THREE.Vector3(x0, y, z0), new THREE.Vector3(x0, y, z1));
      pts.push(new THREE.Vector3(x1, y, z0), new THREE.Vector3(x1, y, z1));
    }
    for (let gz = 0; gz <= d; gz++) {
      const z = z0 + gz;
      pts.push(new THREE.Vector3(x0, y0, z), new THREE.Vector3(x0, y1, z));
      pts.push(new THREE.Vector3(x1, y0, z), new THREE.Vector3(x1, y1, z));
      pts.push(new THREE.Vector3(x0, y0 + 0.01, z), new THREE.Vector3(x1, y0 + 0.01, z));
    }

    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const grid = new THREE.LineSegments(geom, this.solidGridMat);
    this.gridLines = grid;
    group.add(grid);
  }

  toggleCamera(): void {
    this.usingSideCamera = !this.usingSideCamera;
    if (this.gridLines) {
      if (this.usingSideCamera) {
        this.gridLines.material = this.dashedGridMat;
        this.gridLines.computeLineDistances();
      } else {
        this.gridLines.material = this.solidGridMat;
      }
    }
  }

  setCrazyMode(enabled: boolean): void {
    this.crazyMode = enabled;
    if (enabled) {
      this.crazySegIndex = 1;
      this.crazySegTime = 0;
      this.crazyElapsed = 0;
      this.crazySegDuration = this.crazyStartSegDuration;
      this.crazyWaypoints = [];
      const baseWaypoint: CrazyWaypoint = {
        posOffset: this.baseMainPos.clone().sub(this.pitCenter),
        quat: new THREE.Quaternion(),
      };
      this.crazyWaypoints.push(baseWaypoint);
      for (let i = 0; i < 6; i++) {
        this.crazyWaypoints.push(this.makeRandomWaypoint());
      }
    } else {
      this.camera.position.copy(this.baseMainPos);
      this.camera.quaternion.copy(this.baseMainQuat);
      this.sideCamera.position.copy(this.baseSidePos);
      this.sideCamera.quaternion.copy(this.baseSideQuat);
      this.crazyWaypoints = [];
      this.crazySegIndex = 0;
      this.crazySegTime = 0;
      this.crazyElapsed = 0;
    }
    this.updateDirArrowsVisibility();
  }

  private makeRandomWaypoint(): CrazyWaypoint {
    const MAX_ANGLE = 0.35;
    const radius = Math.max(this.config.width, this.config.depth) * 4.0;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.45;
    const posOffset = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * radius,
      Math.cos(phi) * radius * 0.3,
      Math.sin(phi) * Math.sin(theta) * radius,
    );
    const axis = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
    ).normalize();
    const angle = (Math.random() * 2 - 1) * MAX_ANGLE;
    const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    return { posOffset, quat };
  }

  private crazyInterpolate(
    segIndex: number,
    segT: number,
  ): {
    pos: THREE.Vector3;
    quat: THREE.Quaternion;
  } {
    const wps = this.crazyWaypoints;
    const n = wps.length;
    if (n < 2) {
      const wp = wps[0];
      return {
        pos: wp ? wp.posOffset.clone() : new THREE.Vector3(),
        quat: wp ? wp.quat.clone() : new THREE.Quaternion(),
      };
    }
    const i0 = Math.max(0, Math.min(segIndex - 1, n - 1));
    const i1 = Math.max(0, Math.min(segIndex, n - 1));
    const i2 = Math.max(0, Math.min(segIndex + 1, n - 1));
    const i3 = Math.max(0, Math.min(segIndex + 2, n - 1));
    const p0 = wps[i0] ?? wps[i1];
    const p1 = wps[i1] ?? wps[0];
    const p2 = wps[i2] ?? p1;
    const p3 = wps[i3] ?? p2;
    if (!p0 || !p1 || !p2 || !p3) {
      return { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
    }
    const t2 = segT * segT;
    const t3 = t2 * segT;
    const pos = new THREE.Vector3();
    pos.x =
      0.5 *
      (2 * p1.posOffset.x +
        (-p0.posOffset.x + p2.posOffset.x) * segT +
        (2 * p0.posOffset.x - 5 * p1.posOffset.x + 4 * p2.posOffset.x - p3.posOffset.x) * t2 +
        (-p0.posOffset.x + 3 * p1.posOffset.x - 3 * p2.posOffset.x + p3.posOffset.x) * t3);
    pos.y =
      0.5 *
      (2 * p1.posOffset.y +
        (-p0.posOffset.y + p2.posOffset.y) * segT +
        (2 * p0.posOffset.y - 5 * p1.posOffset.y + 4 * p2.posOffset.y - p3.posOffset.y) * t2 +
        (-p0.posOffset.y + 3 * p1.posOffset.y - 3 * p2.posOffset.y + p3.posOffset.y) * t3);
    pos.z =
      0.5 *
      (2 * p1.posOffset.z +
        (-p0.posOffset.z + p2.posOffset.z) * segT +
        (2 * p0.posOffset.z - 5 * p1.posOffset.z + 4 * p2.posOffset.z - p3.posOffset.z) * t2 +
        (-p0.posOffset.z + 3 * p1.posOffset.z - 3 * p2.posOffset.z + p3.posOffset.z) * t3);
    const targetRadius = Math.max(this.config.width, this.config.depth) * 4.0;
    const minRadius = targetRadius * 0.9;
    const posLen = pos.length();
    if (posLen > 0.001) {
      const minLen = Math.max(posLen, minRadius);
      pos.multiplyScalar(minLen / posLen);
    }
    const smoothT = segT * segT * (3 - 2 * segT);
    const quat = new THREE.Quaternion().slerpQuaternions(p1.quat, p2.quat, smoothT);
    return { pos, quat };
  }

  private static readonly CAM_FORWARD = new THREE.Vector3(0, 0, -1);
  private static readonly WORLD_UP = new THREE.Vector3(0, 1, 0);

  private lookAtQuat(fromPos: THREE.Vector3, target: THREE.Vector3): THREE.Quaternion {
    const m = new THREE.Matrix4();
    m.lookAt(fromPos, target, PitView.WORLD_UP);
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }

  private updateCrazy(dt: number): void {
    if (!this.crazyMode || this.crazyWaypoints.length < 4) return;
    const dtSec = dt / 1000;
    this.crazyElapsed += dtSec;
    this.crazySegTime += dtSec;
    if (this.crazySegTime >= this.crazySegDuration) {
      this.crazySegTime -= this.crazySegDuration;
      this.crazyWaypoints.shift();
      this.crazyWaypoints.push(this.makeRandomWaypoint());
    }
    const rampProgress = Math.min(this.crazyElapsed / this.crazyRampUpTime, 1);
    const easedRamp = rampProgress * rampProgress * (3 - 2 * rampProgress);
    this.crazySegDuration =
      this.crazyStartSegDuration +
      (this.crazyMinSegDuration - this.crazyStartSegDuration) * easedRamp;
    const segT = this.crazySegTime / this.crazySegDuration;
    const { pos, quat } = this.crazyInterpolate(this.crazySegIndex, segT);
    const mainPos = this.pitCenter.clone().add(pos);
    this.camera.position.copy(mainPos);
    const baseLook = this.lookAtQuat(mainPos, this.pitCenter);
    this.camera.quaternion.copy(baseLook.multiply(quat));
    const sidePos = this.baseSidePos.clone().add(pos.clone().multiplyScalar(0.5));
    this.sideCamera.position.copy(sidePos);
    const sideLook = this.lookAtQuat(sidePos, this.pitCenter);
    this.sideCamera.quaternion.copy(sideLook.multiply(quat));
  }

  triggerShake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTime = 0;
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
          const colorHex = colorIdx;
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
    this.updateCrazy(dt);
    this.updateParticles(dt);
    this.updateSlide(dt);
    this.updateShake(dt);
  }

  private updateShake(dt: number): void {
    const dtSec = dt / 1000;
    const SHAKE_DURATION = 0.4;
    if (this.shakeIntensity <= 0) return;
    this.shakeTime += dtSec;
    if (this.shakeTime >= SHAKE_DURATION) {
      this.shakeIntensity = 0;
      this.group.position.y = 0;
      this.group.position.z = 0;
      return;
    }
    const decay = 1 - this.shakeTime / SHAKE_DURATION;
    const mag = this.shakeIntensity * decay;
    this.group.position.y = (Math.random() - 0.5) * mag;
    this.group.position.z = (Math.random() - 0.5) * mag;
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

  setMainViewShift(shift: number): void {
    const m = this.camera.projectionMatrix.elements;
    m[8] = shift;
  }

  setSideViewShift(shift: number): void {
    const m = this.sideCamera.projectionMatrix.elements;
    m[8] = shift;
  }

  applyViewShift(shift: number): void {
    if (this.usingSideCamera) {
      this.setSideViewShift(shift);
    } else {
      this.setMainViewShift(shift);
    }
  }

  setSideAspect(aspect: number): void {
    const { width: w, depth: d, height: h } = this.config;
    const halfH = h / 2 + 1;
    const halfW = w / 2 + 1;
    const halfD = d / 2 + 1;
    const horizDims = [halfW, halfD, halfD, halfW];
    this.sideCameras.forEach((cam, i) => {
      const baseHoriz = horizDims[i] ?? halfW;
      const horiz = Math.max(baseHoriz, baseHoriz * aspect);
      cam.left = -horiz;
      cam.right = horiz;
      cam.top = halfH;
      cam.bottom = -halfH;
      cam.updateProjectionMatrix();
    });
  }

  dispose(): void {
    this.scene.remove(this.group);
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
