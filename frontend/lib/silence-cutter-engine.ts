/**
 * Automatic Audio Silence & Dead Air Cutter Engine
 *
 * Uses the Web Audio API to detect awkward pauses, silent gaps, and dead air
 * in podcasts, lectures, and voice notes. Slices and splices audible audio
 * with micro-crossfades to eliminate digital clicks.
 */

import { audioBufferToWav } from "./audio-denoiser";

export interface SilenceInterval {
  start: number; // in seconds
  end: number;
  duration: number;
}

export interface SilenceCutOptions {
  thresholdDb: number; // e.g. -38 dB
  minSilenceDuration: number; // e.g. 0.4 seconds
  paddingDuration: number; // e.g. 0.05 seconds (preserves natural word tails)
}

export interface SilenceCutResult {
  originalDuration: number;
  trimmedDuration: number;
  timeSavedSeconds: number;
  timeSavedPercent: number;
  silenceCount: number;
  silenceIntervals: SilenceInterval[];
  waveformPeaks: number[];
  trimmedBuffer: AudioBuffer;
  wavBlob: Blob;
}

/**
 * Decode an uploaded audio file into an AudioBuffer
 */
export async function decodeAudio(file: File | Blob): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  try {
    return await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    audioCtx.close();
  }
}

/**
 * Extract normalized amplitude peaks for waveform visualization (e.g. 150 bars)
 */
export function extractWaveformPeaks(buffer: AudioBuffer, numBars = 120): number[] {
  const data = buffer.getChannelData(0);
  const step = Math.floor(data.length / numBars);
  const peaks: number[] = [];

  for (let i = 0; i < numBars; i++) {
    const start = i * step;
    const end = Math.min(start + step, data.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const val = Math.abs(data[j]);
      if (val > max) max = val;
    }
    peaks.push(max);
  }

  return peaks;
}

/**
 * Detect silence intervals and concatenate audible segments with micro-crossfades.
 */
