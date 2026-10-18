import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { Banner, Body, Button, Card, Field, Label, SectionTitle, useColors } from "../components/ui";
import { useSession } from "../lib/session";

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signIn, signUp, serverUrl } = useSession();

  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("demo@pic.tools");
  const [password, setPassword] = useState("password123");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "in") await signIn(email, password);
      else await signUp(email, password);
      router.replace("/tools");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
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
        <SectionTitle>{mode === "in" ? "Sign in" : "Create an account"}</SectionTitle>
        <Body muted>Connected to {serverUrl}</Body>

        <View style={styles.field}>
          <Label>Email</Label>
          <Field value={email} onChangeText={setEmail} keyboardType="email-address" />
        </View>

        <View style={styles.field}>
          <Label>Password</Label>
          <Field
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="At least 8 characters"
          />
        </View>

        {error ? <Banner tone="error">{error}</Banner> : null}

        <Button
          title={busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
          onPress={submit}
          disabled={busy}
        />
        <Button
          title={mode === "in" ? "I need an account" : "I already have an account"}
          onPress={() => {
            setMode(mode === "in" ? "up" : "in");
            setError(null);
          }}
          variant="ghost"
        />
      </Card>

      <Button title="Change server" onPress={() => router.replace("/server")} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  field: { gap: 8 },
});
