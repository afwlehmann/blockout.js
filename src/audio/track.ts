import type { TrackData, NoteEvent, NoiseEvent, FilterEvent } from "./scheduler.js";
import type { VoiceParams } from "./sid.js";
import { SidSynth } from "./sid.js";

const BPM = 130;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const TOTAL_BARS = 96;
const LOOP_LENGTH = BAR * TOTAL_BARS;

const ARP = (freq: number): VoiceParams => ({
  waveform: "square",
  frequency: freq,
  attack: 0.002,
  decay: 0.03,
  sustain: 0.2,
  release: 0.02,
  volume: 0.07,
});

const BASS = (freq: number): VoiceParams => ({
  waveform: "sawtooth",
  frequency: freq,
  attack: 0.003,
  decay: 0.06,
  sustain: 0.4,
  release: 0.03,
  volume: 0.13,
  detune: 4,
});

const LEAD = (freq: number): VoiceParams => ({
  waveform: "square",
  frequency: freq,
  attack: 0.008,
  decay: 0.06,
  sustain: 0.5,
  release: 0.08,
  volume: 0.09,
  detune: 6,
});

const KICK = (): VoiceParams => ({
  waveform: "sine",
  frequency: 55,
  attack: 0.001,
  decay: 0.08,
  sustain: 0,
  release: 0.02,
  volume: 0.25,
});

const A2 = SidSynth.note(45);
const E2 = SidSynth.note(40);
const F2 = SidSynth.note(41);
const C2 = SidSynth.note(36);
const G2 = SidSynth.note(43);
const D2 = SidSynth.note(38);
const A3 = SidSynth.note(57);
const C4 = SidSynth.note(60);
const D4 = SidSynth.note(62);
const E4 = SidSynth.note(64);
const F4 = SidSynth.note(65);
const G4 = SidSynth.note(67);
const Bb4 = SidSynth.note(70);
const A4 = SidSynth.note(69);
const C5 = SidSynth.note(72);
const D5 = SidSynth.note(74);
const E5 = SidSynth.note(76);
const F5 = SidSynth.note(77);
const G5 = SidSynth.note(79);
const Bb3 = SidSynth.note(58);
const Bb5 = SidSynth.note(82);

const BASS_CYCLE: readonly (readonly number[])[] = [
  [A2, A2, E2, A2, A2, A2, E2, A2],
  [F2, F2, C2, F2, G2, G2, D2, G2],
];
const BASS_CYCLE_BRIDGE: readonly (readonly number[])[] = [
  [A2, E2, A2, E2, A2, E2, A2, E2],
  [F2, C2, F2, C2, G2, D2, G2, D2],
];

const ARP_AM: readonly number[] = [A3, C4, E4, A4, E4, C4, A3, E4];
const ARP_F: readonly number[] = [F4, A4, C5, F5, C5, A4, F4, C5];
const ARP_G: readonly number[] = [G4, Bb4, D5, G5, D5, Bb4, G4, D5];
const ARP_E: readonly number[] = [E4, G4, Bb3, E5, Bb3, G4, E4, Bb3];
const ARP_CYCLE: readonly (readonly number[])[] = [ARP_AM, ARP_F, ARP_G, ARP_E];

const LEAD_MELODY: readonly (readonly (number | null)[])[] = [
  [A4, null, C5, D5, E5, null, D5, C5, Bb4, null, A4, G4, F4, null, E4, D4],
  [C5, null, Bb4, A4, G4, null, A4, Bb4, A4, null, null, null, E5, null, D5, C5],
  [A4, null, E5, F5, E5, null, D5, C5, Bb4, null, A4, G4, F4, null, E4, null],
  [D5, null, C5, Bb4, A4, null, G4, A4, Bb4, null, C5, D5, E5, null, null, null],
];

