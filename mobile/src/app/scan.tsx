import { Stack } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";

import { pickImages, shareFile } from "../components/jobList";
import {
  Banner,
  Body,
  Button,
  Card,
  ChipGroup,
  Label,
  SectionTitle,
  useColors,
} from "../components/ui";
import * as api from "../lib/api";
import { formatBytes, formatFormat } from "../lib/format";
import { SCAN_FORMATS, SCAN_MODES, type ScanMode, type ScanOutputFormat } from "../lib/types";

/**
 * Document scanning.
 *
 * Each captured page can be auto-cropped and rotated; the engine then flattens
 * the pages into a single PDF (or ZIP). Detection runs on the server, so this
 * only needs the original photo plus the chosen rotation.
 */

interface Page {
  key: string;
  picked: api.UploadFile;
  width: number;
  height: number;
  rotate: 0 | 90 | 180 | 270;
  mode?: ScanMode;
  detecting: boolean;
  corners: [number, number][] | null;
}

let pageCounter = 0;
const nextPageKey = () => `page-${(pageCounter += 1)}-${Date.now()}`;

const ROTATIONS: { value: 0 | 90 | 180 | 270; label: string }[] = [
  { value: 0, label: "0°" },
  { value: 90, label: "90°" },
  { value: 180, label: "180°" },
  { value: 270, label: "270°" },
];

