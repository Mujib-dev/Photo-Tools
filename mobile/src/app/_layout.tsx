import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SessionProvider } from "../lib/session";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerTitleStyle: { fontWeight: "700" } }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="server" options={{ title: "Connect" }} />
          <Stack.Screen name="login" options={{ title: "Sign in" }} />
          <Stack.Screen name="tools/index" options={{ title: "PicTools" }} />
          <Stack.Screen name="tools/[id]" options={{ title: "" }} />
          <Stack.Screen name="scan" options={{ title: "Scan document" }} />
          <Stack.Screen name="pdf" options={{ title: "PDF tools" }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
