export type Waveform = "sine" | "square" | "sawtooth" | "triangle";

export interface VoiceParams {
  readonly waveform: Waveform;
  readonly frequency: number;
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
  readonly release: number;
  readonly volume: number;
  readonly detune?: number;
}

export interface FilterParams {
  readonly type: BiquadFilterType;
  readonly frequency: number;
  readonly resonance: number;
}

const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

export class SidSynth {
  private readonly ctx: AudioContext;
  private readonly masterGain: GainNode;
  private readonly sfxGain: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly analyser: AnalyserNode;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.9;

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.9;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 8000;
    this.filter.Q.value = 1;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;

    this.masterGain.connect(this.filter);
    this.filter.connect(this.analyser);
    this.sfxGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);
  }

  playVoice(params: VoiceParams, duration: number, startTime?: number): void {
    this.playVoiceTo(params, duration, startTime, this.masterGain);
  }

  playSfxVoice(params: VoiceParams, duration: number, startTime?: number): void {
    this.playVoiceTo(params, duration, startTime, this.sfxGain);
  }

  private playVoiceTo(
    params: VoiceParams,
    duration: number,
    startTime: number | undefined,
    dest: AudioNode,
  ): void {
    const t = startTime ?? this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = params.waveform;
    osc.frequency.value = params.frequency;
    if (params.detune) osc.detune.value = params.detune;

    const gain = this.ctx.createGain();
    const peak = Math.min(params.volume, 0.9);
    const sustainLevel = peak * params.sustain;

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + params.attack);
    gain.gain.linearRampToValueAtTime(sustainLevel, t + params.attack + params.decay);
    gain.gain.setValueAtTime(sustainLevel, t + duration - params.release);
    gain.gain.linearRampToValueAtTime(0, t + duration);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  playNoise(
    duration: number,
    filterFreq: number,
    volume: number,
    startTime?: number,
    filterType?: BiquadFilterType,
  ): void {
    const t = startTime ?? this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    data.forEach((_, i) => {
      data[i] = Math.random() * 2 - 1;
    });

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = filterType ?? "lowpass";
    noiseFilter.frequency.setValueAtTime(filterFreq, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(
      Math.max(100, filterFreq * 0.1),
      t + duration,
    );

    const gain = this.ctx.createGain();
    const peak = Math.min(volume, 0.9);
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(noiseFilter);
    noiseFilter.connect(gain);
    gain.connect(this.sfxGain);

    source.start(t);
    source.stop(t + duration);
  }

  setMasterVolume(v: number): void {
    this.masterGain.gain.value = Math.min(v, 0.9);
  }

  setFilter(params: FilterParams): void {
    this.filter.type = params.type;
    this.filter.frequency.value = params.frequency;
    this.filter.Q.value = params.resonance;
  }

  scheduleFilter(frequency: number, resonance: number, startTime: number): void {
    this.filter.frequency.setValueAtTime(frequency, startTime);
    this.filter.Q.setValueAtTime(resonance, startTime);
  }

  scheduleFilterSweep(
    fromFreq: number,
    toFreq: number,
    duration: number,
    resonance: number,
    startTime: number,
  ): void {
    const safeFrom = Math.max(20, fromFreq);
    const safeTo = Math.max(20, toFreq);
    this.filter.frequency.setValueAtTime(safeFrom, startTime);
    this.filter.frequency.exponentialRampToValueAtTime(safeTo, startTime + duration);
    this.filter.Q.setValueAtTime(resonance, startTime);
  }

  get currentTime(): number {
    return this.ctx.currentTime;
  }

  get destination(): AudioNode {
    return this.masterGain;
  }

  static note = midiToFreq;
}
