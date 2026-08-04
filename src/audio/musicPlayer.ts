const DEFAULT_VOLUME = 0.8;
const SHORT_FADE_MS = 300;

const shuffle = <T>(arr: readonly T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
};

export interface PlayOptions {
  readonly loop: boolean;
  readonly fadeInMs: number;
}

export class MusicPlayer {
  private readonly ctx: AudioContext;
  private readonly gain: GainNode;
  private audioEl: HTMLAudioElement | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private currentUrl: string | null = null;
  private queue: string[] = [];
  private lastPlayedUrl: string | null = null;
  private playing = false;
  private muted = false;
  private storedVolume = DEFAULT_VOLUME;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(ctx.destination);
  }

  private connectElement(el: HTMLAudioElement): void {
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        /* noop */
      }
      this.source = null;
    }
    this.source = this.ctx.createMediaElementSource(el);
    this.source.connect(this.gain);
  }

  private disposeElement(): void {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.removeAttribute("src");
      this.audioEl.load();
      this.audioEl = null;
    }
  }

  private async fadeTo(target: number, ms: number): Promise<void> {
    const now = this.ctx.currentTime;
    const cur = this.gain.gain.value;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(cur, now);
    this.gain.gain.linearRampToValueAtTime(target, now + ms / 1000);
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async play(url: string, opts: PlayOptions): Promise<void> {
    if (this.currentUrl === url && this.playing) return;
    await this.fadeTo(0, opts.fadeInMs > 0 ? Math.min(opts.fadeInMs, 200) : 0);
    this.disposeElement();

    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.src = url;
    el.loop = opts.loop;
    el.preload = "auto";
    this.connectElement(el);
    this.audioEl = el;
    this.currentUrl = url;
    this.lastPlayedUrl = url;
    this.playing = true;

    if (!opts.loop) {
      el.addEventListener("ended", () => {
        void this.advanceQueue();
      });
    }

    try {
      await el.play();
    } catch {
      this.playing = false;
      return;
    }
    await this.fadeTo(this.muted ? 0 : this.storedVolume, opts.fadeInMs);
  }

  private async advanceQueue(): Promise<void> {
    if (this.queue.length === 0) return;
    if (this.queue.length === 1) {
      const url = this.queue[0];
      if (url) await this.play(url, { loop: false, fadeInMs: SHORT_FADE_MS });
      return;
    }
    if (this.queue.length <= 1) return;
    const shifted = this.queue.shift();
    let next = shifted;
    if (next !== undefined && next === this.lastPlayedUrl) {
      const alt = this.queue.shift();
      if (alt !== undefined) this.queue.push(next);
      next = alt ?? next;
    }
    if (next) {
      if (this.queue.length === 0) this.queue = shuffle(this.allUrls);
      await this.play(next, { loop: false, fadeInMs: SHORT_FADE_MS });
    }
  }

  private allUrls: string[] = [];

  setQueue(urls: readonly string[]): void {
    this.allUrls = [...urls];
    this.queue = shuffle(urls);
  }

  async playNext(fadeInMs: number): Promise<void> {
    if (this.queue.length === 0) {
      if (this.allUrls.length > 0) this.queue = shuffle(this.allUrls);
      else return;
    }
    const next = this.queue.shift();
    if (next) {
      if (this.queue.length === 0 && this.allUrls.length > 0) {
        this.queue = shuffle(this.allUrls);
      }
      await this.play(next, { loop: false, fadeInMs });
    }
  }

  async fadeOut(ms: number): Promise<void> {
    await this.fadeTo(0, ms);
    if (this.audioEl) {
      this.audioEl.pause();
    }
    this.playing = false;
  }

  pause(): void {
    if (this.audioEl) this.audioEl.pause();
  }

  resume(): void {
    if (this.audioEl && this.playing) void this.audioEl.play();
  }

  async stop(): Promise<void> {
    await this.fadeOut(SHORT_FADE_MS);
    this.disposeElement();
    this.currentUrl = null;
    this.playing = false;
    this.queue = [];
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    const now = this.ctx.currentTime;
    const target = muted ? 0 : this.storedVolume;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(target, now + 0.1);
  }

  isPlaying(): boolean {
    return this.playing;
  }

  dispose(): void {
    void this.stop();
    try {
      this.gain.disconnect();
    } catch {
      /* noop */
    }
    this.source = null;
    this.audioEl = null;
    this.allUrls = [];
    this.queue = [];
  }
}
