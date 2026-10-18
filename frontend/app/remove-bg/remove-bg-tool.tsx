"use client";

import * as React from "react";

import { Processor } from "@/components/processor";
import { AuthGate } from "@/components/auth-gate";
import { RemoveBgSettingsForm } from "@/components/removebg-settings";
import { submitRemoveBg } from "@/lib/api";
import type { RemoveBgSettings } from "@/lib/types";

export function RemoveBgTool() {
  const [settings, setSettings] = React.useState<RemoveBgSettings>({
    background: "transparent",
    format: "png",
  });

  return (
    <AuthGate>
      <Processor
        operation="removebg"
        title="AI Background Remover"
        description="Cut the subject out of any photo with a neural network — transparent PNG, white or black background."
        submit={(file, s) => submitRemoveBg(file, s as RemoveBgSettings)}
        settings={settings}
        settingsPanel={() => <RemoveBgSettingsForm value={settings} onChange={setSettings} />}
      />
    </AuthGate>
  );
}
