"use client";

import * as React from "react";

import { Processor } from "@/components/processor";
import { AuthGate } from "@/components/auth-gate";
import { WatermarkSettingsForm } from "@/components/watermark-settings";
import { submitWatermark } from "@/lib/api";
import type { WatermarkSettings } from "@/lib/types";

const DEFAULT_SETTINGS: WatermarkSettings = {
  watermarkType: "text",
  text: "© PicTools",
  position: "bottom-right",
  opacity: 40,
  size: 8,
  color: "white",
  format: "jpg",
};

export function WatermarkTool() {
  const [settings, setSettings] = React.useState<WatermarkSettings>(DEFAULT_SETTINGS);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);

  return (
    <AuthGate>
      <Processor
        operation="watermark"
        title="Photo Watermark"
        description="Stamp your name, brand, or custom PNG logo over photos — place it once or tile it across the whole image."
        submit={(file, s) => {
          const currentSettings = s as WatermarkSettings;
          if (currentSettings.watermarkType === "image") {
            if (!logoFile) {
              throw new Error("Please upload a logo image first.");
            }
            return submitWatermark(file, currentSettings, logoFile);
          }
          if (!currentSettings.text.trim()) {
            throw new Error("Enter watermark text first.");
          }
          return submitWatermark(file, currentSettings);
        }}
        settings={settings}
        setSettings={(s) => setSettings(s as WatermarkSettings)}
        settingsPanel={() => (
          <WatermarkSettingsForm
            value={settings}
            onChange={setSettings}
            logoFile={logoFile}
            onLogoChange={setLogoFile}
          />
        )}
      />
    </AuthGate>
  );
}
