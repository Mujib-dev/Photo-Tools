/**
 * Client-Side Audio Noise Reducer & Voice Clarity Engine
 *
 * Implements real-time / offline audio processing via Web Audio API:
 * - Sub-bass rumble reduction (high-pass filter < 80Hz)
 * - 50Hz/60Hz AC electrical hum notch filter
 * - Dynamic noise gate with smooth attack/release
 * - Speech presence clarity EQ boost (2.5kHz - 4.5kHz)
 * - Lossless 16-bit PCM WAV encoder
 */

export interface DenoiserOptions {
  preset: "podcast" | "ac-hiss" | "hum-killer" | "vocal-boost" | "aggressive";
  gateThresholdDb: number; // e.g. -45 dB
  highPassCutoff: number; // e.g. 80 Hz
  clarityBoostDb: number; // e.g. 3.5 dB
  notchMainsFreq?: 50 | 60 | 0; // AC hum removal
}

export const DENOISER_PRESETS: Record<string, DenoiserOptions> = {
  podcast: {
    preset: "podcast",
    gateThresholdDb: -42,
    highPassCutoff: 85,
    clarityBoostDb: 3.5,
    notchMainsFreq: 60,
  },
  "ac-hiss": {
    preset: "ac-hiss",
    gateThresholdDb: -38,
    highPassCutoff: 100,
    clarityBoostDb: 2.0,
    notchMainsFreq: 0,
  },
  "hum-killer": {
    preset: "hum-killer",
    gateThresholdDb: -45,
    highPassCutoff: 90,
    clarityBoostDb: 2.0,
    notchMainsFreq: 60,
  },
  "vocal-boost": {
    preset: "vocal-boost",
    gateThresholdDb: -48,
    highPassCutoff: 75,
    clarityBoostDb: 5.0,
    notchMainsFreq: 0,
  },
  aggressive: {
    preset: "aggressive",
    gateThresholdDb: -32,
    highPassCutoff: 120,
    clarityBoostDb: 4.0,
    notchMainsFreq: 60,
  },
};

/**
 * Converts an AudioBuffer into a standard 16-bit PCM WAV Blob
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = buffer.length;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF identifier
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  // fmt sub-chunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave audio channel data and write 16-bit PCM samples
  const channels = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];
      // Clamp between -1 and 1
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit integer
      const s = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, s, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/**
 * Applies noise gate gain reduction across sample blocks
 */
function applyNoiseGate(buffer: AudioBuffer, thresholdDb: number) {
  const thresholdLinear = Math.pow(10, thresholdDb / 20);
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const blockSize = Math.round(sampleRate * 0.02); // 20ms analysis windows

  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    let envelope = 1.0;

    for (let i = 0; i < data.length; i += blockSize) {
      const end = Math.min(i + blockSize, data.length);
      let sumSquares = 0;
      for (let j = i; j < end; j++) {
        sumSquares += data[j] * data[j];
      }
      const rms = Math.sqrt(sumSquares / (end - i));

      // Calculate target gain
      const targetGain = rms < thresholdLinear ? Math.pow(rms / thresholdLinear, 1.8) : 1.0;

      // Smooth gain transition across the block
      for (let j = i; j < end; j++) {
        envelope = envelope * 0.95 + targetGain * 0.05;
        data[j] *= envelope;
      }
    }
  }
}

/**
 * Processes an input audio file or blob and outputs cleaned, enhanced audio
 */
export async function denoiseAudio(
  file: File | Blob,
  options: DenoiserOptions,
  onProgress?: (stage: string, percent: number) => void
): Promise<{ wavBlob: Blob; wavUrl: string; duration: number; originalDuration: number }> {
  onProgress?.("Reading audio data", 15);
  const arrayBuffer = await file.arrayBuffer();

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtx();

  onProgress?.("Decoding audio stream", 30);
  const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  const duration = decodedBuffer.duration;
  const sampleRate = decodedBuffer.sampleRate;
  const numChannels = decodedBuffer.numberOfChannels;

  onProgress?.("Configuring DSP filters", 50);
  const offlineCtx = new OfflineAudioContext(numChannels, decodedBuffer.length, sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;

  // 1. High-Pass Filter (cuts desk rumble and HVAC low hum)
  const highPass = offlineCtx.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = options.highPassCutoff;
  highPass.Q.value = 0.707;

  let lastNode: AudioNode = highPass;
  source.connect(highPass);

  // 2. Notch Filter for 50Hz/60Hz AC hum if configured
  if (options.notchMainsFreq && options.notchMainsFreq > 0) {
    const notch = offlineCtx.createBiquadFilter();
    notch.type = "notch";
    notch.frequency.value = options.notchMainsFreq;
    notch.Q.value = 8.0; // tight notch
    lastNode.connect(notch);
    lastNode = notch;

    // Harmonic notch at 2x mains frequency (120Hz / 100Hz)
    const harmonic = offlineCtx.createBiquadFilter();
    harmonic.type = "notch";
    harmonic.frequency.value = options.notchMainsFreq * 2;
    harmonic.Q.value = 8.0;
    lastNode.connect(harmonic);
    lastNode = harmonic;
  }

  // 3. Peaking EQ for vocal presence & clarity
  if (options.clarityBoostDb > 0) {
    const presence = offlineCtx.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 3200; // speech articulation frequency
    presence.Q.value = 1.2;
    presence.gain.value = options.clarityBoostDb;
    lastNode.connect(presence);
    lastNode = presence;
  }

  lastNode.connect(offlineCtx.destination);
  source.start(0);

  onProgress?.("Filtering audio frequencies", 70);
  const renderedBuffer = await offlineCtx.startRendering();

  onProgress?.("Applying dynamic noise gate", 85);
  applyNoiseGate(renderedBuffer, options.gateThresholdDb);

  onProgress?.("Encoding clean 16-bit WAV", 95);
  const wavBlob = audioBufferToWav(renderedBuffer);
  const wavUrl = URL.createObjectURL(wavBlob);

  onProgress?.("Complete", 100);

  return {
    wavBlob,
    wavUrl,
    duration,
    originalDuration: duration,
  };
}
