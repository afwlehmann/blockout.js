import type { TrackData, NoteEvent, NoiseEvent, FilterEvent } from "./scheduler.js";
import type { VoiceParams } from "./sid.js";
import { SidSynth } from "./sid.js";

const BPM = 100;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const SIXTEENTH = BEAT / 4;
const EIGHTH = BEAT / 2;
const TOTAL_BARS = 64;
const LOOP_LENGTH = BAR * TOTAL_BARS;

const RIFF = (freq: number): VoiceParams => ({
  waveform: "sawtooth",
  frequency: freq,
  attack: 0.002,
  decay: 0.04,
  sustain: 0.15,
  release: 0.03,
  volume: 0.18,
  detune: 7,
});

const SUB_BASS = (freq: number): VoiceParams => ({
  waveform: "sine",
  frequency: freq,
  attack: 0.02,
  decay: 0.1,
  sustain: 0.85,
  release: 0.15,
  volume: 0.26,
});

const LEAD = (freq: number): VoiceParams => ({
  waveform: "square",
  frequency: freq,
  attack: 0.003,
  decay: 0.04,
  sustain: 0.3,
  release: 0.06,
  volume: 0.1,
  detune: 10,
});

const KICK = (): VoiceParams => ({
  waveform: "sine",
  frequency: 45,
  attack: 0.001,
  decay: 0.06,
  sustain: 0,
  release: 0.02,
  volume: 0.3,
});

const SNARE = (): VoiceParams => ({
  waveform: "triangle",
  frequency: 200,
  attack: 0.001,
  decay: 0.04,
  sustain: 0,
  release: 0.03,
  volume: 0.15,
});

const TOM_HIGH = (): VoiceParams => ({
  waveform: "sine",
  frequency: 220,
  attack: 0.002,
  decay: 0.1,
  sustain: 0,
  release: 0.06,
  volume: 0.22,
});

const TOM_MID = (): VoiceParams => ({
  waveform: "sine",
  frequency: 150,
  attack: 0.002,
  decay: 0.12,
  sustain: 0,
  release: 0.08,
  volume: 0.22,
});

const TOM_LOW = (): VoiceParams => ({
  waveform: "sine",
  frequency: 90,
  attack: 0.002,
  decay: 0.16,
  sustain: 0,
  release: 0.1,
  volume: 0.24,
});

const E1 = SidSynth.note(28);
const F1 = SidSynth.note(29);
const Fs1 = SidSynth.note(30);
const B1 = SidSynth.note(35);
const C2 = SidSynth.note(36);
const Cs2 = SidSynth.note(37);
const D2 = SidSynth.note(38);
const Ds2 = SidSynth.note(39);
const E2 = SidSynth.note(40);
const F2 = SidSynth.note(41);
const Fs2 = SidSynth.note(42);
const G2 = SidSynth.note(43);
const Gs2 = SidSynth.note(44);
const A2 = SidSynth.note(45);
const B2 = SidSynth.note(47);
const C3 = SidSynth.note(48);
const D3 = SidSynth.note(50);
const E3 = SidSynth.note(52);
const F3 = SidSynth.note(53);
const G3 = SidSynth.note(55);
const A3 = SidSynth.note(57);
const B3 = SidSynth.note(59);
const D4 = SidSynth.note(62);
const E4 = SidSynth.note(64);
const F4 = SidSynth.note(65);
const G4 = SidSynth.note(67);

const RIFF_A: readonly number[] = [E2, E2, E2, E2, E2, E2, Fs2, G2, E2, E2, E2, E2, B1, B1, B1, B1];
const RIFF_B: readonly number[] = [
  C2,
  C2,
  C2,
  Cs2,
  D2,
  D2,
  Ds2,
  E2,
  F2,
  F2,
  F2,
  F2,
  Fs2,
  G2,
  Gs2,
  A2,
];
const RIFF_C: readonly number[] = [
  B1,
  B1,
  B1,
  B1,
  C2,
  Cs2,
  D2,
  Ds2,
  E2,
  E2,
  F2,
  Fs2,
  G2,
  G2,
  G2,
  G2,
];
const RIFF_D: readonly number[] = [
  E2,
  E2,
  G2,
  E2,
  E2,
  Ds2,
  E2,
  F2,
  Fs2,
  Fs2,
  Fs2,
  Fs2,
  G2,
  A2,
  B2,
  C3,
];

const RIFF_PATTERNS: readonly (readonly number[])[] = [RIFF_A, RIFF_B, RIFF_C, RIFF_D];

const SUB_ROOTS: readonly (readonly number[])[] = [
  [E1, E1, E1, E1],
  [F1, F1, F1, F1],
  [B1, B1, B1, B1],
  [E1, E1, E1, E1],
];

