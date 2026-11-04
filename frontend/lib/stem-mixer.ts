/**
 * StemMixerEngine - Real-time Web Audio API Dual Stem Separator & Mixer
 *
 * Implements mid/side matrixing and vocal formant filtering:
 *   Mid  = 0.5 * (Left + Right) [Contains center-panned lead vocals & bass]
 *   Side = 0.5 * (Left - Right) [Contains wide stereo guitars, synths, reverb, ambiance]
 *
 * Vocal Stem:
 *   Mid passed through 220Hz highpass & 4200Hz lowpass + vocal presence peak to isolate human voice.
 *
 * Instrumental / Karaoke Stem:
 *   Side signal + lowpassed mono sub-bass (<130Hz) to preserve kick/bass punch while eliminating vocals.
 */

export interface StemMixerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  vocalVolume: number; // 0.0 to 1.5
  instVolume: number; // 0.0 to 1.5
  isVocalMuted: boolean;
  isInstMuted: boolean;
  isVocalSolo: boolean;
  isInstSolo: boolean;
  vocalLevel: number; // 0 to 1 for live meter
  instLevel: number; // 0 to 1 for live meter
}

export class StemMixerEngine {
  private ctx: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;

  // Vocal channel nodes
  private vocalGain: GainNode | null = null;
  private vocalAnalyser: AnalyserNode | null = null;
  private vocalDataArray: Uint8Array | null = null;

  // Instrumental channel nodes
  private instGain: GainNode | null = null;
  private instAnalyser: AnalyserNode | null = null;
  private instDataArray: Uint8Array | null = null;

  // Master Gain
  private masterGain: GainNode | null = null;

  // State
  private isPlaying = false;
  private startedAt = 0;
  private pausedAt = 0;
  private vocalVol = 1.0;
  private instVol = 1.0;
  private vocalMuted = false;
  private instMuted = false;
  private vocalSolo = false;
  private instSolo = false;

  private animFrameId: number | null = null;

  public onStateUpdate?: (state: StemMixerState) => void;

  constructor() {
    // Lazy AudioContext initialization
  }

  private initContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public async loadFile(
    file: File | Blob
  ): Promise<{ duration: number; sampleRate: number; channels: number }> {
    this.stop();
    const ctx = this.initContext();
    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    this.pausedAt = 0;
    this.emitState();

    return {
      duration: this.audioBuffer.duration,
      sampleRate: this.audioBuffer.sampleRate,
      channels: this.audioBuffer.numberOfChannels,
    };
  }

  public get duration(): number {
    return this.audioBuffer ? this.audioBuffer.duration : 0;
  }

  public get playing(): boolean {
    return this.isPlaying;
  }

  public get currentTime(): number {
    if (!this.isPlaying) return this.pausedAt;
    if (!this.ctx) return 0;
    const elapsed = this.ctx.currentTime - this.startedAt;
    return Math.min(this.duration, this.pausedAt + elapsed);
  }