export async function cutAudioSilence(
  buffer: AudioBuffer,
  options: SilenceCutOptions
): Promise<SilenceCutResult> {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const originalDuration = buffer.duration;

  // Window size: 25ms
  const windowSize = Math.round(sampleRate * 0.025);
  const thresholdLinear = Math.pow(10, options.thresholdDb / 20);
  const minSilenceSamples = Math.round(options.minSilenceDuration * sampleRate);
  const paddingSamples = Math.round(options.paddingDuration * sampleRate);

  // Use channel 0 for energy detection
  const primaryChannel = buffer.getChannelData(0);
  const isSilent: boolean[] = new Array(Math.ceil(primaryChannel.length / windowSize)).fill(false);

  for (let w = 0; w < isSilent.length; w++) {
    const start = w * windowSize;
    const end = Math.min(start + windowSize, primaryChannel.length);
    let sumSquares = 0;
    for (let i = start; i < end; i++) {
      sumSquares += primaryChannel[i] * primaryChannel[i];
    }
    const rms = Math.sqrt(sumSquares / (end - start));
    if (rms < thresholdLinear) {
      isSilent[w] = true;
    }
  }

  // Group contiguous silent windows into sample intervals
  const rawSilenceIntervals: { startSample: number; endSample: number }[] = [];
  let inSilence = false;
  let silenceStartWindow = 0;

  for (let w = 0; w < isSilent.length; w++) {
    if (isSilent[w] && !inSilence) {
      inSilence = true;
      silenceStartWindow = w;
    } else if (!isSilent[w] && inSilence) {
      inSilence = false;
      const startSample = silenceStartWindow * windowSize;
      const endSample = w * windowSize;
      if (endSample - startSample >= minSilenceSamples) {
        rawSilenceIntervals.push({ startSample, endSample });
      }
    }
  }

  // Handle trailing silence
  if (inSilence) {
    const startSample = silenceStartWindow * windowSize;
    const endSample = primaryChannel.length;
    if (endSample - startSample >= minSilenceSamples) {
      rawSilenceIntervals.push({ startSample, endSample });
    }
  }

  // Convert to seconds for UI inspection
  const silenceIntervals: SilenceInterval[] = rawSilenceIntervals.map((inv) => ({
    start: Math.round((inv.startSample / sampleRate) * 100) / 100,
    end: Math.round((inv.endSample / sampleRate) * 100) / 100,
    duration: Math.round(((inv.endSample - inv.startSample) / sampleRate) * 100) / 100,
  }));

  // Invert silence intervals to get audible chunks to keep (with padding)
  interface AudibleChunk {
    start: number;
    end: number;
  }
  const audibleChunks: AudibleChunk[] = [];
  let lastAudibleStart = 0;

  for (const silence of rawSilenceIntervals) {
    // Keep up to silence start + padding
    const chunkEnd = Math.min(silence.startSample + paddingSamples, primaryChannel.length);
    if (chunkEnd > lastAudibleStart) {
      audibleChunks.push({ start: lastAudibleStart, end: chunkEnd });
    }
    // Next audible chunk begins at silence end - padding
    lastAudibleStart = Math.max(0, silence.endSample - paddingSamples);
  }

  if (lastAudibleStart < primaryChannel.length) {
    audibleChunks.push({ start: lastAudibleStart, end: primaryChannel.length });
  }

  // Calculate total samples in trimmed output
  let totalTrimmedSamples = 0;
  for (const chunk of audibleChunks) {
    totalTrimmedSamples += chunk.end - chunk.start;
  }

  // Fallback: If no silence was detected or trimmed is empty, return original
  if (totalTrimmedSamples === 0) {
    const wavBlob = audioBufferToWav(buffer);
    return {
      originalDuration,
      trimmedDuration: originalDuration,
      timeSavedSeconds: 0,
      timeSavedPercent: 0,
      silenceCount: 0,
      silenceIntervals: [],
      waveformPeaks: extractWaveformPeaks(buffer),
      trimmedBuffer: buffer,
      wavBlob,
    };
  }

  // Create new AudioBuffer for spliced result
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const trimmedBuffer = audioCtx.createBuffer(numChannels, totalTrimmedSamples, sampleRate);
  audioCtx.close();

  // 5ms micro-crossfade to prevent clicks
  const crossfadeSamples = Math.round(sampleRate * 0.005);

  for (let c = 0; c < numChannels; c++) {
    const origData = buffer.getChannelData(c);
    const destData = trimmedBuffer.getChannelData(c);
    let writeOffset = 0;

    for (let k = 0; k < audibleChunks.length; k++) {
      const chunk = audibleChunks[k];
      const chunkLen = chunk.end - chunk.start;

      for (let i = 0; i < chunkLen; i++) {
        let sample = origData[chunk.start + i];

        // Fade-in at chunk start (if not very first sample)
        if (k > 0 && i < crossfadeSamples) {
          sample *= i / crossfadeSamples;
        }
        // Fade-out at chunk end (if not very last chunk)
        if (k < audibleChunks.length - 1 && i >= chunkLen - crossfadeSamples) {
          sample *= (chunkLen - i) / crossfadeSamples;
        }

        destData[writeOffset + i] = sample;
      }
      writeOffset += chunkLen;
    }
  }

  const trimmedDuration = trimmedBuffer.duration;
  const timeSavedSeconds = Math.max(0, originalDuration - trimmedDuration);
  const timeSavedPercent = Math.round((timeSavedSeconds / originalDuration) * 100);

  const wavBlob = audioBufferToWav(trimmedBuffer);

  return {
    originalDuration: Math.round(originalDuration * 10) / 10,
    trimmedDuration: Math.round(trimmedDuration * 10) / 10,
    timeSavedSeconds: Math.round(timeSavedSeconds * 10) / 10,
    timeSavedPercent,
    silenceCount: silenceIntervals.length,
    silenceIntervals,
    waveformPeaks: extractWaveformPeaks(buffer),
    trimmedBuffer,
    wavBlob,
  };
}
