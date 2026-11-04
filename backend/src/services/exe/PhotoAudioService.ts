import { existsSync } from "node:fs";
import path from "node:path";

import { ExeProcessRunner } from "./ExeProcessRunner.js";
import type { ProcessingRequest, ProcessingResult, ProcessingService } from "../ProcessingService.js";
import type { AudioSettings } from "../../validation/validators.js";
import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";
import { Errors } from "../../utils/errors.js";

/**
 * Audio conversion service driven by the host-installed FFmpeg.
 * Converts, trims, normalizes and changes sample rate across MP3, WAV, M4A,
 * AAC, FLAC, OGG, and OPUS audio tracks.
 */
export class ExeAudioService implements ProcessingService {
  readonly operation = "audio" as const;

  constructor(private readonly runner: ExeProcessRunner) {}

  async process(request: ProcessingRequest): Promise<ProcessingResult> {
    if (!config.ffmpegExe) throw Errors.videoUnavailable();

    const settings = request.settings as AudioSettings;
    const ext = settings.format;
    const outputPath = path.join(request.outputDir, `${request.outputBaseName}.${ext}`);

    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
    ];

    if (settings.trimStart && settings.trimStart > 0) {
      args.push("-ss", String(settings.trimStart));
    }
    if (settings.trimEnd && settings.trimEnd > (settings.trimStart ?? 0)) {
      args.push("-to", String(settings.trimEnd));
    }

    args.push("-i", request.inputPath, "-vn");

    // Channels downmixing / upmixing
    if (settings.channels === "mono") {
      args.push("-ac", "1");
    } else if (settings.channels === "stereo") {
      args.push("-ac", "2");
    }

    // Custom sample rate
    if (settings.sampleRate && [22050, 44100, 48000, 96000].includes(settings.sampleRate)) {
      args.push("-ar", String(settings.sampleRate));
    }

    // Audio filters list
    const filters: string[] = [];

    // Volume adjustment filter
    if (settings.volume && settings.volume !== 1) {
      filters.push(`volume=${settings.volume}`);
    }

    // Voice presets & pitch shifting
    const preset = settings.voicePreset ?? "none";
    const customPitch = settings.pitchShift ?? 0;
    const customSpeed = settings.speed ?? 1;

    if (preset === "girl") {
      // Man to Girl: +4.2 semitones, formant shifted higher
      filters.push("rubberband=pitch=1.28:formant=shifted");
    } else if (preset === "man") {
      // Woman/Kid to Deep Man: -3.8 semitones, resonant chest voice
      filters.push("rubberband=pitch=0.8:formant=shifted");
    } else if (preset === "baby") {
      // Baby / Kid: high pitch, cute timbre
      filters.push("rubberband=pitch=1.52:tempo=1.04:formant=shifted");
    } else if (preset === "chipmunk") {
      // Cartoon chipmunk: high pitch and fast tempo
      filters.push("rubberband=pitch=1.75:tempo=1.15");
    } else if (preset === "monster") {
      // Monster / Giant: deep pitch + bass boost
      filters.push("rubberband=pitch=0.65:tempo=0.92,equalizer=f=100:width_type=o:width=2:g=6");
    } else if (preset === "robot") {
      // Robot / Cyborg: sinusoidal flanger + metallic pitch
      filters.push("flanger=delay=0:depth=2:regen=0:width=71:speed=0.5:shape=sinusoidal,rubberband=pitch=0.92");
    } else if (preset === "helium") {
      // Helium balloon: extreme high pitch
      filters.push("rubberband=pitch=1.65:formant=shifted");
    } else if (preset === "radio") {
      // Walkie-talkie / telephone bandpass
      filters.push("highpass=f=400,lowpass=f=3400,volume=1.2");
    } else if (preset === "echo") {
      // Cathedral / Space echo
      filters.push("aecho=0.8:0.9:500|1000:0.3|0.2");
    } else if (preset === "studio") {
      // Reverse-engineered Adobe Podcast / Studio Voice Enhance:
      // 1. High-pass filter (80Hz, 24dB/oct) to strip desk vibrations and mic rumble
      // 2. FFT spectral subtraction noise removal (afftdn) to wipe out stationary room hum & hiss
      // 3. Proximity chest boost at 220Hz + anti-mud notch at 480Hz + vocal clarity shelf at 3.4kHz
      // 4. Dynamic audio normalization (dynaudnorm) for broadcast dialogue leveling
      // 5. Lookahead peak limiter (alimiter) for distortion-free maximum loudness
      filters.push(
        "highpass=f=80:poles=2," +
        "afftdn=nf=-25:tn=1," +
        "equalizer=f=220:width_type=o:width=1.2:g=2.2," +
        "equalizer=f=480:width_type=o:width=1.5:g=-2.5," +
        "equalizer=f=3400:width_type=o:width=1.6:g=3.5," +
        "dynaudnorm=f=120:g=15:p=0.95:m=10:s=12," +
        "alimiter=limit=0.95:attack=5:release=50:asc=1"
      );
    } else if (customPitch !== 0 || customSpeed !== 1) {
      const pitchFactor = Math.pow(2, customPitch / 12);
      filters.push(`rubberband=pitch=${pitchFactor.toFixed(4)}:tempo=${customSpeed.toFixed(4)}`);
    }

