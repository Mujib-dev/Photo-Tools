"use client";

import * as React from "react";

import { Processor } from "@/components/processor";
import { AuthGate } from "@/components/auth-gate";
import { ConvertSettingsForm } from "@/components/convert-settings";
import { submitConvert } from "@/lib/api";
import type { ConvertSettings } from "@/lib/types";

export function ConvertTool() {
  const [settings, setSettings] = React.useState<ConvertSettings>({
    sizes: [16, 32, 48, 64, 128, 256],
    format: "ico",
  });

  return (
    <AuthGate>
      <Processor
        operation="convert"
        title="Photo Converter"
        description="Convert your images into .ico icons or JPG, PNG, BMP, TIFF, WEBP and GIF formats."
        submit={(file, s) => submitConvert(file, s as ConvertSettings)}
        settings={settings}
        settingsPanel={() => <ConvertSettingsForm value={settings} onChange={setSettings} />}
      />
    </AuthGate>
  );
}
