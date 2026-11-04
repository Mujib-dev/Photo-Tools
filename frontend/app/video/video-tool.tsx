"use client";

import * as React from "react";

import { Processor } from "@/components/processor";
import { AuthGate } from "@/components/auth-gate";
import { VideoSettingsForm } from "@/components/video-settings";
import { submitVideo } from "@/lib/api";
import type { VideoOutputKind, VideoSettings } from "@/lib/types";

export function VideoTool({ initialOutput }: { initialOutput?: VideoOutputKind }) {
  const [settings, setSettings] = React.useState<VideoSettings>({
    output: initialOutput ?? "video",
    mode: "target",
    targetKb: 10240,
    crf: 28,
    resolution: "source",
    format: "keep",
    audioMode: "keep",
    audioKbps: 128,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    fps: 12,
    frameTime: 0,
    thumbFormat: "jpg",
    audioFormat: "mp3",
    framesInterval: 1,
    framesFormat: "jpg",
    framesMax: 300,
  });

  return (
    <AuthGate>
      <Processor
        operation="video"
        mediaKind="video"
        title={initialOutput === "frames" ? "Extract Video Frames" : "Video Studio"}
        description={
          initialOutput === "frames"
            ? "Export a ZIP of still frames from an MP4, MOV, WebM or MKV video. Powered by FFmpeg."
            : "Compress, trim and speed up MP4, MOV, WebM or MKV videos — or export an animated GIF, a still thumbnail, the audio track or a ZIP of frames. Powered by FFmpeg."
        }
        submit={(file, s) => submitVideo(file, s as VideoSettings)}
        settings={settings}
        setSettings={(s) => setSettings(s as VideoSettings)}
        settingsPanel={(meta) => (
          <VideoSettingsForm value={settings} onChange={setSettings} duration={meta.duration} />
        )}
      />
    </AuthGate>
  );
}
