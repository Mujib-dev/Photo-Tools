"use client";

import * as React from "react";

import { Processor } from "@/components/processor";
import { AuthGate } from "@/components/auth-gate";
import { EnhanceSettingsForm } from "@/components/enhance-settings";
import { submitEnhance } from "@/lib/api";
import type { EnhanceSettings } from "@/lib/types";

export function EnhanceTool() {
  const [settings, setSettings] = React.useState<EnhanceSettings>({
    auto: true,
    sharpness: 1.3,
    contrast: 1.12,
    saturation: 1.1,
    brightness: 1.03,
    denoise: 1,
    scale: 1,
    format: "jpg",
    region: null,
  });

  return (
    <AuthGate>
      <Processor
        operation="enhance"
        title="Photo Enhancer"
        description="Enhance your photos with one click — or fine-tune sharpness, contrast, color, denoise and upscaling by hand. Drag a box on the preview to enhance just that area."
        submit={(file, s) => submitEnhance(file, s as EnhanceSettings)}
        settings={settings}
        settingsPanel={() => <EnhanceSettingsForm value={settings} onChange={setSettings} />}
        regionSelection={{
          value: settings.region ?? null,
          onChange: (region) => setSettings((s) => ({ ...s, region })),
        }}
      />
    </AuthGate>
  );
}
