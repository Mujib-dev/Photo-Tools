import { errorFrom, request } from "@/lib/auth";

export interface PresetRecord {
  id: string;
  userId: string;
  operation: string;
  name: string;
  settings: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/** Saved presets for one tool (or all tools when `operation` is omitted). */
export async function listPresets(operation?: string): Promise<PresetRecord[]> {
  const qs = operation ? `?operation=${encodeURIComponent(operation)}` : "";
  const res = await request(`/api/backend/presets${qs}`);
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { presets: PresetRecord[] };
  return body.presets;
}

/**
 * Save settings under a name. Saving with an existing name for the same
 * operation replaces that preset.
 */
export async function createPreset(input: {
  operation: string;
  name: string;
  settings: Record<string, unknown>;
}): Promise<PresetRecord> {
  const res = await request("/api/backend/presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { preset: PresetRecord };
  return body.preset;
}

export async function deletePreset(id: string): Promise<void> {
  const res = await request(`/api/backend/presets/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw await errorFrom(res);
}
