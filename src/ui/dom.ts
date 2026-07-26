export interface UiElement {
  readonly el: HTMLElement;
  dispose(): void;
}

const ensureRoot = (): HTMLElement => {
  const root = document.getElementById("ui-root");
  if (root) return root;
  const created = document.createElement("div");
  created.id = "ui-root";
  document.body.appendChild(created);
  return created;
};

export function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

export const mount = (el: HTMLElement): (() => void) => {
  const root = ensureRoot();
  root.appendChild(el);
  return () => {
    root.removeChild(el);
  };
};

export const setText = (el: HTMLElement, text: string): void => {
  el.textContent = text;
};

export const injectStyles = (): void => {
  if (document.getElementById("blockout-styles")) return;
  const style = document.createElement("style");
  style.id = "blockout-styles";
  style.textContent = `
    #ui-root {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 100;
      font-family: system-ui, -apple-system, sans-serif;
      color: #e5e7eb;
    }
    #ui-root > * {
      pointer-events: auto;
    }
    .bo-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(10, 10, 15, 0.85);
      backdrop-filter: blur(1.5px);
      z-index: 200;
    }
    .bo-panel {
      background: rgba(30, 41, 59, 0.95);
      border: 1px solid rgba(100, 116, 139, 0.3);
      border-radius: 16px;
      padding: 2.5rem 3rem;
      max-width: 520px;
      width: 90%;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
    }
    .bo-title {
      font-size: 2.5rem;
      font-weight: 800;
      margin: 0 0 0.5rem;
      background: linear-gradient(135deg, #38bdf8, #a78bfa);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.02em;
    }
    .bo-subtitle {
      font-size: 0.95rem;
      color: #94a3b8;
      margin: 0 0 2rem;
    }
    .bo-section {
      margin-bottom: 1.75rem;
    }
    .bo-section-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
      margin-bottom: 0.5rem;
    }
    .bo-options {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .bo-btn {
      background: rgba(51, 65, 85, 0.6);
      border: 1px solid rgba(100, 116, 139, 0.3);
      color: #cbd5e1;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
    }
    .bo-btn:hover {
      background: rgba(71, 85, 105, 0.8);
      border-color: rgba(148, 163, 184, 0.5);
    }
    .bo-btn.active {
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.3), rgba(167, 139, 250, 0.3));
      border-color: rgba(56, 189, 248, 0.5);
      color: #f1f5f9;
    }
    .bo-btn-primary {
      background: linear-gradient(135deg, #38bdf8, #6366f1);
      border: none;
      color: #fff;
      font-weight: 600;
      padding: 0.75rem 2rem;
      font-size: 1.1rem;
      border-radius: 10px;
      width: 100%;
      margin-top: 0.5rem;
    }
    .bo-btn-primary:hover {
      filter: brightness(1.1);
    }
    .bo-gameover-buttons {
      display: flex;
      gap: 1rem;
    }
    .bo-gameover-buttons .bo-btn,
    .bo-gameover-buttons .bo-btn-primary {
      flex: 1 1 0;
      width: auto;
      padding: 0.6rem 1.5rem;
      font-size: 1rem;
      margin-top: 0;
    }
    .bo-hud {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
    }
    .bo-hud-top {
      position: absolute;
      top: 0; left: 0; right: 0;
      display: flex;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      pointer-events: auto;
    }
    .bo-hud-controls {
      position: absolute;
      bottom: 1rem;
      left: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      pointer-events: auto;
    }
    .bo-side-label {
      position: absolute;
      transform: translateX(-50%);
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
      background: rgba(15, 23, 42, 0.7);
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      pointer-events: none;
      display: none;
      z-index: 50;
    }
    .bo-hud-player {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(100, 116, 139, 0.2);
      border-radius: 10px;
      padding: 0.6rem 1rem;
      min-width: 140px;
      backdrop-filter: blur(6px);
    }
    .bo-hud-player.right {
      text-align: right;
    }
    .bo-hud-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
    }
    .bo-hud-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: #f1f5f9;
    }
    .bo-level-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .bo-hud-player.right .bo-level-row {
      flex-direction: row-reverse;
    }
    .bo-level-bar {
      flex: 1;
      height: 6px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 999px;
      overflow: hidden;
    }
    .bo-level-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #38bdf8, #a78bfa);
      border-radius: 999px;
      transition: width 0.3s ease;
    }
    .bo-hud-player.right .bo-level-bar-fill {
      margin-left: auto;
    }
    .bo-icon-btn {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(100, 116, 139, 0.2);
      border-radius: 8px;
      padding: 0.4rem 0.6rem;
      cursor: pointer;
      font-size: 1.1rem;
      color: #e5e7eb;
      transition: all 0.15s;
    }
    .bo-icon-btn:hover {
      border-color: rgba(148, 163, 184, 0.5);
    }
    .bo-icon-btn.off {
      opacity: 0.4;
    }
    .bo-result-score {
      font-size: 2rem;
      font-weight: 800;
      color: #fbbf24;
      margin: 0.5rem 0;
    }
    .bo-result-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
    }
    .bo-result-row {
      display: flex;
      justify-content: space-between;
      padding: 0.4rem 0;
      border-bottom: 1px solid rgba(100, 116, 139, 0.15);
    }
    .bo-result-row:last-child {
      border-bottom: none;
    }
    .bo-result-val {
      font-weight: 600;
      color: #e2e8f0;
    }
    .bo-winner {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }
    .bo-gameover-panel {
      max-height: 90vh;
      overflow-y: auto;
      max-width: 460px;
      padding: 1.5rem 2rem;
    }
    .bo-stat-grid {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      margin: 0.5rem 0;
    }
    .bo-stat-cell-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
    }
    .bo-stat-cell-value {
      font-size: 1rem;
      font-weight: 600;
      color: #e2e8f0;
    }
    .bo-name-row {
      display: flex;
      gap: 0.5rem;
      margin: 0.75rem 0;
      align-items: center;
    }
    .bo-name-input {
      flex: 1;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(100, 116, 139, 0.3);
      border-radius: 8px;
      padding: 0.4rem 0.6rem;
      color: #e5e7eb;
      font-size: 0.9rem;
      font-family: inherit;
      outline: none;
    }
    .bo-name-input:focus {
      border-color: rgba(56, 189, 248, 0.5);
    }
    .bo-name-input:disabled {
      opacity: 0.5;
    }
    .bo-name-save {
      width: auto;
      padding: 0.4rem 1rem;
      font-size: 0.85rem;
      margin-top: 0;
    }
    .bo-name-save:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .bo-hs-section {
      margin-top: 1rem;
      text-align: left;
    }
    .bo-hs-list {
      max-height: 180px;
      overflow-y: auto;
      margin-top: 0.5rem;
    }
    .bo-hs-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.3rem 0;
      border-bottom: 1px solid rgba(100, 116, 139, 0.1);
    }
    .bo-hs-row:last-child {
      border-bottom: none;
    }
    .bo-hs-rank {
      font-size: 0.75rem;
      color: #64748b;
      min-width: 1.5rem;
    }
    .bo-hs-name {
      flex: 1;
      font-size: 0.85rem;
      color: #e2e8f0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bo-hs-score {
      font-size: 0.85rem;
      font-weight: 600;
      color: #fbbf24;
    }
    .bo-preview {
      display: block;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(100, 116, 139, 0.2);
      border-radius: 6px;
      margin-top: 0.25rem;
    }
    .bo-remap {
      margin-top: 1rem;
    }
    .bo-remap-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.4rem 1rem;
      max-height: 300px;
      overflow-y: auto;
      padding-right: 0.5rem;
    }
    .bo-remap-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }
    .bo-remap-label {
      font-size: 0.75rem;
      color: #94a3b8;
    }
    .bo-remap-btn {
      min-width: 80px;
      text-align: center;
      font-size: 0.8rem;
      padding: 0.3rem 0.5rem;
    }
    .bo-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .bo-tab {
      background: rgba(51, 65, 85, 0.4);
      border: 1px solid rgba(100, 116, 139, 0.2);
      color: #64748b;
      padding: 0.3rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8rem;
      font-family: inherit;
    }
    .bo-tab.active {
      background: rgba(56, 189, 248, 0.2);
      border-color: rgba(56, 189, 248, 0.4);
      color: #f1f5f9;
    }
    .bo-remap-grid-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }
    @media (max-width: 600px) {
      .bo-remap-grid-2col {
        grid-template-columns: 1fr;
      }
    }
    .bo-credit {
      position: fixed;
      bottom: 0.75rem;
      right: 1.25rem;
      font-size: 0.7rem;
      color: #475569;
      font-family: system-ui, -apple-system, sans-serif;
      pointer-events: none;
      z-index: 201;
      opacity: 0.7;
    }
  `;
  document.head.appendChild(style);
};