export default function ScanScreen() {
  const colors = useColors();
  const [pages, setPages] = useState<Page[]>([]);
  const [mode, setMode] = useState<ScanMode>("auto");
  const [pageFormat, setPageFormat] = useState<ScanOutputFormat>("jpg");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "info" | "success"; text: string } | null>(null);
  const [result, setResult] = useState<{ name: string; uri: string; size: number } | null>(null);

  const addPages = async (fromCamera: boolean) => {
    try {
      const picked = await pickImages({ multiple: !fromCamera, fromCamera });
      if (picked.length === 0) return;
      setPages((prev) => [
        ...prev,
        ...picked.map((p) => ({
          key: nextPageKey(),
          picked: { uri: p.uri, fileName: p.fileName, mimeType: p.mimeType },
          width: p.width,
          height: p.height,
          rotate: 0 as const,
          detecting: false,
          corners: null,
        })),
      ]);
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Could not open the camera." });
    }
  };

  const detect = useCallback(async (page: Page) => {
    setPages((prev) => prev.map((p) => (p.key === page.key ? { ...p, detecting: true } : p)));
    try {
      const detection = await api.detectCorners(page.picked, page.rotate);
      setPages((prev) =>
        prev.map((p) => (p.key === page.key ? { ...p, corners: detection.corners, detecting: false } : p)),
      );
      if (!detection.corners) {
        setNotice({ tone: "info", text: "No page edges found — the whole photo will be used." });
      }
    } catch (err) {
      setPages((prev) => prev.map((p) => (p.key === page.key ? { ...p, detecting: false } : p)));
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Detection failed." });
    }
  }, []);

  const updatePage = (key: string, patch: Partial<Page>) =>
    setPages((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const rotatePage = (key: string, rotate: 0 | 90 | 180 | 270) => {
    const page = pages.find((p) => p.key === key);
    if (!page) return;
    const swap = rotate % 180 !== 0;
    const updated = {
      ...page,
      rotate,
      width: swap ? page.height : page.width,
      height: swap ? page.width : page.height,
      corners: null,
    };
    updatePage(key, { rotate, width: updated.width, height: updated.height, corners: null });
    void detect(updated);
  };

  const submit = async () => {
    if (pages.length === 0) return;
    setBusy(true);
    setNotice(null);
    setResult(null);
    try {
      const res = await api.submitMany(
        "/api/scan",
        pages.map((p) => p.picked),
        {
          mode,
          format: pageFormat,
          pages: pages.map((p) => ({
            corners: p.corners,
            rotate: p.rotate,
            mode: p.mode ?? mode,
          })),
        },
      );

      // Poll until the job settles.
      for (;;) {
        await new Promise((r) => setTimeout(r, 900));
        const record = await api.getJob(res.jobId);
        if (record.state === "completed") {
          const file = await api.downloadOutput(record.id, record.downloadName ?? "scan.pdf");
          setResult({
            name: record.downloadName ?? "scan.pdf",
            uri: file.uri,
            size: record.outputSize ?? file.size,
          });
          setNotice({ tone: "success", text: "Scan finished and saved on this phone." });
          break;
        }
        if (record.state === "failed") {
          throw new Error(record.error ?? "The scan failed.");
        }
      }
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "The scan failed." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Scan document" }} />
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <SectionTitle>Pages</SectionTitle>
          <View style={styles.buttonRow}>
            <Button title="Photograph" onPress={() => void addPages(true)} style={styles.flex} />
            <Button
              title="From library"
              onPress={() => void addPages(false)}
              variant="secondary"
              style={styles.flex}
            />
          </View>
          <Body muted>Lay the page flat in even light, then auto-detect the edges.</Body>
        </Card>

        <Card>
          <SectionTitle>Output</SectionTitle>
          <View style={styles.field}>
            <Label>Mode</Label>
            <ChipGroup
              options={SCAN_MODES.map((m) => ({ value: m.value, label: m.label }))}
              value={mode}
              onChange={setMode}
            />
            <Body muted>{SCAN_MODES.find((m) => m.value === mode)?.desc}</Body>
          </View>
          <View style={styles.field}>
            <Label>Page image quality</Label>
            <ChipGroup options={SCAN_FORMATS} value={pageFormat} onChange={setPageFormat} />
            <Body muted>All pages are flattened into a single PDF.</Body>
          </View>
        </Card>

        {pages.map((page) => (
          <Card key={page.key}>
            <View style={styles.pageHead}>
              <Text style={[styles.pageTitle, { color: colors.text }]}>{page.picked.fileName}</Text>
              <Button
                title="Remove"
                onPress={() => setPages((prev) => prev.filter((p) => p.key !== page.key))}
                variant="ghost"
              />
            </View>

            <View style={styles.pageBody}>
              <Image source={{ uri: page.picked.uri }} style={styles.pageThumb} />
              <View style={styles.pageControls}>
                <Label>Rotation</Label>
                <ChipGroup
                  options={ROTATIONS}
                  value={page.rotate}
                  onChange={(rotate) => rotatePage(page.key, rotate)}
                />
                <View style={styles.gap} />
                <Button
                  title={page.detecting ? "Detecting…" : "Auto-detect edges"}
                  onPress={() => void detect(page)}
                  disabled={page.detecting}
                  variant="secondary"
                />
                {page.detecting ? <ActivityIndicator color={colors.primary} /> : null}
                {page.corners ? (
                  <Text style={[styles.detected, { color: colors.success }]}>Page edges found</Text>
                ) : null}
              </View>
            </View>
          </Card>
        ))}

        {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}

        {result ? (
          <Card>
            <SectionTitle>Finished</SectionTitle>
            <Body>{result.name}</Body>
            <Body muted>{formatFormat(result.name.split(".").pop() ?? null)} · {formatBytes(result.size)}</Body>
            <Button title="Save to Files" onPress={() => void shareFile(result.uri)} variant="secondary" />
          </Card>
        ) : null}

        <Button
          title={busy ? "Scanning…" : `Scan ${pages.length || ""} page(s)`.trim()}
          onPress={() => void submit()}
          disabled={pages.length === 0 || busy}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  buttonRow: { flexDirection: "row", gap: 12 },
  flex: { flex: 1 },
  field: { gap: 8 },
  gap: { height: 8 },
  pageHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pageTitle: { fontSize: 15, fontWeight: "600", flex: 1 },
  pageBody: { flexDirection: "row", gap: 12 },
  pageThumb: { width: 88, height: 112, borderRadius: 10, backgroundColor: "#8883" },
  pageControls: { flex: 1, gap: 8 },
  detected: { fontSize: 13, fontWeight: "600" },
});
