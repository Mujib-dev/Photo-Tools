import * as ImagePicker from "expo-image-picker";
import { useMemo } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Body, Button, useColors } from "./ui";
import * as api from "../lib/api";
import { formatBytes, formatFormat, formatPixels } from "../lib/format";
import type { JobItem } from "../lib/useJobs";

/**
 * Picks images from the library or camera, filtered to image types only.
 */
export async function pickImages(
  options: { multiple: boolean; fromCamera?: boolean } = { multiple: true },
): Promise<
  { uri: string; fileName: string; mimeType: string; width: number; height: number }[]
> {
  const shared: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsMultipleSelection: options.multiple,
    quality: 1,
  };

  const result = options.fromCamera
    ? await ImagePicker.launchCameraAsync(shared)
    : await ImagePicker.launchImageLibraryAsync(shared);

  if (result.canceled || !result.assets) return [];

  return result.assets.map((asset, index) => ({
    uri: asset.uri,
    fileName: asset.fileName ?? `image-${index + 1}.jpg`,
    mimeType: asset.mimeType ?? "image/jpeg",
    width: asset.width,
    height: asset.height,
  }));
}

/** Shows each picked file and its live processing state. */
export function JobList({
  items,
  onRemove,
  onSave,
  onShare,
}: {
  items: JobItem[];
  onRemove: (key: string) => void;
  onSave: (item: JobItem) => void;
  onShare: (item: JobItem) => void;
}) {
  const colors = useColors();

  if (items.length === 0) {
    return (
      <Body muted>
        No images yet. Use the buttons above to pick some from your library or camera.
      </Body>
    );
  }

  return (
    <View style={styles.list}>
      {items.map((item) => (
        <JobRow key={item.key} item={item} onRemove={onRemove} onSave={onSave} onShare={onShare} />
      ))}
    </View>
  );
}

function JobRow({
  item,
  onRemove,
  onSave,
  onShare,
}: {
  item: JobItem;
  onRemove: (key: string) => void;
  onSave: (item: JobItem) => void;
  onShare: (item: JobItem) => void;
}) {
  const colors = useColors();

  const tone = useMemo(() => {
    switch (item.state) {
      case "failed":
        return colors.danger;
      case "completed":
      case "saved":
        return colors.success;
      default:
        return colors.textMuted;
    }
  }, [colors, item.state]);

  const active = item.state === "uploading" || item.state === "queued" || item.state === "processing";

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Image source={{ uri: item.previewUri }} style={styles.thumb} />

      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>
          {item.file.fileName}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
          {formatPixels(item.width, item.height)}
          {item.record ? ` · ${formatFormat(item.record.outputFormat)}` : ""}
          {item.record?.outputSize ? ` · ${formatBytes(item.record.outputSize)}` : ""}
        </Text>

        <View style={styles.statusRow}>
          {active ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          <Text style={[styles.rowStatus, { color: tone }]} numberOfLines={2}>
            {item.error ?? item.stage}
          </Text>
        </View>

        <View style={styles.actions}>
          {item.localUri ? (
            <>
              <Button title="Save to Photos" onPress={() => onSave(item)} variant="secondary" style={styles.smallButton} />
              <Button title="Share" onPress={() => onShare(item)} variant="ghost" style={styles.smallButton} />
            </>
          ) : null}
          <Pressable onPress={() => onRemove(item.key)} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.remove, { color: colors.danger }]}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: "#8883" },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: "600" },
  rowMeta: { fontSize: 12 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowStatus: { fontSize: 13, flex: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 },
  smallButton: { paddingVertical: 8, paddingHorizontal: 12, minHeight: 36 },
  remove: { fontSize: 14, fontWeight: "600", paddingVertical: 8 },
});

export async function shareFile(uri: string) {
  const Sharing = await import("expo-sharing");
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri);
  return true;
}

/**
 * Save a processed file into the device photo library.
 *
 * `MediaLibrary.saveToLibraryAsync` throws at runtime in SDK 57, so `Asset.create`
 * is used to write the file. The permission helpers also moved to the `/legacy`
 * entry point, since this is called outside a React component and cannot use the
 * `usePermissions` hook.
 */
export async function saveToPhotos(uri: string): Promise<void> {
  const { Asset } = await import("expo-media-library");
  const { requestPermissionsAsync } = await import("expo-media-library/legacy");

  const permission = await requestPermissionsAsync(true);
  if (!permission.granted) {
    throw new Error("PicTools needs permission to add photos to your library.");
  }

  const asset = await Asset.create(uri);
  if (!asset) throw new Error("Could not save to your photo library.");
}