const buildNotes = (): NoteEvent[] => {
  const notes: NoteEvent[] = [];
  const bars = Array.from({ length: TOTAL_BARS }, (_, i) => i);

  bars.forEach((bar) => {
    const barTime = bar * BAR;
    const section = Math.floor(bar / 24);
    const isBridge = section === 1;
    const isBreakdown = section === 3;
    const leadActive = section === 0 || section === 2 || (isBreakdown && bar >= 88);

    const bassPattern = isBridge ? BASS_CYCLE_BRIDGE : BASS_CYCLE;
    const bassRow = bassPattern[bar % 2] ?? BASS_CYCLE[0] ?? [A2, A2, E2, A2, A2, A2, E2, A2];

    if (!isBreakdown || bar < 84) {
      for (let i = 0; i < 8; i++) {
        const freq = bassRow[i];
        if (freq) {
          notes.push({
            time: barTime + i * (BEAT / 2),
            voice: 1,
            params: BASS(freq),
            duration: BEAT * 0.45,
          });
        }
      }
    }

    if (!isBreakdown || bar >= 84) {
      const arpPattern = ARP_CYCLE[bar % 4] ?? ARP_AM;
      for (let i = 0; i < 16; i++) {
        const freq = arpPattern[i % arpPattern.length];
        if (freq) {
          notes.push({
            time: barTime + i * (BEAT / 4),
            voice: 0,
            params: ARP(freq),
            duration: BEAT * 0.22,
          });
        }
      }
    }

    if (leadActive) {
      const leadIdx = bar % 4;
      const melody = LEAD_MELODY[leadIdx] ?? LEAD_MELODY[0] ?? [A4];
      for (let i = 0; i < 16; i++) {
        const note = melody[i];
        if (note !== null && note !== undefined) {
          notes.push({
            time: barTime + i * (BEAT / 4),
            voice: 2,
            params: LEAD(note),
            duration: BEAT * 0.9,
          });
        }
      }
    }

    notes.push({
      time: barTime,
      voice: 3,
      params: KICK(),
      duration: 0.15,
    });
    notes.push({
      time: barTime + BEAT * 2,
      voice: 3,
      params: KICK(),
      duration: 0.15,
    });
  });

  return notes;
};

const buildNoise = (): NoiseEvent[] => {
  const events: NoiseEvent[] = [];
  const totalEighth = TOTAL_BARS * 8;

  for (let i = 0; i < totalEighth; i++) {
    const time = i * (BEAT / 2);
    const beatInBar = i % 8;

    if (beatInBar === 1 || beatInBar === 5) {
      events.push({
        time: time,
        filterFreq: 3000,
        volume: 0.12,
        duration: 0.12,
      });
    }

    events.push({
      time: time,
      filterFreq: 8000,
      volume: 0.03,
      duration: 0.04,
    });
  }

  return events;
};

const buildFilter = (): FilterEvent[] => {
  const events: FilterEvent[] = [];

  events.push({
    time: 0,
    frequency: 8000,
    resonance: 2,
  });

  events.push({
    time: 24 * BAR,
    frequency: 8000,
    resonance: 8,
    sweepTo: 2000,
    sweepDuration: 2 * BAR,
  });

  events.push({
    time: 36 * BAR,
    frequency: 2000,
    resonance: 8,
    sweepTo: 8000,
    sweepDuration: 2 * BAR,
  });

  events.push({
    time: 48 * BAR,
    frequency: 8000,
    resonance: 2,
  });

  events.push({
    time: 72 * BAR,
    frequency: 8000,
    resonance: 10,
    sweepTo: 1500,
    sweepDuration: 2 * BAR,
  });

  events.push({
    time: 84 * BAR,
    frequency: 1500,
    resonance: 10,
    sweepTo: 8000,
    sweepDuration: 4 * BAR,
  });

  return events;
};

const notes = buildNotes();
const noise = buildNoise();
const filter = buildFilter();

void Bb5;

export const TRACK: TrackData = {
  bpm: BPM,
  notes,
  noise,
  filter,
  loopLength: LOOP_LENGTH,
};
