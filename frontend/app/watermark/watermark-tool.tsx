"use client";

import * as React from "react";

import { Processor } from "@/components/processor";
import { AuthGate } from "@/components/auth-gate";
import { WatermarkSettingsForm } from "@/components/watermark-settings";
import { submitWatermark } from "@/lib/api";
import type { WatermarkSettings } from "@/lib/types";

const DEFAULT_SETTINGS: WatermarkSettings = {
  text: "© PicTools",
  position: "bottom-right",
  opacity: 40,
  size: 8,
  color: "white",
  format: "jpg",
};

export function WatermarkTool() {
  const [settings, setSettings] = React.useState<WatermarkSettings>(DEFAULT_SETTINGS);

  return (
    <AuthGate>
      <Processor
        operation="watermark"
        title="Photo Watermark"
        description="Stamp your name or brand over photos — place it once or tile it across the whole image."
        submit={(file, s) => {
          if (!settings.text.trim()) {
            throw new Error("Enter watermark text first.");
          }
          return submitWatermark(file, s as WatermarkSettings);
        }}
        settings={settings}
        settingsPanel={() => <WatermarkSettingsForm value={settings} onChange={setSettings} />}
      />
    </AuthGate>
  );
}
