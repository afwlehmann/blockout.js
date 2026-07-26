import type { SidSynth } from "./sid.js";

export type SfxType =
  | "move"
  | "rotate"
  | "drop"
  | "lock"
  | "clear1"
  | "clear2"
  | "clear3"
  | "clear4"
  | "levelUp"
  | "attack"
  | "gameOver"
  | "thud"
  | "rumble";

const MINOR_CHORD: readonly [number, number, number] = [0, 3, 7];
const MAJOR_CHORD: readonly [number, number, number] = [0, 4, 7];
const ROOT_MIDI = 57;

const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

const CAP_GAIN_DB = 12;
const dbToGain = (db: number): number => Math.pow(10, db / 20);

export class Sfx {
  private readonly synth: SidSynth;
  private enabled = true;

  constructor(synth: SidSynth) {
    this.synth = synth;
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  play(type: SfxType, intensity = 0): void {
    if (!this.enabled) return;
    switch (type) {
      case "move":
        this.move();
        break;
      case "rotate":
        this.rotate();
        break;
      case "drop":
        this.drop();
        break;
      case "lock":
        this.lock();
        break;
      case "clear1":
        this.clear(1, intensity);
        break;
      case "clear2":
        this.clear(2, intensity);
        break;
      case "clear3":
        this.clear(3, intensity);
        break;
      case "clear4":
        this.clear(4, intensity);
        break;
      case "levelUp":
        this.levelUp();
        break;
      case "attack":
        this.attack();
        break;
      case "thud":
        this.thud(intensity);
        break;
      case "rumble":
        this.rumble(intensity);
        break;
      case "gameOver":
        this.gameOver();
        break;
    }
  }

  private move(): void {
    const t = this.synth.currentTime;
    this.synth.playSfxVoice(
      {
        waveform: "square",
        frequency: 440,
        attack: 0.001,
        decay: 0.015,
        sustain: 0,
        release: 0.008,
        volume: 0.04,
      },
      0.03,
      t,
    );
    this.synth.playSfxVoice(
      {
        waveform: "square",
        frequency: 880,
        attack: 0.001,
        decay: 0.01,
        sustain: 0,
        release: 0.005,
        volume: 0.02,
        detune: 3,
      },
      0.02,
      t,
    );
  }

  private rotate(): void {
    const t = this.synth.currentTime;
    [0, 0.02, 0.04].forEach((offset, i) => {
      const freqs = [523, 659, 784];
      const freq = freqs[i] ?? 523;
      this.synth.playSfxVoice(
        {
          waveform: "square",
          frequency: freq,
          attack: 0.001,
          decay: 0.02,
          sustain: 0,
          release: 0.01,
          volume: 0.05,
        },
        0.04,
        t + offset,
      );
    });
  }

  private drop(): void {
    const t = this.synth.currentTime;
    this.synth.playSfxVoice(
      {
        waveform: "sawtooth",
        frequency: 150,
        attack: 0.001,
        decay: 0.1,
        sustain: 0,
        release: 0.05,
        volume: 0.15,
      },
      0.15,
      t,
    );
    this.synth.playNoise(0.1, 2000, 0.1, t);
  }

  private lock(): void {
    const t = this.synth.currentTime;
    this.synth.playSfxVoice(
      {
        waveform: "square",
        frequency: 100,
        attack: 0.001,
        decay: 0.05,
        sustain: 0,
        release: 0.02,
        volume: 0.12,
      },
      0.08,
      t,
    );
    this.synth.playNoise(0.06, 800, 0.08, t);
  }

  private clear(n: number, intensity: number): void {
    const t = this.synth.currentTime;
    const chordType = n >= 3 ? MAJOR_CHORD : MINOR_CHORD;
    const baseMidi = ROOT_MIDI + n * 2;
    const gain = Math.min(dbToGain(intensity * 2), dbToGain(CAP_GAIN_DB));

    chordType.forEach((interval, i) => {
      const freq = midiToFreq(baseMidi + interval);
      this.synth.playSfxVoice(
        {
          waveform: "triangle",
          frequency: freq,
          attack: 0.005,
          decay: 0.1,
          sustain: 0.3,
          release: 0.3,
          volume: 0.15 * gain,
        },
        0.5 + n * 0.1,
        t + i * 0.02,
      );
    });

    this.synth.playSfxVoice(
      {
        waveform: "sawtooth",
        frequency: midiToFreq(baseMidi - 12),
        attack: 0.005,
        decay: 0.2,
        sustain: 0.2,
        release: 0.3,
        volume: 0.1 * gain,
      },
      0.6 + n * 0.1,
      t,
    );

    this.synth.playNoise(0.1 + n * 0.05, 400 + n * 200, 0.1 * gain, t);

    if (n >= 3) {
      this.synth.playNoise(0.3, 200, 0.15 * gain, t + 0.05);
    }
  }

  private levelUp(): void {
    const t = this.synth.currentTime;
    [0, 4, 7, 12].forEach((interval, i) => {
      const freq = midiToFreq(ROOT_MIDI + interval);
      this.synth.playSfxVoice(
        {
          waveform: "square",
          frequency: freq,
          attack: 0.005,
          decay: 0.08,
          sustain: 0.3,
          release: 0.1,
          volume: 0.1,
        },
        0.2,
        t + i * 0.08,
      );
    });
  }

  private attack(): void {
    const t = this.synth.currentTime;
    this.synth.playSfxVoice(
      {
        waveform: "sawtooth",
        frequency: 80,
        attack: 0.001,
        decay: 0.3,
        sustain: 0,
        release: 0.2,
        volume: 0.2,
      },
      0.5,
      t,
    );
    this.synth.playNoise(0.4, 1500, 0.2, t);
    this.synth.playSfxVoice(
      {
        waveform: "square",
        frequency: 60,
        attack: 0.005,
        decay: 0.2,
        sustain: 0.2,
        release: 0.3,
        volume: 0.15,
      },
      0.6,
      t + 0.1,
    );
  }

  private gameOver(): void {
    const t = this.synth.currentTime;
    const descending = [0, -2, -4, -7, -12];
    descending.forEach((interval, i) => {
      const freq = midiToFreq(ROOT_MIDI + interval);
      this.synth.playSfxVoice(
        {
          waveform: "triangle",
          frequency: freq,
          attack: 0.01,
          decay: 0.1,
          sustain: 0.3,
          release: 0.2,
          volume: 0.12,
        },
        0.3,
        t + i * 0.15,
      );
    });
    this.synth.playNoise(0.8, 300, 0.15, t);
  }

  private thud(intensity: number): void {
    const t = this.synth.currentTime;
    const layers = Math.max(1, intensity);
    const baseFreq = 60 + layers * 10;
    this.synth.playSfxVoice(
      {
        waveform: "sine",
        frequency: baseFreq,
        attack: 0.001,
        decay: 0.15,
        sustain: 0,
        release: 0.1,
        volume: 0.3,
      },
      0.25,
      t,
    );
    this.synth.playSfxVoice(
      {
        waveform: "sawtooth",
        frequency: baseFreq * 0.5,
        attack: 0.001,
        decay: 0.08,
        sustain: 0,
        release: 0.05,
        volume: 0.1,
      },
      0.15,
      t,
    );
    this.synth.playNoise(0.15, 200 + layers * 50, 0.12, t);
  }

  private rumble(intensity: number): void {
    const t = this.synth.currentTime;
    const dropDistance = Math.max(1, intensity);
    const vol = Math.min(0.1 + dropDistance * 0.012, 0.25);
    const dur = Math.min(0.2 + dropDistance * 0.03, 0.6);
    const freq = 35;
    this.synth.playSfxVoice(
      {
        waveform: "sawtooth",
        frequency: freq,
        attack: 0.005,
        decay: dur * 0.5,
        sustain: 0.2,
        release: dur * 0.5,
        volume: vol,
      },
      dur,
      t,
    );
    this.synth.playSfxVoice(
      {
        waveform: "sine",
        frequency: freq * 0.5,
        attack: 0.005,
        decay: dur * 0.4,
        sustain: 0.1,
        release: dur * 0.6,
        volume: vol * 0.8,
      },
      dur,
      t,
    );
    this.synth.playNoise(dur, 150 + dropDistance * 20, vol * 0.6, t);
  }
}
