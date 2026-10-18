"use client";

import * as React from "react";

import { Processor } from "@/components/processor";
import { AuthGate } from "@/components/auth-gate";
import { ResizeSettingsForm } from "@/components/resize-settings";
import { submitResize } from "@/lib/api";
import type { ResizeSettings } from "@/lib/types";

export function ResizeTool() {
  const [settings, setSettings] = React.useState<ResizeSettings>({
    mode: "cm",
    width: 3.5,
    height: 4.5,
    dpi: 300,
    format: "jpg",
  });

  return (
    <AuthGate>
      <Processor
        operation="resize"
        title="Photo Resizer"
        description="Resize your photos to any dimensions while maintaining quality."
        submit={(file, s) => submitResize(file, s as ResizeSettings)}
        settings={settings}
        settingsPanel={() => <ResizeSettingsForm value={settings} onChange={setSettings} />}
      />
    </AuthGate>
  );
}
