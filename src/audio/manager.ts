import { SidSynth } from "./sid.js";
import { Sfx, type SfxType } from "./sfx.js";
import { MusicPlayer } from "./musicPlayer.js";

const SFX_KEY = "blockout.sfxMuted";
const MUSIC_KEY = "blockout.musicMuted";

const base = import.meta.env.BASE_URL;
const MENU_URL = `${base}blockout-bricks-1.mp3`;
const GAME_URLS: readonly string[] = [`${base}blockout-bricks-2.mp3`];
const FADE_MS = 500;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private synth: SidSynth | null = null;
  private music: MusicPlayer | null = null;
  private sfx: Sfx | null = null;
  private sfxMuted = false;
  private musicMuted = false;
  private menuMusicPlaying = false;

  constructor() {
    this.sfxMuted = localStorage.getItem(SFX_KEY) === "1";
    this.musicMuted = localStorage.getItem(MUSIC_KEY) === "1";
  }

  private ensureContext(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.synth = new SidSynth(this.ctx);
    this.music = new MusicPlayer(this.ctx);
    this.music.setMuted(this.musicMuted);
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

  async startMenuMusic(): Promise<void> {
    this.ensureContext();
    if (this.musicMuted || this.menuMusicPlaying || !this.music) return;
    this.menuMusicPlaying = true;
    await this.music.play(MENU_URL, { loop: true, fadeInMs: FADE_MS });
  }

  async transitionToGameMusic(): Promise<void> {
    this.ensureContext();
    if (!this.music) return;
    this.menuMusicPlaying = false;
    await this.music.fadeOut(FADE_MS);
    this.music.setQueue(GAME_URLS);
    await this.music.playNext(FADE_MS);
  }

  async stopMusic(): Promise<void> {
    if (!this.music) return;
    this.menuMusicPlaying = false;
    await this.music.stop();
  }

  pauseMusic(): void {
    this.music?.pause();
  }

  resumeMusic(): void {
    if (this.musicMuted) return;
    this.music?.resume();
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
    this.music?.setMuted(this.musicMuted);
    return !this.musicMuted;
  }

  isSfxMuted(): boolean {
    return this.sfxMuted;
  }

  isMusicMuted(): boolean {
    return this.musicMuted;
  }

  async dispose(): Promise<void> {
    await this.stopMusic();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.synth = null;
      this.music = null;
      this.sfx = null;
    }
  }
}