const LEAD_PHRASES: readonly (readonly (number | null)[])[] = [
  [E4, null, D4, null, C3, null, B2, null, A2, null, G2, null, Fs2, null, E2, null],
  [F4, E4, D4, C3, B2, A2, G2, Fs2, E2, null, Fs2, G2, A2, null, B2, null],
  [G4, F4, E4, D4, C3, B2, A2, G2, Fs2, null, E2, null, D2, null, C2, null],
  [E4, D4, C3, B2, A2, G2, Fs2, E2, B2, D3, E3, F3, G3, A3, B3, D4],
];

const getDrumStyle = (bar: number, section: number): "none" | "half" | "full" | "blast" => {
  if (section === 0) {
    if (bar < 4) return "none";
    if (bar < 8) return "half";
    return "full";
  }
  if (section === 1) {
    return bar % 4 === 3 ? "half" : "none";
  }
  if (section === 2) {
    return bar % 4 === 3 ? "blast" : "full";
  }
  if (bar < 56) return "none";
  if (bar < 60) return "half";
  if (bar < 62) return "none";
  return "blast";
};

const addKickPattern = (notes: NoteEvent[], barTime: number, style: string): void => {
  if (style === "half") {
    [0, 2].forEach((b) => {
      notes.push({ time: barTime + b * BEAT, voice: 3, params: KICK(), duration: 0.12 });
    });
    notes.push({ time: barTime + BEAT, voice: 3, params: SNARE(), duration: 0.1 });
    notes.push({ time: barTime + BEAT * 3, voice: 3, params: SNARE(), duration: 0.1 });
  } else if (style === "full") {
    [0, 1, 2, 3].forEach((b) => {
      notes.push({ time: barTime + b * BEAT, voice: 3, params: KICK(), duration: 0.12 });
      notes.push({
        time: barTime + b * BEAT + SIXTEENTH * 3,
        voice: 3,
        params: KICK(),
        duration: 0.08,
      });
    });
    notes.push({ time: barTime + BEAT, voice: 3, params: SNARE(), duration: 0.1 });
    notes.push({ time: barTime + BEAT * 3, voice: 3, params: SNARE(), duration: 0.1 });
  } else if (style === "blast") {
    for (let i = 0; i < 16; i++) {
      notes.push({ time: barTime + i * SIXTEENTH, voice: 3, params: KICK(), duration: 0.06 });
      if (i % 2 === 1) {
        notes.push({ time: barTime + i * SIXTEENTH, voice: 3, params: SNARE(), duration: 0.05 });
      }
    }
  }
};

const addTomFill = (notes: NoteEvent[], barTime: number, bar: number): void => {
  const fillLen = Math.min(4, bar - 55);
  const toms: (() => VoiceParams)[] = [TOM_LOW, TOM_MID, TOM_HIGH];
  for (let i = 0; i < fillLen * 6; i++) {
    const tomFn = toms[i % 3] ?? TOM_LOW;
    notes.push({
      time: barTime + (i * SIXTEENTH * 2) / Math.max(1, fillLen),
      voice: 3,
      params: tomFn(),
      duration: 0.15,
    });
  }
};

const addDropImpact = (notes: NoteEvent[], barTime: number): void => {
  notes.push({ time: barTime, voice: 3, params: KICK(), duration: 0.8 });
  notes.push({ time: barTime, voice: 1, params: SUB_BASS(E1), duration: BEAT * 4 });
  notes.push({ time: barTime, voice: 2, params: RIFF(E2), duration: BEAT * 4 });
  notes.push({ time: barTime + BEAT * 2, voice: 3, params: KICK(), duration: 0.3 });
  notes.push({ time: barTime + BEAT * 2.5, voice: 3, params: KICK(), duration: 0.2 });
  notes.push({ time: barTime + BEAT * 3, voice: 3, params: KICK(), duration: 0.2 });
};

