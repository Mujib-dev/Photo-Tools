import type { VoicePreset } from "./types";
import { getVoiceCharacter } from "./voice-presets";

export class WebAudioVoicePreview {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private gainNode: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private feedbackGain: GainNode | null = null;

  private isPlaying = false;
  private startedAt = 0;
  private pausedAt = 0;
  private timerId: number | null = null;

  public onStateChange?: (playing: boolean, currentTime: number, duration: number) => void;

  constructor() {
    // Lazy AudioContext initialization on first user interaction
  }

  private initContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public async loadFile(file: File | Blob): Promise<AudioBuffer> {
    this.stop();
    const ctx = this.initContext();
    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    this.pausedAt = 0;
    this.emitUpdate();
    return this.audioBuffer;
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

  public play(
    preset: VoicePreset = "none",
    customPitch?: number,
    customSpeed?: number,
    customReverb?: number,
    startOffset?: number,
  ) {
    if (!this.audioBuffer) return;
    const ctx = this.initContext();

    if (this.isPlaying) {
      this.stopSourceOnly();
    }

    const charConfig = getVoiceCharacter(preset);
    const pitchSemitones = customPitch ?? charConfig.pitchShift;
    const speedFactor = customSpeed ?? charConfig.speed;
    const reverbMix = customReverb ?? charConfig.reverb;

    // Source node
    this.source = ctx.createBufferSource();
    this.source.buffer = this.audioBuffer;

    // Pitch scaling via playbackRate: 2^(semitones / 12) * speed
    const pitchRatio = Math.pow(2, pitchSemitones / 12);
    this.source.playbackRate.value = Math.max(0.2, Math.min(4.0, pitchRatio * speedFactor));

    // Master Gain
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 1.0;

    // Character Biquad Filter
    this.filterNode = ctx.createBiquadFilter();
    switch (preset) {
      case "girl":
        this.filterNode.type = "peaking";
        this.filterNode.frequency.value = 3200;
        this.filterNode.gain.value = 4;
        break;
      case "man":
        this.filterNode.type = "lowshelf";
        this.filterNode.frequency.value = 220;
        this.filterNode.gain.value = 6;
        break;
      case "baby":
        this.filterNode.type = "highpass";
        this.filterNode.frequency.value = 350;
        break;
      case "monster":
        this.filterNode.type = "lowpass";
        this.filterNode.frequency.value = 2500;
        break;
      case "radio":
        this.filterNode.type = "bandpass";
        this.filterNode.frequency.value = 1800;
        this.filterNode.Q.value = 1.2;
        break;
      case "robot":
        this.filterNode.type = "peaking";
        this.filterNode.frequency.value = 1200;
        this.filterNode.gain.value = 12;
        this.filterNode.Q.value = 8;
        break;
      case "studio":
        this.filterNode.type = "highshelf";
        this.filterNode.frequency.value = 4000;
        this.filterNode.gain.value = 3;
        break;
      default:
        this.filterNode.type = "allpass";
        break;
    }

    // Connect source -> filter -> gain -> destination
    this.source.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);
    this.gainNode.connect(ctx.destination);

    // Optional Echo / Delay routing
    if (reverbMix > 0 || preset === "echo") {
      this.delayNode = ctx.createDelay();
      this.delayNode.delayTime.value = preset === "echo" ? 0.35 : 0.2;
      this.feedbackGain = ctx.createGain();
      this.feedbackGain.gain.value = Math.min(0.65, Math.max(0.1, reverbMix * 0.7));

      this.filterNode.connect(this.delayNode);
      this.delayNode.connect(this.feedbackGain);
      this.feedbackGain.connect(this.delayNode);
      this.delayNode.connect(ctx.destination);
    }

    const offset = startOffset !== undefined ? startOffset : this.pausedAt;
    const safeOffset = Math.max(0, Math.min(offset, this.duration - 0.05));

    this.source.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.pausedAt = 0;
        this.clearTimer();
        this.emitUpdate();
      }
    };

    this.source.start(0, safeOffset);
    this.startedAt = ctx.currentTime;
    this.pausedAt = safeOffset;
    this.isPlaying = true;
    this.startTimer();
    this.emitUpdate();
  }

  public pause() {
    if (!this.isPlaying) return;
    this.pausedAt = this.currentTime;
    this.stopSourceOnly();
    this.isPlaying = false;
    this.clearTimer();
    this.emitUpdate();
  }

  public stop() {
    this.stopSourceOnly();
    this.pausedAt = 0;
    this.isPlaying = false;
    this.clearTimer();
    this.emitUpdate();
  }

  public seek(timeSeconds: number) {
    const wasPlaying = this.isPlaying;
    this.stopSourceOnly();
    this.pausedAt = Math.max(0, Math.min(timeSeconds, this.duration));
    if (wasPlaying) {
      this.play();
    } else {
      this.emitUpdate();
    }
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

  private startTimer() {
    this.clearTimer();
    this.timerId = window.setInterval(() => {
      this.emitUpdate();
    }, 100);
  }

  private clearTimer() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private emitUpdate() {
    if (this.onStateChange) {
      this.onStateChange(this.isPlaying, this.currentTime, this.duration);
    }
  }

  public destroy() {
    this.stop();
    if (this.ctx && this.ctx.state !== "closed") {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
