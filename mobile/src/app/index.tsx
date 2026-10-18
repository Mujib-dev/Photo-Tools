import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useColors } from "../components/ui";
import { useSession } from "../lib/session";

/**
 * Routes the user to whichever step they still need: connect to a server,
 * sign in, or the tool list.
 */
export default function Index() {
  const { status } = useSession();
  const colors = useColors();

  if (status === "loading") {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (status === "needs-server") return <Redirect href="/server" />;
  if (status === "needs-auth") return <Redirect href="/login" />;
  return <Redirect href="/tools" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
