import type { TrackData, NoteEvent, NoiseEvent } from "./scheduler.js";
import type { VoiceParams } from "./sid.js";
import { SidSynth } from "./sid.js";

const BPM = 120;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const TOTAL_BARS = 90;
const LOOP_LENGTH = BAR * TOTAL_BARS;

const NOTE = (freq: number): VoiceParams => ({
  waveform: "triangle",
  frequency: freq,
  attack: 0.005,
  decay: 0.05,
  sustain: 0.5,
  release: 0.08,
  volume: 0.12,
});

const BASS_NOTE = (freq: number): VoiceParams => ({
  waveform: "sawtooth",
  frequency: freq,
  attack: 0.005,
  decay: 0.1,
  sustain: 0.3,
  release: 0.05,
  volume: 0.1,
  detune: 5,
});

const LEAD_NOTE = (freq: number): VoiceParams => ({
  waveform: "square",
  frequency: freq,
  attack: 0.01,
  decay: 0.08,
  sustain: 0.4,
  release: 0.1,
  volume: 0.08,
  detune: 7,
});

const A2 = SidSynth.note(45);
const C3 = SidSynth.note(48);
const E3 = SidSynth.note(52);
const G3 = SidSynth.note(55);
const A3 = SidSynth.note(57);
const C4 = SidSynth.note(60);
const E4 = SidSynth.note(64);
const G4 = SidSynth.note(67);
const A4 = SidSynth.note(69);
const C5 = SidSynth.note(72);
const D5 = SidSynth.note(74);
const E5 = SidSynth.note(76);

const BASS_PATTERN: readonly number[] = [A2, A2, E3, A2, C3, C3, G3, C3];

const ARPEGGIO: readonly number[] = [A3, C4, E4, G4, A4, E4, C4, E4];

const LEAD_MELODY: readonly (number | null)[] = [
  A4,
  null,
  C5,
  E5,
  D5,
  null,
  C5,
  A4,
  null,
  E5,
  D5,
  C5,
  A4,
  null,
  null,
  null,
  G4,
  null,
  A4,
  C5,
  E5,
  D5,
  C5,
  A4,
  null,
  G4,
  E4,
  null,
  A4,
  null,
  null,
  null,
];

const buildNotes = (): NoteEvent[] => {
  const notes: NoteEvent[] = [];
  const bars = Array.from({ length: TOTAL_BARS }, (_, i) => i);

  bars.forEach((bar) => {
    const barTime = bar * BAR;
    const isBridge = bar % 16 >= 12;
    const bassNote = isBridge ? (BASS_PATTERN[bar % 8] ?? A2) : (BASS_PATTERN[bar % 4] ?? A2);

    [0, 1, 2, 3].forEach((beat) => {
      const beatTime = barTime + beat * BEAT;
      notes.push({ time: beatTime, voice: 1, params: BASS_NOTE(bassNote), duration: BEAT * 0.8 });
    });

    [0, 2, 4, 6].forEach((step) => {
      const noteIdx = (bar * 8 + step) % ARPEGGIO.length;
      const freq = ARPEGGIO[noteIdx];
      if (freq) {
        notes.push({
          time: barTime + step * (BEAT / 2),
          voice: 0,
          params: NOTE(freq),
          duration: BEAT * 0.4,
        });
      }
    });

    if (bar % 2 === 0) {
      const melodyStart = (Math.floor(bar / 2) % 2) * 16;
      [0, 1, 2, 3, 4, 5, 6, 7].forEach((step) => {
        const idx = melodyStart + step;
        const note = LEAD_MELODY[idx % LEAD_MELODY.length];
        if (note !== null && note !== undefined) {
          notes.push({
            time: barTime + step * BEAT,
            voice: 2,
            params: LEAD_NOTE(note),
            duration: BEAT * 0.9,
          });
        }
      });
    }

    notes.push({
      time: barTime,
      voice: 3,
      params: {
        waveform: "square",
        frequency: 80,
        attack: 0.001,
        decay: 0.03,
        sustain: 0,
        release: 0.01,
        volume: 0.15,
      },
      duration: 0.05,
    });
    if (bar % 2 === 1) {
      notes.push({
        time: barTime + BEAT * 2,
        voice: 3,
        params: {
          waveform: "square",
          frequency: 120,
          attack: 0.001,
          decay: 0.03,
          sustain: 0,
          release: 0.01,
          volume: 0.1,
        },
        duration: 0.05,
      });
    }
  });

  return notes;
};

const buildNoise = () => {
  const events: NoiseEvent[] = [];
  const totalBeats = TOTAL_BARS * 4;
  Array.from({ length: totalBeats }, (_, i) => i).forEach((beat) => {
    if (beat % 2 === 1) {
      events.push({
        time: beat * BEAT,
        filterFreq: 6000,
        volume: 0.04,
        duration: 0.08,
      });
    }
  });
  return events;
};

const notes = buildNotes();
const noise = buildNoise();

export const TRACK: TrackData = {
  bpm: BPM,
  notes,
  noise,
  loopLength: LOOP_LENGTH,
};
