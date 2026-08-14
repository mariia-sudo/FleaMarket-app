import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/auth";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.bg },
            headerTitleStyle: { fontSize: 17, fontWeight: "600", color: colors.ink },
            headerTintColor: colors.ink,
            // Without this the back button prints the previous route's name, and
            // for a group route that name is the literal "(tabs)".
            headerBackButtonDisplayMode: "minimal",
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="listing/[id]" options={{ title: "", headerTransparent: true }} />
          <Stack.Screen name="chat/[id]" options={{ title: "Chat" }} />
          <Stack.Screen name="order/[id]" options={{ title: "Order" }} />
          <Stack.Screen name="seller/[id]" options={{ title: "Profile" }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
