import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";
import { AppError, Errors } from "../../utils/errors.js";

export interface SpeechVoiceRecord {
  name: string;
  culture: string;
  gender: string;
  age: string;
  description: string;
  localeName?: string;
}

export type SpeechOutputFormat = "wav" | "mp3";

export interface SynthesizeOptions {
  text: string;
  voice?: string;
  rate: number;
  volume: number;
  format: SpeechOutputFormat;
}

export interface SynthesizeResult {
  outputPath: string;
  format: SpeechOutputFormat;
}

export interface TranscriptResult {
  text: string;
  confidence: number | null;
  language: string | null;
  engine: string;
}

interface ProcessResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

const VOICES_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $result = @()
  foreach ($v in $synth.GetInstalledVoices()) {
    if (-not $v.Enabled) { continue }
    $info = $v.VoiceInfo
    $result += [pscustomobject]@{
      name = $info.Name
      culture = $info.Culture.Name
      gender = [string]$info.Gender
      age = [string]$info.Age
      description = $info.Description
    }
  }
  [pscustomobject]@{ voices = @($result) } | ConvertTo-Json -Depth 5 -Compress
} finally {
  $synth.Dispose()
}
`;

const TTS_SCRIPT = String.raw`
param(
  [Parameter(Mandatory=$true)][string]$TextFile,
  [Parameter(Mandatory=$true)][string]$OutFile,
  [string]$Voice = '',
  [int]$Rate = 0,
  [int]$Volume = 100
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$text = [System.IO.File]::ReadAllText($TextFile, [System.Text.Encoding]::UTF8)
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  if ($Voice -ne '') { $synth.SelectVoice($Voice) }
  $synth.Rate = [Math]::Max(-10, [Math]::Min(10, $Rate))
  $synth.Volume = [Math]::Max(0, [Math]::Min(100, $Volume))
  $synth.SetOutputToWaveFile($OutFile)
  $synth.Speak($text)
  [pscustomobject]@{ ok = $true } | ConvertTo-Json -Compress
} finally {
  $synth.Dispose()
}
`;

const STT_SCRIPT = String.raw`
param(
  [Parameter(Mandatory=$true)][string]$WaveFile,
  [Parameter(Mandatory=$true)][string]$ResultFile
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$recognizers = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
if ($recognizers.Count -eq 0) {
  throw 'No speech recognition language is installed on this computer.'
}
$engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine($recognizers[0])
try {
  $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $engine.InitialSilenceTimeout = [TimeSpan]::FromSeconds(5)
  $engine.BabbleTimeout = [TimeSpan]::FromSeconds(5)
  $engine.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(400)
  $engine.SetInputToWaveFile($WaveFile)
  $parts = New-Object System.Collections.Generic.List[string]
  $confidenceSum = 0.0
  $count = 0
  while ($true) {
    try { $result = $engine.Recognize() } catch { break }
    if ($null -eq $result) { break }
    if (-not [string]::IsNullOrWhiteSpace($result.Text)) { $parts.Add($result.Text.Trim()) }
    $confidenceSum += $result.Confidence
    $count += 1
    if ($count -ge 500) { break }
  }
  $confidence = $null
  if ($count -gt 0) { $confidence = [Math]::Round($confidenceSum / $count, 3) }
  $json = [pscustomobject]@{
    text = (($parts -join ' ').Trim())
    confidence = $confidence
    language = $recognizers[0].Culture.Name
    phraseCount = $count
  } | ConvertTo-Json -Compress
  [System.IO.File]::WriteAllText($ResultFile, $json, [System.Text.UTF8Encoding]::new($false))
} finally {
  $engine.Dispose()
}
`;

function runProcess(exe: string, args: string[], timeoutMs: number): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new AppError(504, "Speech processing timed out. Try a shorter recording or text."));
    }, timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > 2_000_000) stdout = stdout.slice(-2_000_000);
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
      if (stderr.length > 100_000) stderr = stderr.slice(-100_000);
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}

function lastJsonLine(stdout: string): unknown {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].replace(/^\uFEFF/, "");
    if (!line.startsWith("{")) continue;
    try {
      return JSON.parse(line);
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Local speech tools built on the voices and recognizers that ship with
 * Windows (System.Speech). Audio is written to a temporary job directory and
 * removed once the response has been sent. FFmpeg is used when present to
 * convert uploads to 16 kHz mono WAV and to export MP3.
 */
function findVoiceCli(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "bin-src", "voice_tools_cli.py"),
    path.resolve(process.cwd(), "..", "bin-src", "voice_tools_cli.py"),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

export class SpeechService {
  private scriptsPromise: Promise<string> | null = null;

  private assertSupported(): void {
    if (process.platform !== "win32") throw Errors.speechUnavailable();
  }

  private async runVoiceCli(args: string[], timeoutMs: number): Promise<ProcessResult | null> {
    const cliPath = findVoiceCli();
    if (!cliPath) return null;
    const pythonExe = process.env.PYTHON_EXE || "python";
    try {
      return await runProcess(pythonExe, [cliPath, ...args], timeoutMs);
    } catch (err) {
      logger.warn("Voice CLI invocation failed, will fall back", { error: String(err) });
      return null;
    }
  }

  private scriptsDir(): Promise<string> {
    if (!this.scriptsPromise) {
      this.scriptsPromise = (async () => {
        const dir = path.join(config.tempDirectory, "speech-scripts");
        await fs.mkdir(dir, { recursive: true });
        await Promise.all([
          fs.writeFile(path.join(dir, "voices.ps1"), VOICES_SCRIPT, "utf8"),
          fs.writeFile(path.join(dir, "tts.ps1"), TTS_SCRIPT, "utf8"),
          fs.writeFile(path.join(dir, "stt.ps1"), STT_SCRIPT, "utf8"),
        ]);
        return dir;
      })().catch((err) => {
        this.scriptsPromise = null;
        throw err;
      });
    }
    return this.scriptsPromise;
  }

  private runPowerShell(scriptPath: string, args: string[], timeoutMs: number): Promise<ProcessResult> {
    return runProcess(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        ...args,
      ],
      timeoutMs,
    );
  }

  async listVoices(): Promise<SpeechVoiceRecord[]> {
    this.assertSupported();

    // 1. Try Python voice CLI (Edge TTS with 320+ neural voices)
    const cliRes = await this.runVoiceCli(["list-voices"], 30_000);
    if (cliRes && cliRes.code === 0) {
      const parsed = lastJsonLine(cliRes.stdout) as { ok?: boolean; voices?: SpeechVoiceRecord[] } | null;
      if (parsed?.ok && Array.isArray(parsed.voices) && parsed.voices.length > 0) {
        return parsed.voices;
      }
    }

    // 2. Fall back to Windows PowerShell SAPI voices
    const dir = await this.scriptsDir();
    const result = await this.runPowerShell(path.join(dir, "voices.ps1"), [], 45_000);
    if (result.code !== 0) {
      logger.error("Could not enumerate speech voices", { stderr: result.stderr.slice(-1000) });
      throw Errors.speechUnavailable();
    }
    const parsed = lastJsonLine(result.stdout) as { voices?: unknown } | null;
    if (!parsed || !Array.isArray(parsed.voices)) return [];
    return parsed.voices.filter(
      (voice): voice is SpeechVoiceRecord =>
        typeof voice === "object" &&
        voice !== null &&
        typeof (voice as SpeechVoiceRecord).name === "string",
    );
  }

  async synthesize(options: SynthesizeOptions, outputDir: string): Promise<SynthesizeResult> {
    this.assertSupported();
    const id = crypto.randomUUID();

    // 1. Try Python voice CLI (Edge TTS)
    const targetPath = path.join(outputDir, `${id}.${options.format}`);
    const ratePercent = options.rate >= 0 ? `+${options.rate * 5}%` : `${options.rate * 5}%`;
    const cliRes = await this.runVoiceCli(
      [
        "tts",
        "--text",
        options.text,
        "--output",
        targetPath,
        "--voice",
        options.voice || "en-US-AriaNeural",
        "--rate",
        ratePercent,
      ],
      120_000,
    );
    if (cliRes && cliRes.code === 0 && existsSync(targetPath)) {
      return { outputPath: targetPath, format: options.format };
    }

    // 2. Fall back to Windows PowerShell SAPI
    const dir = await this.scriptsDir();
    const textFile = path.join(outputDir, `${id}.txt`);
    const wavFile = path.join(outputDir, `${id}.wav`);

    await fs.writeFile(textFile, options.text, "utf8");
    try {
      const args = [
        "-TextFile",
        textFile,
        "-OutFile",
        wavFile,
        "-Rate",
        String(options.rate),
        "-Volume",
        String(options.volume),
      ];
      if (options.voice) args.push("-Voice", options.voice);

      const result = await this.runPowerShell(
        path.join(dir, "tts.ps1"),
        args,
        120_000,
      );

      if (result.code !== 0 || !existsSync(wavFile)) {
        logger.error("Speech synthesis failed", { stderr: result.stderr.slice(-1000) });
        if (/voice/i.test(result.stderr) && /(not\s+found|cannot|unable|install)/i.test(result.stderr)) {
          throw Errors.speechVoiceUnavailable();
        }
        throw Errors.speechFailed();
      }
    } finally {
      await fs.rm(textFile, { force: true }).catch(() => undefined);
    }

    if (options.format === "wav") {
      return { outputPath: wavFile, format: "wav" };
    }

    if (!config.ffmpegExe) {
      await fs.rm(wavFile, { force: true }).catch(() => undefined);
      throw Errors.speechFormatUnavailable();
    }

    const mp3File = path.join(outputDir, `${id}.mp3`);
    const converted = await runProcess(
      config.ffmpegExe,
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        wavFile,
        "-codec:a",
        "libmp3lame",
        "-q:a",
        "2",
        mp3File,
      ],
      120_000,
    );

    if (converted.code !== 0 || !existsSync(mp3File)) {
      logger.error("MP3 conversion failed", { stderr: converted.stderr.slice(-1000) });
      throw Errors.speechFailed();
    }

    await fs.rm(wavFile, { force: true }).catch(() => undefined);
    return { outputPath: mp3File, format: "mp3" };
  }

  async transcribe(inputPath: string, workDir: string, language: string = "en-US"): Promise<TranscriptResult> {
    this.assertSupported();

    // 1. Try Python voice CLI (FFmpeg + Google Speech Recognition API for any language)
    const cliRes = await this.runVoiceCli(
      ["stt", "--input", inputPath, "--lang", language],
      120_000,
    );
    if (cliRes && cliRes.code === 0) {
      const parsed = lastJsonLine(cliRes.stdout) as {
        ok?: boolean;
        transcript?: string;
        confidence?: number | null;
      } | null;
      if (parsed?.ok && typeof parsed.transcript === "string") {
        return {
          text: parsed.transcript,
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
          language,
          engine: "Neural Speech Recognition",
        };
      }
    }

    // 2. Fall back to Windows PowerShell speech recognition
    const dir = await this.scriptsDir();
    const sourceExt = path.extname(inputPath).toLowerCase();
    const wavFile = path.join(workDir, "speech-input.wav");
    let prepared = inputPath;

    if (config.ffmpegExe) {
      const converted = await runProcess(
        config.ffmpegExe,
        [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          inputPath,
          "-ar",
          "16000",
          "-ac",
          "1",
          "-c:a",
          "pcm_s16le",
          wavFile,
        ],
        180_000,
      );
      if (converted.code === 0 && existsSync(wavFile)) {
        prepared = wavFile;
      } else if (sourceExt !== ".wav") {
        logger.error("Could not decode audio for transcription", {
          stderr: converted.stderr.slice(-1000),
        });
        throw Errors.speechFailed();
      }
    } else if (sourceExt !== ".wav") {
      throw Errors.speechUnavailable();
    }

    const resultFile = path.join(workDir, "speech-result.json");
    const result = await this.runPowerShell(
      path.join(dir, "stt.ps1"),
      ["-WaveFile", prepared, "-ResultFile", resultFile],
      300_000,
    );

    if (result.code !== 0) {
      logger.error("Speech recognition failed", { stderr: result.stderr.slice(-1500) });
      if (/No speech recognition language/i.test(result.stderr)) {
        throw Errors.speechNoRecognizer();
      }
      throw Errors.speechFailed();
    }

    let parsed: { text?: unknown; confidence?: unknown; language?: unknown } | null = null;
    try {
      const raw = await fs.readFile(resultFile, "utf8");
      parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as {
        text?: unknown;
        confidence?: unknown;
        language?: unknown;
      } | null;
    } catch (err) {
      logger.error("Could not read speech recognition result", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw Errors.speechFailed();
    }
    if (!parsed) throw Errors.speechFailed();

    return {
      text: typeof parsed.text === "string" ? parsed.text : "",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
      language: typeof parsed.language === "string" ? parsed.language : null,
      engine: "Windows Speech Recognition",
    };
  }
}
