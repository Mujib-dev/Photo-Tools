import type {
  SpeechSynthesisRequest,
  SpeechTranscript,
  SpeechVoiceRecord,
  TtsFormat,
} from "./types";
import { errorFrom, request } from "./auth";

export async function listSpeechVoices(): Promise<SpeechVoiceRecord[]> {
  const res = await request("/api/backend/tts/voices");
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { voices?: SpeechVoiceRecord[] };
  return Array.isArray(body.voices) ? body.voices : [];
}

export interface SynthesizedSpeech {
  blob: Blob;
  format: TtsFormat;
  filename: string;
}

export async function synthesizeSpeech(input: SpeechSynthesisRequest): Promise<SynthesizedSpeech> {
  const res = await request("/api/backend/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await errorFrom(res);

  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return {
    blob: await res.blob(),
    format: input.format,
    filename: match?.[1] ?? `speech.${input.format}`,
  };
}

export async function transcribeAudio(file: File, language: string = "en-US"): Promise<SpeechTranscript> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("language", language);
  const res = await request("/api/backend/stt", { method: "POST", body: fd });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as SpeechTranscript;
}
