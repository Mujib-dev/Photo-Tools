import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { Banner, Body, Button, Card, Field, Label, SectionTitle, useColors } from "../components/ui";
import { useSession } from "../lib/session";

/**
 * Asks for the address of the computer running the backend.
 *
 * The processing engines are Windows executables, so the phone cannot do the
 * work itself — it drives the backend over the local network. `localhost` on a
 * phone means the phone, so the LAN address of the PC is required.
 */
export default function ServerScreen() {
  const colors = useColors();
  const router = useRouter();
  const { connect } = useSession();

  const [url, setUrl] = useState("192.168.100.20:4000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await connect(url);
      router.replace("/login");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not reach that address. Check the phone is on the same Wi-Fi.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <SectionTitle>Your computer</SectionTitle>
        <Body muted>
          PicTools runs the image engines on your PC, so the phone needs your computer&apos;s
          address on the same Wi-Fi network.
        </Body>

        <View style={styles.field}>
          <Label>Address</Label>
          <Field
            value={url}
            onChangeText={setUrl}
            placeholder="192.168.1.20:4000"
            keyboardType="url"
          />
          <Body muted>Find this by running `ipconfig` on your computer, or check your router.</Body>
        </View>

        {error ? <Banner tone="error">{error}</Banner> : null}

        <Button title={busy ? "Connecting…" : "Connect"} onPress={onConnect} disabled={busy} />
      </Card>

      <Card>
        <SectionTitle>Before the first run</SectionTitle>
        <Body muted>
          1. Start the backend on your computer — run `run.bat` in the photo-tools folder{"\n"}
          2. Keep that window open{"\n"}
          3. Allow Node.js through the Windows Firewall when prompted{"\n"}
          4. Enter the address above
        </Body>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  field: { gap: 8 },
});