const buildNotes = (): NoteEvent[] => {
  const notes: NoteEvent[] = [];
  const bars = Array.from({ length: TOTAL_BARS }, (_, i) => i);

  bars.forEach((bar) => {
    const barTime = bar * BAR;
    const section = Math.floor(bar / 16);
    const isBreakdown = section === 3;
    const isIntro = section === 0 && bar < 4;
    const leadActive = section === 2 || (isBreakdown && bar >= 62);

    if (!isBreakdown || bar >= 60) {
      const subRow = SUB_ROOTS[bar % SUB_ROOTS.length] ?? SUB_ROOTS[0] ?? [E1];
      for (let i = 0; i < subRow.length; i++) {
        const freq = subRow[i];
        if (freq) {
          notes.push({
            time: barTime + i * BEAT,
            voice: 1,
            params: SUB_BASS(freq),
            duration: BEAT * 0.98,
          });
        }
      }
    }

    if (!isIntro && (!isBreakdown || bar >= 60)) {
      const riffPattern = RIFF_PATTERNS[bar % RIFF_PATTERNS.length] ?? RIFF_A;
      for (let i = 0; i < riffPattern.length; i++) {
        const freq = riffPattern[i];
        if (freq) {
          notes.push({
            time: barTime + i * EIGHTH,
            voice: 2,
            params: RIFF(freq),
            duration: EIGHTH * 0.9,
          });
        }
      }
    }

    if (leadActive) {
      const phraseIdx = bar % LEAD_PHRASES.length;
      const phrase = LEAD_PHRASES[phraseIdx] ?? LEAD_PHRASES[0] ?? [E4];
      for (let i = 0; i < phrase.length; i++) {
        const note = phrase[i];
        if (note !== null && note !== undefined) {
          notes.push({
            time: barTime + i * SIXTEENTH,
            voice: 0,
            params: LEAD(note),
            duration: SIXTEENTH * 1.8,
          });
        }
      }
    }

    const drumStyle = getDrumStyle(bar, section);
    if (drumStyle !== "none") {
      addKickPattern(notes, barTime, drumStyle);
    }

    if (isBreakdown && bar >= 56) {
      addTomFill(notes, barTime, bar);
    }
    if (isBreakdown && bar === 59) {
      addDropImpact(notes, barTime);
    }
  });

  return notes;
};

const HIGHPASS: BiquadFilterType = "highpass";

const buildNoise = (): NoiseEvent[] => {
  const events: NoiseEvent[] = [];
  const totalSixteenths = TOTAL_BARS * 16;

  for (let i = 0; i < totalSixteenths; i++) {
    const time = i * SIXTEENTH;
    const beatInBar = i % 16;
    const bar = Math.floor(i / 16);
    const section = Math.floor(bar / 16);
    const isBreakdown = section === 3;
    const isIntro = section === 0 && bar < 4;

    if (isIntro) continue;
    if (isBreakdown && bar < 56) continue;

    if (beatInBar === 4 || beatInBar === 12) {
      const snareVol = isBreakdown && bar >= 60 ? 0.18 : 0.15;
      events.push({
        time: time,
        filterFreq: 2500,
        volume: snareVol,
        duration: 0.1,
        filterType: HIGHPASS,
      });
    }

    if (bar % 4 === 0 && beatInBar === 0 && section !== 1) {
      const crashVol = isBreakdown && bar === 60 ? 0.24 : 0.1;
      events.push({
        time: time,
        filterFreq: 10000,
        volume: crashVol,
        duration: 0.6,
      });
    }

    const drumStyle = getDrumStyle(bar, section);
    if (drumStyle === "blast" && beatInBar % 2 === 1) {
      events.push({
        time: time,
        filterFreq: 2200,
        volume: 0.12,
        duration: 0.06,
        filterType: HIGHPASS,
      });
    }

    if (drumStyle !== "none" && beatInBar % 4 === 0) {
      events.push({
        time: time,
        filterFreq: 7000,
        volume: 0.03,
        duration: 0.03,
      });
    }
  }

  return events;
};

const buildFilter = (): FilterEvent[] => {
  const events: FilterEvent[] = [];

  events.push({ time: 0, frequency: 7000, resonance: 3 });

  events.push({
    time: 16 * BAR,
    frequency: 7000,
    resonance: 8,
    sweepTo: 1500,
    sweepDuration: 2 * BAR,
  });

  events.push({
    time: 28 * BAR,
    frequency: 1500,
    resonance: 8,
    sweepTo: 8000,
    sweepDuration: 2 * BAR,
  });

  events.push({ time: 32 * BAR, frequency: 8000, resonance: 2 });

  events.push({
    time: 48 * BAR,
    frequency: 8000,
    resonance: 10,
    sweepTo: 1000,
    sweepDuration: 2 * BAR,
  });

  events.push({
    time: 56 * BAR,
    frequency: 8000,
    resonance: 14,
    sweepTo: 100,
    sweepDuration: 4 * BAR,
  });

  events.push({
    time: 60 * BAR,
    frequency: 100,
    resonance: 14,
    sweepTo: 9000,
    sweepDuration: 1 * BAR,
  });

  events.push({ time: 61 * BAR, frequency: 9000, resonance: 2 });

  return events;
};

const notes = buildNotes();
const noise = buildNoise();
const filter = buildFilter();

export const TRACK: TrackData = {
  bpm: BPM,
  notes,
  noise,
  filter,
  loopLength: LOOP_LENGTH,
};