  private buildAudioGraph(offset: number) {
    if (!this.audioBuffer) return;
    const ctx = this.initContext();

    // Recreate source
    this.source = ctx.createBufferSource();
    this.source.buffer = this.audioBuffer;

    const channels = this.audioBuffer.numberOfChannels;
    const splitter = ctx.createChannelSplitter(Math.max(2, channels));
    this.source.connect(splitter);

    // Mid summing: M = 0.5 * (L + R)
    const midSum = ctx.createGain();
    midSum.gain.value = 1.0;

    const gainLtoMid = ctx.createGain();
    gainLtoMid.gain.value = 0.5;
    const gainRtoMid = ctx.createGain();
    gainRtoMid.gain.value = channels > 1 ? 0.5 : 0.5;

    splitter.connect(gainLtoMid, 0);
    gainLtoMid.connect(midSum);

    if (channels > 1) {
      splitter.connect(gainRtoMid, 1);
      gainRtoMid.connect(midSum);
    } else {
      splitter.connect(gainRtoMid, 0);
      gainRtoMid.connect(midSum);
    }

    // Side summing: S = 0.5 * (L - R)
    const sideSum = ctx.createGain();
    sideSum.gain.value = 1.0;

    if (channels > 1) {
      const gainLtoSide = ctx.createGain();
      gainLtoSide.gain.value = 0.5;
      const gainRtoSide = ctx.createGain();
      gainRtoSide.gain.value = -0.5;

      splitter.connect(gainLtoSide, 0);
      gainLtoSide.connect(sideSum);
      splitter.connect(gainRtoSide, 1);
      gainRtoSide.connect(sideSum);
    }

    // === VOCAL CHAIN ===
    // Highpass to eliminate kick & sub bass
    const vocalHighpass = ctx.createBiquadFilter();
    vocalHighpass.type = "highpass";
    vocalHighpass.frequency.value = 220;

    // Lowpass to eliminate extreme treble cymbals & air
    const vocalLowpass = ctx.createBiquadFilter();
    vocalLowpass.type = "lowpass";
    vocalLowpass.frequency.value = 4200;

    // Vocal presence boost at 2500Hz
    const vocalPresence = ctx.createBiquadFilter();
    vocalPresence.type = "peaking";
    vocalPresence.frequency.value = 2500;
    vocalPresence.gain.value = 3.5;
    vocalPresence.Q.value = 1.2;

    this.vocalGain = ctx.createGain();
    this.vocalAnalyser = ctx.createAnalyser();
    this.vocalAnalyser.fftSize = 64;
    this.vocalDataArray = new Uint8Array(this.vocalAnalyser.frequencyBinCount);

    midSum.connect(vocalHighpass);
    vocalHighpass.connect(vocalLowpass);
    vocalLowpass.connect(vocalPresence);
    vocalPresence.connect(this.vocalGain);
    this.vocalGain.connect(this.vocalAnalyser);

    // === INSTRUMENTAL CHAIN ===
    // Sub bass lowpass to preserve bass/kick in karaoke backing track
    const bassRecovery = ctx.createBiquadFilter();
    bassRecovery.type = "lowpass";
    bassRecovery.frequency.value = 120;
    midSum.connect(bassRecovery);

    const instMerger = ctx.createGain();
    instMerger.gain.value = 1.2;

    if (channels > 1) {
      sideSum.connect(instMerger);
    } else {
      // Mono fallback: mild attenuation of vocal range
      const monoNotch = ctx.createBiquadFilter();
      monoNotch.type = "notch";
      monoNotch.frequency.value = 1800;
      monoNotch.Q.value = 0.8;
      midSum.connect(monoNotch);
      monoNotch.connect(instMerger);
    }
    bassRecovery.connect(instMerger);

    this.instGain = ctx.createGain();
    this.instAnalyser = ctx.createAnalyser();
    this.instAnalyser.fftSize = 64;
    this.instDataArray = new Uint8Array(this.instAnalyser.frequencyBinCount);

    instMerger.connect(this.instGain);
    this.instGain.connect(this.instAnalyser);

    // Master bus
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 1.0;

    this.vocalAnalyser.connect(this.masterGain);
    this.instAnalyser.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);

    // Apply gains
    this.applyGains();

