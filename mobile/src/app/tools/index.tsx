import { Link, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Body, Button, Card, SectionTitle, useColors } from "../../components/ui";
import { useSession } from "../../lib/session";
import { TOOLS } from "../../lib/tools";

export default function ToolList() {
  const colors = useColors();
  const router = useRouter();
  const { user, signOut } = useSession();

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
    >
      <Card>
        <SectionTitle>Signed in</SectionTitle>
        <Body>{user?.email ?? "Guest"}</Body>
        <Button title="Sign out" onPress={() => void signOut()} variant="secondary" />
      </Card>

      <SectionTitle>Images</SectionTitle>
      <View style={styles.grid}>
        {TOOLS.map((tool) => (
          <Link key={tool.id} href={`/tools/${tool.id}`} asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.glyph, { color: colors.primary }]}>{tool.glyph}</Text>
              <Text style={[styles.title, { color: colors.text }]}>{tool.title}</Text>
              <Text style={[styles.desc, { color: colors.textMuted }]}>{tool.description}</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      <SectionTitle>Documents</SectionTitle>
      <View style={styles.grid}>
        <Link href="/scan" asChild>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text style={[styles.glyph, { color: colors.primary }]}>▤</Text>
            <Text style={[styles.title, { color: colors.text }]}>Scan</Text>
            <Text style={[styles.desc, { color: colors.textMuted }]}>
              Photograph a document and flatten it into a PDF.
            </Text>
          </Pressable>
        </Link>

        <Link href="/pdf" asChild>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text style={[styles.glyph, { color: colors.primary }]}>▦</Text>
            <Text style={[styles.title, { color: colors.text }]}>PDF</Text>
            <Text style={[styles.desc, { color: colors.textMuted }]}>
              Convert, merge or split PDF files.
            </Text>
          </Pressable>
        </Link>
      </View>

      <Button title="Change server" onPress={() => router.push("/server")} variant="ghost" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    flexGrow: 1,
    flexBasis: "47%",
    minWidth: 150,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    minHeight: 132,
  },
  glyph: { fontSize: 26, fontWeight: "700" },
  title: { fontSize: 16, fontWeight: "700" },
  desc: { fontSize: 13, lineHeight: 18 },
});
