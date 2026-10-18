import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import {
  Banner,
  Body,
  Button,
  Card,
  ChipGroup,
  Field,
  Label,
  NumberField,
  SectionTitle,
  Toggle,
  ToggleChip,
  useColors,
} from "../../components/ui";
import { JobList, pickImages, saveToPhotos, shareFile } from "../../components/jobList";
import * as api from "../../lib/api";
import {
  AI_UPSCALE_OPTIONS,
  COMPRESS_FORMATS,
  COMPRESS_PRESETS,
  CONVERT_FORMATS,
  ENHANCE_FORMATS,
  ICO_SIZES,
  REMOVEBG_BACKGROUNDS,
  REMOVEBG_FORMATS,
  RESIZE_FORMATS,
  RESIZE_PRESETS,
  UPSCALE_OPTIONS,
  WATERMARK_COLORS,
  WATERMARK_POSITIONS,
  type EnhanceSettings,
  type ToolSettings,
} from "../../lib/types";
import { getTool } from "../../lib/tools";
import { useJobBatch, type JobItem } from "../../lib/useJobs";

export default function ToolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tool = getTool(String(id));

  if (!tool) {
    return (
      <View style={styles.missing}>
        <Body>Unknown tool.</Body>
      </View>
    );
  }
  return <ToolRunner toolId={tool.id} />;
}

function ToolRunner({ toolId }: { toolId: string }) {
  const colors = useColors();
  const tool = getTool(toolId)!;
  const [settings, setSettings] = useState<ToolSettings>(() => tool.defaults());
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  const submit = useCallback(
    (file: api.UploadFile) => api.submitSingle(tool.endpoint, file, settings),
    [settings, tool.endpoint],
  );

  const batch = useJobBatch(submit);

  const onSave = async (item: JobItem) => {
    if (!item.localUri) return;
    try {
      await saveToPhotos(item.localUri);
      setNotice({ tone: "info", text: "Saved to your photo library." });
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not save the image.",
      });
    }
  };

  const onShare = async (item: JobItem) => {
    if (!item.localUri) return;
    const shared = await shareFile(item.localUri);
    if (!shared) setNotice({ tone: "error", text: "Sharing is not available on this device." });
  };

  const add = async (fromCamera: boolean) => {
    try {
      const picked = await pickImages({ multiple: true, fromCamera });
      if (picked.length > 0) batch.addFiles(picked);
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not open the picker.",
      });
    }
  };

  const onStart = () => {
    if (toolId === "watermark" && !(settings as { text: string }).text.trim()) {
      setNotice({ tone: "error", text: "Enter the watermark text first." });
      return;
    }
    setNotice(null);
    void batch.start();
  };

  const confirmReset = () => {
    Alert.alert("Clear list", "Remove all images from this list?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: batch.reset },
    ]);
  };

  const pendingCount = useMemo(
    () => batch.items.filter((i) => i.state === "pending" || i.state === "failed").length,
    [batch.items],
  );

  return (
    <>
      <Stack.Screen options={{ title: tool.title }} />
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <SectionTitle>Images</SectionTitle>
          <View style={styles.buttonRow}>
            <Button title="Choose from library" onPress={() => void add(false)} style={styles.flex} />
            <Button title="Camera" onPress={() => void add(true)} variant="secondary" style={styles.flex} />
          </View>
        </Card>

        <Card>
          <SectionTitle>Settings</SectionTitle>
          <ToolSettingsFields toolId={toolId} settings={settings} onChange={setSettings} />
        </Card>

        {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}
        {batch.fatalError ? (
          <Banner tone="error">
            {batch.fatalError}{" "}
            <Button title="Dismiss" onPress={batch.dismissFatal} variant="ghost" />
          </Banner>
        ) : null}

        <Card>
          <Button
            title={batch.running ? "Working…" : `Process ${pendingCount || ""}`.trim()}
            onPress={onStart}
            disabled={pendingCount === 0 || batch.running}
          />
          {batch.items.length > 0 ? (
            <Button title="Clear list" onPress={confirmReset} variant="ghost" />
          ) : null}
          <Body muted>
            Finished images are copied to this phone automatically, so they survive the server
            cleaning up after 15 minutes.
          </Body>
        </Card>

        <JobList
          items={batch.items}
          onRemove={batch.remove}
          onSave={(item) => void onSave(item)}
          onShare={(item) => void onShare(item)}
        />
      </ScrollView>
    </>
  );
}