    // On ended
    this.source.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.pausedAt = 0;
        this.stopMetering();
        this.emitState();
      }
    };

    const clampedOffset = Math.max(0, Math.min(this.duration, offset));
    this.source.start(0, clampedOffset);
    this.startedAt = ctx.currentTime;
    this.pausedAt = clampedOffset;
    this.isPlaying = true;

    this.startMetering();
  }

  private applyGains() {
    if (!this.vocalGain || !this.instGain) return;

    let effVocal = this.vocalVol;
    let effInst = this.instVol;

    if (this.vocalSolo) {
      effInst = 0;
    } else if (this.instSolo) {
      effVocal = 0;
    } else {
      if (this.vocalMuted) effVocal = 0;
      if (this.instMuted) effInst = 0;
    }

    this.vocalGain.gain.setValueAtTime(effVocal, this.ctx ? this.ctx.currentTime : 0);
    this.instGain.gain.setValueAtTime(effInst, this.ctx ? this.ctx.currentTime : 0);
  }

  public play(offset?: number) {
    if (!this.audioBuffer) return;
    const startPos = offset !== undefined ? offset : this.pausedAt;
    if (this.isPlaying) {
      this.stopSourceOnly();
    }
    this.buildAudioGraph(startPos);
    this.emitState();
  }

  public pause() {
    if (!this.isPlaying) return;
    this.pausedAt = this.currentTime;
    this.stopSourceOnly();
    this.isPlaying = false;
    this.stopMetering();
    this.emitState();
  }

  public stop() {
    this.stopSourceOnly();
    this.isPlaying = false;
    this.pausedAt = 0;
    this.stopMetering();
    this.emitState();
  }

  public seek(seconds: number) {
    const target = Math.max(0, Math.min(this.duration, seconds));
    if (this.isPlaying) {
      this.stopSourceOnly();
      this.buildAudioGraph(target);
    } else {
      this.pausedAt = target;
    }
    this.emitState();
  }

  private stopSourceOnly() {
    if (this.source) {
      try {
        this.source.onended = null;
        this.source.stop();
        this.source.disconnect();
      } catch {
        // already stopped
      }
      this.source = null;
    }
  }

  public setVocalVolume(volume: number) {
    this.vocalVol = Math.max(0, Math.min(1.5, volume));
    this.applyGains();
    this.emitState();
  }

  public setInstrumentalVolume(volume: number) {
    this.instVol = Math.max(0, Math.min(1.5, volume));
    this.applyGains();
    this.emitState();
  }

  public setVocalMuted(muted: boolean) {
    this.vocalMuted = muted;
    if (muted) this.vocalSolo = false;
    this.applyGains();
    this.emitState();
  }

  public setInstrumentalMuted(muted: boolean) {
    this.instMuted = muted;
    if (muted) this.instSolo = false;
    this.applyGains();
    this.emitState();
  }

  public toggleVocalMuted() {
    this.vocalMuted = !this.vocalMuted;
    if (this.vocalMuted) this.vocalSolo = false;
    this.applyGains();
    this.emitState();
  }

  public toggleInstrumentalMuted() {
    this.instMuted = !this.instMuted;
    if (this.instMuted) this.instSolo = false;
    this.applyGains();
    this.emitState();
  }

  public setVocalSolo(solo: boolean) {
    this.vocalSolo = solo;
    if (solo) {
      this.vocalMuted = false;
      this.instSolo = false;
    }
    this.applyGains();
    this.emitState();
  }

  public setInstrumentalSolo(solo: boolean) {
    this.instSolo = solo;
    if (solo) {
      this.instMuted = false;
      this.vocalSolo = false;
    }
    this.applyGains();
    this.emitState();
  }

  private startMetering() {
    this.stopMetering();
    const tick = () => {
      this.emitState();
      if (this.isPlaying) {
        this.animFrameId = requestAnimationFrame(tick);
      }
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private stopMetering() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private computeRmsLevel(analyser: AnalyserNode | null, dataArray: Uint8Array | null): number {
    if (!analyser || !dataArray || !this.isPlaying) return 0;
    analyser.getByteFrequencyData(dataArray as any);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / (dataArray.length * 255);
    return Math.min(1.0, avg * 2.2);
  }

  private emitState() {
    if (!this.onStateUpdate) return;
    const vocalLevel = this.computeRmsLevel(this.vocalAnalyser, this.vocalDataArray);
    const instLevel = this.computeRmsLevel(this.instAnalyser, this.instDataArray);

    this.onStateUpdate({
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      vocalVolume: this.vocalVol,
      instVolume: this.instVol,
      isVocalMuted: this.vocalMuted,
      isInstMuted: this.instMuted,
      isVocalSolo: this.vocalSolo,
      isInstSolo: this.instSolo,
      vocalLevel,
      instLevel,
    });
  }

  /**
   * Generates sample peaks for waveform visualization
   */
  public getWaveformPeaks(bars = 100): { vocalPeaks: number[]; instPeaks: number[] } {
    if (!this.audioBuffer) {
      return {
        vocalPeaks: new Array(bars).fill(0.1),
        instPeaks: new Array(bars).fill(0.1),
      };
    }

    const channelData = this.audioBuffer.getChannelData(0);
    const step = Math.floor(channelData.length / bars);
    const vocalPeaks: number[] = [];
    const instPeaks: number[] = [];

    for (let b = 0; b < bars; b++) {
      let maxVal = 0;
      const start = b * step;
      const end = Math.min(channelData.length, start + step);
      for (let i = start; i < end; i += 10) {
        const abs = Math.abs(channelData[i]);
        if (abs > maxVal) maxVal = abs;
      }
      const clamped = Math.max(0.08, Math.min(1.0, maxVal));
      vocalPeaks.push(clamped * 0.85);
      instPeaks.push(clamped * 1.0);
    }

    return { vocalPeaks, instPeaks };
  }

  /**
   * Render stem offline directly in the browser to WAV format
   */
  public async renderStemOffline(
    stem: "vocals" | "instrumental",
    onProgress?: (pct: number) => void
  ): Promise<Blob> {
    if (!this.audioBuffer) throw new Error("No audio loaded.");

    const OfflineCtx =
      window.OfflineAudioContext ||
      (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
        .webkitOfflineAudioContext;

    const channels = Math.min(2, Math.max(1, this.audioBuffer.numberOfChannels));
    const sampleRate = this.audioBuffer.sampleRate;
    const length = this.audioBuffer.length;

    const offline = new OfflineCtx(channels, length, sampleRate);
    const source = offline.createBufferSource();
    source.buffer = this.audioBuffer;

    const splitter = offline.createChannelSplitter(2);
    source.connect(splitter);

    const midSum = offline.createGain();
    const gainLtoMid = offline.createGain();
    gainLtoMid.gain.value = 0.5;
    const gainRtoMid = offline.createGain();
    gainRtoMid.gain.value = 0.5;

    splitter.connect(gainLtoMid, 0);
    gainLtoMid.connect(midSum);
    if (this.audioBuffer.numberOfChannels > 1) {
      splitter.connect(gainRtoMid, 1);
      gainRtoMid.connect(midSum);
    } else {
      splitter.connect(gainRtoMid, 0);
      gainRtoMid.connect(midSum);
    }

    if (stem === "vocals") {
      const vocalHighpass = offline.createBiquadFilter();
      vocalHighpass.type = "highpass";
      vocalHighpass.frequency.value = 220;

      const vocalLowpass = offline.createBiquadFilter();
      vocalLowpass.type = "lowpass";
      vocalLowpass.frequency.value = 4200;

      const vocalPresence = offline.createBiquadFilter();
      vocalPresence.type = "peaking";
      vocalPresence.frequency.value = 2500;
      vocalPresence.gain.value = 4.0;
      vocalPresence.Q.value = 1.2;

      const vGain = offline.createGain();
      vGain.gain.value = 1.4;

      midSum.connect(vocalHighpass);
      vocalHighpass.connect(vocalLowpass);
      vocalLowpass.connect(vocalPresence);
      vocalPresence.connect(vGain);
      vGain.connect(offline.destination);
    } else {
      // Instrumental
      const sideSum = offline.createGain();
      if (this.audioBuffer.numberOfChannels > 1) {
        const gainLtoSide = offline.createGain();
        gainLtoSide.gain.value = 0.5;
        const gainRtoSide = offline.createGain();
        gainRtoSide.gain.value = -0.5;

        splitter.connect(gainLtoSide, 0);
        gainLtoSide.connect(sideSum);
        splitter.connect(gainRtoSide, 1);
        gainRtoSide.connect(sideSum);
      }

      const bassRecovery = offline.createBiquadFilter();
      bassRecovery.type = "lowpass";
      bassRecovery.frequency.value = 120;
      midSum.connect(bassRecovery);

      const iGain = offline.createGain();
      iGain.gain.value = 1.25;

      sideSum.connect(iGain);
      bassRecovery.connect(iGain);
      iGain.connect(offline.destination);
    }

    source.start(0);

    if (onProgress) onProgress(40);
    const renderedBuffer = await offline.startRendering();
    if (onProgress) onProgress(85);

    const wavBlob = audioBufferToWavBlob(renderedBuffer);
    if (onProgress) onProgress(100);

    return wavBlob;
  }

  public destroy() {
    this.stop();
    if (this.ctx && this.ctx.state !== "closed") {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

/**
 * Encode an AudioBuffer into standard 16-bit PCM WAV Blob
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const numSamples = buffer.length;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF header
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  // fmt subchunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data subchunk
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave samples
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}
