"use client";

import * as React from "react";

import { Processor } from "@/components/processor";
import { AuthGate } from "@/components/auth-gate";
import { AudioSettingsForm } from "@/components/audio-settings";
import { submitAudio } from "@/lib/api";
import type { AudioSettings } from "@/lib/types";

export function AudioTool() {
  const [settings, setSettings] = React.useState<AudioSettings>({
    format: "mp3",
    bitrate: 192,
    sampleRate: undefined,
    channels: "keep",
    volume: 1,
    trimStart: 0,
    trimEnd: 0,
  });

  return (
    <AuthGate>
      <Processor
        operation="audio"
        mediaKind="audio"
        title="Audio Studio & Converter"
        description="Convert songs, voice notes and podcasts between MP3, WAV, AAC, FLAC, M4A, OGG, and OPUS. Includes AI Voice Changer (Girl, Baby, Deep Man, Robot), pitch shift, bitrates, channels, and timeline trimming."
        submit={(file, s) => submitAudio(file, s as AudioSettings)}
        settings={settings}
        setSettings={(s) => setSettings(s as AudioSettings)}
        settingsPanel={(meta) => (
          <AudioSettingsForm value={settings} onChange={setSettings} duration={meta.duration} />
        )}
      />
    </AuthGate>
  );
}