function ToolSettingsFields({
  toolId,
  settings,
  onChange,
}: {
  toolId: string;
  settings: ToolSettings;
  onChange: (next: ToolSettings) => void;
}) {
  const patch = (fields: Record<string, unknown>) =>
    onChange({ ...(settings as object), ...fields } as ToolSettings);

  switch (toolId) {
    case "resize": {
      const s = settings as import("../../lib/types").ResizeSettings;
      const preset = RESIZE_PRESETS.find(
        (p) => p.mode === s.mode && p.width === s.width && p.height === s.height && p.dpi === s.dpi,
      );
      return (
        <>
          <View style={styles.field}>
            <Label>Preset</Label>
            <ChipGroup
              options={RESIZE_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
              value={preset?.id ?? "custom"}
              onChange={(nextId) => {
                const found = RESIZE_PRESETS.find((p) => p.id === nextId);
                if (found) {
                  patch({ mode: found.mode, width: found.width, height: found.height, dpi: found.dpi });
                }
              }}
            />
          </View>

          <View style={styles.field}>
            <Label>Size in</Label>
            <ChipGroup
              options={[
                { value: "cm", label: "Centimetres" },
                { value: "px", label: "Pixels" },
              ]}
              value={s.mode}
              onChange={(mode) => patch({ mode })}
            />
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.flex}>
              <Label>Width ({s.mode})</Label>
              <Field
                value={String(s.width)}
                onChangeText={(v) => patch({ width: Number(v.replace(/[^0-9.]/g, "")) || 0 })}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.flex}>
              <Label>Height ({s.mode})</Label>
              <Field
                value={String(s.height)}
                onChangeText={(v) => patch({ height: Number(v.replace(/[^0-9.]/g, "")) || 0 })}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Label>DPI</Label>
            <ChipGroup
              options={[72, 96, 150, 300, 600].map((d) => ({ value: d, label: String(d) }))}
              value={s.dpi}
              onChange={(dpi) => patch({ dpi })}
            />
          </View>

          <View style={styles.field}>
            <Label>Output format</Label>
            <ChipGroup
              options={RESIZE_FORMATS}
              value={s.format}
              onChange={(format) => patch({ format })}
            />
          </View>
        </>
      );
    }

    case "convert": {
      const s = settings as import("../../lib/types").ConvertSettings;
      return (
        <>
          <View style={styles.field}>
            <Label>Icon sizes</Label>
            <View style={styles.chipRow}>
              {ICO_SIZES.map((size) => {
                const active = s.sizes.includes(size);
                return (
                  <ToggleChip
                    key={size}
                    label={String(size)}
                    active={active}
                    onPress={() =>
                      patch({
                        sizes: active
                          ? s.sizes.filter((x) => x !== size)
                          : [...s.sizes, size].sort((a, b) => a - b),
                      })
                    }
                  />
                );
              })}
            </View>
            <Body muted>At least one size is required. The usual set is 16 to 256.</Body>
          </View>

          <View style={styles.field}>
            <Label>Output format</Label>
            <ChipGroup options={CONVERT_FORMATS} value={s.format} onChange={(format) => patch({ format })} />
          </View>
        </>
      );
    }

    case "enhance": {
      const s = settings as EnhanceSettings;
      return (
        <>
          <Toggle label="Automatic (recommended)" value={s.auto} onChange={(auto) => patch({ auto })} />

          {s.auto ? (
            <Body muted>
              The engine measures each image and picks the settings. Turn this off to fine-tune
              below.
            </Body>
          ) : (
            <>
              <NumberField label="Sharpness" value={s.sharpness} min={0.5} max={2.5} step={0.01} decimals={2} onChange={(sharpness) => patch({ sharpness })} />
              <NumberField label="Contrast" value={s.contrast} min={0.5} max={2} step={0.01} decimals={2} onChange={(contrast) => patch({ contrast })} />
              <NumberField label="Saturation" value={s.saturation} min={0} max={2.5} step={0.01} decimals={2} onChange={(saturation) => patch({ saturation })} />
              <NumberField label="Brightness" value={s.brightness} min={0.5} max={1.8} step={0.01} decimals={2} onChange={(brightness) => patch({ brightness })} />
              <View style={styles.field}>
                <Label>Denoise</Label>
                <ChipGroup
                  options={[
                    { value: 0, label: "Off" },
                    { value: 1, label: "Light" },
                    { value: 2, label: "Strong" },
                  ]}
                  value={s.denoise}
                  onChange={(denoise) => patch({ denoise: denoise as 0 | 1 | 2 })}
                />
              </View>
            </>
          )}

          <View style={styles.field}>
            <Label>Resize</Label>
            <ChipGroup
              options={UPSCALE_OPTIONS}
              value={s.scale}
              onChange={(scale) => patch({ scale })}
            />
          </View>

          <View style={styles.field}>
            <Label>AI upscale</Label>
            <ChipGroup
              options={AI_UPSCALE_OPTIONS}
              value={s.aiUpscale ?? 0}
              onChange={(value) =>
                patch(value === 0 ? { aiUpscale: undefined } : { aiUpscale: value })
              }
            />
            <Body muted>Needs the AI model on the server and takes much longer.</Body>
          </View>

          <View style={styles.field}>
            <Label>Output format</Label>
            <ChipGroup options={ENHANCE_FORMATS} value={s.format} onChange={(format) => patch({ format })} />
          </View>
        </>
      );
    }

    case "removebg": {
      const s = settings as import("../../lib/types").RemoveBgSettings;
      return (
        <>
          <View style={styles.field}>
            <Label>Background</Label>
            <ChipGroup
              options={REMOVEBG_BACKGROUNDS}
              value={s.background}
              onChange={(background) => patch({ background })}
            />
          </View>
          <View style={styles.field}>
            <Label>Output format</Label>
            <ChipGroup options={REMOVEBG_FORMATS} value={s.format} onChange={(format) => patch({ format })} />
          </View>
          <Body muted>Transparent output must be PNG.</Body>
        </>
      );
    }

    case "compress": {
      const s = settings as import("../../lib/types").CompressSettings;
      return (
        <>
          <View style={styles.field}>
            <Label>Target size</Label>
            <ChipGroup
              options={COMPRESS_PRESETS.map((kb) => ({ value: kb, label: `${kb} KB` }))}
              value={COMPRESS_PRESETS.includes(s.targetKb as (typeof COMPRESS_PRESETS)[number]) ? s.targetKb : 200}
              onChange={(targetKb) => patch({ targetKb })}
            />
          </View>
          <View style={styles.field}>
            <Label>Custom target (KB)</Label>
            <Field
              value={String(s.targetKb)}
              onChangeText={(v) => patch({ targetKb: Number(v.replace(/[^0-9]/g, "")) || 0 })}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.field}>
            <Label>Output format</Label>
            <ChipGroup options={COMPRESS_FORMATS} value={s.format} onChange={(format) => patch({ format })} />
          </View>
        </>
      );
    }

    case "watermark": {
      const s = settings as import("../../lib/types").WatermarkSettings;
      return (
        <>
          <View style={styles.field}>
            <Label>Text</Label>
            <Field value={s.text} onChangeText={(text) => patch({ text })} autoCapitalize="sentences" />
          </View>
          <View style={styles.field}>
            <Label>Position</Label>
            <ChipGroup
              options={WATERMARK_POSITIONS}
              value={s.position}
              onChange={(position) => patch({ position })}
            />
          </View>
          <NumberField label="Opacity %" value={s.opacity} min={5} max={100} onChange={(opacity) => patch({ opacity })} />
          <NumberField label="Size %" value={s.size} min={2} max={40} onChange={(size) => patch({ size })} />
          <View style={styles.field}>
            <Label>Colour</Label>
            <ChipGroup options={WATERMARK_COLORS} value={s.color} onChange={(color) => patch({ color })} />
          </View>
          <View style={styles.field}>
            <Label>Output format</Label>
            <ChipGroup options={ENHANCE_FORMATS} value={s.format} onChange={(format) => patch({ format })} />
          </View>
        </>
      );
    }

    default:
      return null;
  }
}


const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  buttonRow: { flexDirection: "row", gap: 12 },
  flex: { flex: 1 },
  field: { gap: 8 },
  fieldRow: { flexDirection: "row", gap: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  missing: { padding: 24 },
});
