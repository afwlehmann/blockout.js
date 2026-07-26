import { SidSynth } from "./sid.js";
import { Scheduler } from "./scheduler.js";
import { TRACK } from "./track.js";
import { Sfx, type SfxType } from "./sfx.js";

const SFX_KEY = "blockout.sfxMuted";
const MUSIC_KEY = "blockout.musicMuted";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private synth: SidSynth | null = null;
  private scheduler: Scheduler | null = null;
  private sfx: Sfx | null = null;
  private sfxMuted = false;
  private musicMuted = false;
  private musicPlaying = false;

  constructor() {
    this.sfxMuted = localStorage.getItem(SFX_KEY) === "1";
    this.musicMuted = localStorage.getItem(MUSIC_KEY) === "1";
  }

  private ensureContext(): void {
    if (this.ctx) return;
    const w = window as unknown as {
      AudioContext: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = w.AudioContext;
    this.ctx = new Ctor();
    this.synth = new SidSynth(this.ctx);
    this.scheduler = new Scheduler(this.synth, TRACK);
    this.sfx = new Sfx(this.synth);
    this.sfx.setEnabled(!this.sfxMuted);
  }

  async resume(): Promise<void> {
    this.ensureContext();
    if (this.ctx?.state === "suspended") {
      await this.ctx.resume();
    }
  }

  async suspend(): Promise<void> {
    if (this.ctx?.state === "running") {
      await this.ctx.suspend();
    }
  }

  startMusic(): void {
    this.ensureContext();
    if (this.musicMuted || this.musicPlaying || !this.scheduler) return;
    this.musicPlaying = true;
    this.scheduler.start();
  }

  stopMusic(): void {
    if (!this.scheduler) return;
    this.musicPlaying = false;
    this.scheduler.stop();
  }

  playSfx(type: SfxType, intensity = 0): void {
    this.ensureContext();
    this.sfx?.play(type, intensity);
  }

  toggleSfx(): boolean {
    this.sfxMuted = !this.sfxMuted;
    localStorage.setItem(SFX_KEY, this.sfxMuted ? "1" : "0");
    this.sfx?.setEnabled(!this.sfxMuted);
    return !this.sfxMuted;
  }

  toggleMusic(): boolean {
    this.musicMuted = !this.musicMuted;
    localStorage.setItem(MUSIC_KEY, this.musicMuted ? "1" : "0");
    if (this.musicMuted) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
    return !this.musicMuted;
  }

  isSfxMuted(): boolean {
    return this.sfxMuted;
  }

  isMusicMuted(): boolean {
    return this.musicMuted;
  }

  dispose(): void {
    this.stopMusic();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.synth = null;
      this.scheduler = null;
      this.sfx = null;
    }
  }
}
