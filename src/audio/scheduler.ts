import type { SidSynth } from "./sid.js";
import type { VoiceParams } from "./sid.js";

export interface NoteEvent {
  readonly time: number;
  readonly voice: number;
  readonly params: VoiceParams;
  readonly duration: number;
}

export interface NoiseEvent {
  readonly time: number;
  readonly filterFreq: number;
  readonly volume: number;
  readonly duration: number;
}

export interface TrackData {
  readonly bpm: number;
  readonly notes: readonly NoteEvent[];
  readonly noise: readonly NoiseEvent[];
  readonly loopLength: number;
}

export class Scheduler {
  private readonly synth: SidSynth;
  private readonly track: TrackData;
  private nextNoteIndex = 0;
  private nextNoiseIndex = 0;
  private loopStart = 0;
  private readonly lookahead = 0.1;
  private timerId: number | null = null;
  private running = false;

  constructor(synth: SidSynth, track: TrackData) {
    this.synth = synth;
    this.track = track;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loopStart = this.synth.currentTime + 0.05;
    this.nextNoteIndex = 0;
    this.nextNoiseIndex = 0;
    this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private tick = (): void => {
    if (!this.running) return;
    const now = this.synth.currentTime;
    const horizon = now + this.lookahead;

    while (this.nextNoteIndex < this.track.notes.length) {
      const note = this.track.notes[this.nextNoteIndex];
      if (!note) break;
      const noteTime = this.loopStart + note.time;
      if (noteTime > horizon) break;
      this.synth.playVoice(note.params, note.duration, noteTime);
      this.nextNoteIndex++;
    }

    while (this.nextNoiseIndex < this.track.noise.length) {
      const event = this.track.noise[this.nextNoiseIndex];
      if (!event) break;
      const eventTime = this.loopStart + event.time;
      if (eventTime > horizon) break;
      this.synth.playNoise(event.duration, event.filterFreq, event.volume, eventTime);
      this.nextNoiseIndex++;
    }

    if (
      this.nextNoteIndex >= this.track.notes.length &&
      this.nextNoiseIndex >= this.track.noise.length
    ) {
      this.loopStart += this.track.loopLength;
      this.nextNoteIndex = 0;
      this.nextNoiseIndex = 0;
    }

    this.timerId = window.setTimeout(this.tick, 25);
  };
}