    // Reverb / Echo if requested
    if (settings.reverb && settings.reverb > 0 && preset !== "echo") {
      const delay = Math.round(200 + settings.reverb * 400);
      const decay = (0.2 + settings.reverb * 0.35).toFixed(2);
      filters.push(`aecho=0.8:0.88:${delay}:${decay}`);
    }

    // Stem isolation (Vocals vs Instrumental)
    if (settings.stemMode === "instrumental") {
      filters.push("stereotools=mlev=0.015625");
    } else if (settings.stemMode === "vocals") {
      filters.push("stereotools=slev=0.015625,bandpass=f=1800:width_type=h:w=3200,volume=1.35");
    }

    if (filters.length > 0) {
      args.push("-af", filters.join(","));
    }

    // Direct stream copy for lossless extraction if requested and no filters needed
    if (settings.copyStream && filters.length === 0 && !settings.channels && !settings.sampleRate) {
      args.push("-c:a", "copy");
    } else {
      // Codec & bitrate selection
      const bitrate = settings.bitrate || 192;
      switch (ext) {
        case "mp3":
          args.push("-c:a", "libmp3lame", "-b:a", `${bitrate}k`);
          break;
        case "m4a":
          args.push("-c:a", "aac", "-b:a", `${bitrate}k`, "-movflags", "+faststart");
          break;
        case "aac":
          args.push("-c:a", "aac", "-b:a", `${bitrate}k`);
          break;
        case "ogg":
          args.push("-c:a", "libvorbis", "-b:a", `${bitrate}k`);
          break;
        case "opus":
          args.push("-c:a", "libopus", "-b:a", `${bitrate}k`);
          break;
        case "flac":
          args.push("-c:a", "flac");
          break;
        case "wav":
          args.push("-c:a", "pcm_s16le");
          break;
        default:
          args.push("-c:a", "libmp3lame", "-b:a", "192k");
          break;
      }
    }

    args.push(outputPath);

    const result = await this.runner.run("video", {
      args,
      timeoutMs: config.processTimeoutMs,
    });

    if (result.timedOut) {
      logger.error("Audio conversion timed out", { input: request.inputPath });
      throw Errors.timeout();
    }
    if (result.exitCode !== 0) {
      logger.error("Audio conversion failed", {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-2000),
      });
      throw Errors.exeError();
    }

    if (!existsSync(outputPath)) {
      logger.error("Audio conversion produced no output file", { outputPath });
      throw Errors.processingFailed();
    }

    return { outputPath };
  }
}
