import * as THREE from "three";
import type { PitView } from "./pitView.js";
import { create, mount } from "../ui/dom.js";

export interface ViewportRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type ViewportCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera;

interface RenderTarget {
  readonly camera: ViewportCamera;
  readonly region: ViewportRegion;
  readonly pitView: PitView;
  readonly isMain: boolean;
  readonly label: string;
}

const MAIN_WIDTH = 0.87;
const SIDE_AREA_WIDTH = 0.13;
const SIDE_GAP = 0.012;
const SIDE_CELL_WIDTH = (SIDE_AREA_WIDTH - SIDE_GAP) / 2;
const SIDE_CELL_HEIGHT = 0.24;
const SIDE_OFFSET_Y = 1 - SIDE_CELL_HEIGHT * 2 - SIDE_GAP;

const SIDE_POSITIONS: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

export class SplitScreenLayout {
  readonly pitViews: readonly PitView[];
  private readonly sideViewMode: boolean;
  private cachedTargets: readonly RenderTarget[] | null = null;
  private readonly labelEls: Map<string, HTMLElement> = new Map<string, HTMLElement>();
  private readonly labelCleanup: (() => void) | null;

  constructor(pitViews: readonly PitView[]) {
    this.pitViews = pitViews;
    this.sideViewMode = pitViews.length === 1;
    this.labelCleanup = this.sideViewMode ? this.createLabels() : null;
  }

  private createLabels(): (() => void) | null {
    const labels = ["Front", "Right", "Left", "Back"];
    const cleanups: (() => void)[] = [];
    labels.forEach((label) => {
      const el = create("div", "bo-side-label");
      el.textContent = label;
      const cleanup = mount(el);
      this.labelEls.set(label, el);
      cleanups.push(cleanup);
    });
    return () => {
      cleanups.forEach((c) => {
        c();
      });
    };
  }

  dispose(): void {
    this.labelCleanup?.();
  }

  private buildTargets(): readonly RenderTarget[] {
    if (this.sideViewMode) {
      const view = this.pitViews[0];
      if (!view) return [];
      const mainRegion: ViewportRegion = { x: 0, y: 0, width: MAIN_WIDTH, height: 1 };
      return [
        { camera: view.activeCamera, region: mainRegion, pitView: view, isMain: true, label: "" },
        ...view.sideCameras.map((cam, i) => {
          const [col, row] = SIDE_POSITIONS[i] ?? [0, 0];
          return {
            camera: cam,
            region: {
              x: MAIN_WIDTH + col * (SIDE_CELL_WIDTH + SIDE_GAP),
              y: SIDE_OFFSET_Y + row * (SIDE_CELL_HEIGHT + SIDE_GAP),
              width: SIDE_CELL_WIDTH,
              height: SIDE_CELL_HEIGHT,
            },
            pitView: view,
            isMain: false,
            label: view.sideLabels[i] ?? "",
          };
        }),
      ];
    }
    return this.pitViews.map((view, i) => ({
      camera: view.activeCamera,
      region: {
        x: i / this.pitViews.length,
        y: 0,
        width: 1 / this.pitViews.length,
        height: 1,
      },
      pitView: view,
      isMain: true,
      label: "",
    }));
  }

  get targets(): readonly RenderTarget[] {
    return (this.cachedTargets ??= this.buildTargets());
  }

  get regions(): readonly ViewportRegion[] {
    return this.targets.map((t) => t.region);
  }

  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    containerWidth: number,
    containerHeight: number,
  ): void {
    renderer.setScissorTest(true);
    this.targets.forEach((target) => {
      const { x: rx, y: ry, width: rw, height: rh } = target.region;

      const x = Math.floor(rx * containerWidth);
      const y = Math.floor(ry * containerHeight);
      const w = Math.floor(rw * containerWidth);
      const h = Math.floor(rh * containerHeight);

      renderer.setViewport(x, y, w, h);
      renderer.setScissor(x, y, w, h);

      if (target.isMain) {
        target.pitView.setAspect(w / h);
        if (this.sideViewMode) {
          const viewportCenter = MAIN_WIDTH / 2;
          const screenCenter = 0.5;
          const ndcShift = ((viewportCenter - screenCenter) / MAIN_WIDTH) * 2;
          target.pitView.setMainViewShift(ndcShift);
        }
      } else {
        target.pitView.setSideAspect(w / h);
      }

      renderer.render(scene, target.camera);

      if (!target.isMain) {
        const labelEl = this.labelEls.get(target.label);
        if (labelEl) {
          const cssTop = containerHeight - y - h;
          labelEl.style.left = `${String(Math.round(x + w / 2))}px`;
          labelEl.style.top = `${String(Math.round(cssTop + 2))}px`;
          labelEl.style.display = "block";
        }
      }
    });
    this.labelEls.forEach((el, key) => {
      const visible = this.targets.some((t) => !t.isMain && t.label === key);
      if (!visible) el.style.display = "none";
    });
    renderer.setScissorTest(false);
  }
}
