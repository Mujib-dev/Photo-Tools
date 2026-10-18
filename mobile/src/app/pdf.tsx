import * as DocumentPicker from "expo-document-picker";
import { Stack } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { shareFile } from "../components/jobList";
import { Banner, Body, Button, Card, SectionTitle, useColors } from "../components/ui";
import * as api from "../lib/api";
import { formatBytes } from "../lib/format";
import { PDF_TOOLS, type PdfOp } from "../lib/types";

/**
 * PDF operations. The backend caps a job at 10 files, and every file must be a
 * real PDF, so the picker filters on the PDF mime type.
 */

const MAX_FILES = 10;

export default function PdfScreen() {
  const colors = useColors();
  const [op, setOp] = useState<PdfOp>("convert");
  const [files, setFiles] = useState<api.UploadFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "info" | "success"; text: string } | null>(null);
  const [result, setResult] = useState<{ name: string; uri: string; size: number } | null>(null);

  const pick = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: "application/pdf",
      });
      if (picked.canceled) return;

      const mapped: api.UploadFile[] = picked.assets.map((asset, i) => ({
        uri: asset.uri,
        fileName: asset.name ?? `document-${i + 1}.pdf`,
        mimeType: asset.mimeType ?? "application/pdf",
      }));

      setFiles((prev) => {
        const merged = [...prev, ...mapped];
        if (merged.length > MAX_FILES) {
          setNotice({ tone: "error", text: `The server accepts at most ${MAX_FILES} files per job.` });
        }
        return merged.slice(0, MAX_FILES);
      });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Could not open files." });
    }
  };

  const submit = useCallback(async () => {
    if (files.length === 0) return;
    setBusy(true);
    setNotice(null);
    setResult(null);
    try {
      const res = await api.submitMany("/api/pdf", files, { op });

      for (;;) {
        await new Promise((r) => setTimeout(r, 1000));
        const record = await api.getJob(res.jobId);
        if (record.state === "completed") {
          const file = await api.downloadOutput(record.id, record.downloadName ?? "output.pdf");
          setResult({
            name: record.downloadName ?? "output.pdf",
            uri: file.uri,
            size: record.outputSize ?? file.size,
          });
          setNotice({ tone: "success", text: "Finished and saved on this phone." });
          setFiles([]);
          break;
        }
        if (record.state === "failed") {
          throw new Error(record.error ?? "The PDF job failed.");
        }
      }
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "The PDF job failed." });
    } finally {
      setBusy(false);
    }
  }, [files, op]);

  const selected = PDF_TOOLS.find((t) => t.op === op);

  return (
    <>
      <Stack.Screen options={{ title: "PDF tools" }} />
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={styles.content}
      >
        <Card>
          <SectionTitle>Operation</SectionTitle>
          <View style={styles.list}>
            {PDF_TOOLS.map((tool) => {
              const active = tool.op === op;
              return (
                <Card key={tool.op}>
                  <Text
                    onPress={() => setOp(tool.op)}
                    style={[
                      styles.opTitle,
                      { color: active ? colors.primary : colors.text },
                    ]}
                  >
                    {tool.label}
                  </Text>
                  <Text onPress={() => setOp(tool.op)} style={[styles.opDesc, { color: colors.textMuted }]}>
                    {tool.desc}
                  </Text>
                </Card>
              );
            })}
          </View>
          {selected?.op === "split" ? (
            <Body muted>Split works on a single PDF — pick just one file.</Body>
          ) : null}
        </Card>

        <Card>
          <SectionTitle>Files ({files.length}/{MAX_FILES})</SectionTitle>
          {files.map((f) => (
            <View key={f.uri} style={styles.fileRow}>
              <Text numberOfLines={1} style={[styles.fileName, { color: colors.text }]}>
                {f.fileName}
              </Text>
              <Text
                onPress={() => setFiles((prev) => prev.filter((x) => x.uri !== f.uri))}
                style={[styles.remove, { color: colors.danger }]}
              >
                Remove
              </Text>
            </View>
          ))}
          <Button title="Choose PDFs" onPress={() => void pick()} variant="secondary" />
        </Card>

        {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}

        {result ? (
          <Card>
            <SectionTitle>Finished</SectionTitle>
            <Body>{result.name}</Body>
            <Body muted>{formatBytes(result.size)}</Body>
            <Button title="Open or share" onPress={() => void shareFile(result.uri)} variant="secondary" />
          </Card>
        ) : null}

        <Button
          title={busy ? "Working…" : "Run"}
          onPress={() => void submit()}
          disabled={files.length === 0 || busy}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  list: { gap: 8 },
  opTitle: { fontSize: 16, fontWeight: "700" },
  opDesc: { fontSize: 13, marginTop: 2 },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  fileName: { flex: 1, fontSize: 14 },
  remove: { fontSize: 14, fontWeight: "600" },
});
