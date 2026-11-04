"use client";

import * as React from "react";

import { Processor } from "@/components/processor";
import { AuthGate } from "@/components/auth-gate";
import { CompressSettingsForm } from "@/components/compress-settings";
import { submitCompress } from "@/lib/api";
import type { CompressSettings } from "@/lib/types";

export function CompressTool() {
  const [settings, setSettings] = React.useState<CompressSettings>({
    targetKb: 200,
    format: "keep",
  });

  return (
    <AuthGate>
      <Processor
        operation="compress"
        title="Image Compressor"
        description="Hit an exact size limit — set a target in KB and the engine finds the highest quality that fits. Ideal for form uploads."
        submit={(file, s) => submitCompress(file, s as CompressSettings)}
        settings={settings}
        setSettings={(s) => setSettings(s as CompressSettings)}
        settingsPanel={() => <CompressSettingsForm value={settings} onChange={setSettings} />}
      />
    </AuthGate>
  );
}
