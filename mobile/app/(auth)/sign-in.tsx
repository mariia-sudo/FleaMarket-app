import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "../../src/api";
import { useAuth } from "../../src/auth";
import { Button, Field, Txt } from "../../src/components/ui";
import { colors, radius, space } from "../../src/theme";

export default function SignIn() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 48 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.mark}>
          <Ionicons name="pricetag" size={22} color={colors.onDark} />
        </View>

        <View style={{ gap: space.sm }}>
          <Txt variant="display">Everything nearby,{"\n"}second hand.</Txt>
          <Txt variant="body" color={colors.inkSoft}>
            Buy and sell with coins. Every deal is held until you have the item in
            your hands.
          </Txt>
        </View>

        <View style={{ gap: space.lg, marginTop: space.sm }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholder="••••••••"
            error={error}
          />

          <Button label="Sign in" onPress={submit} loading={busy} full />

          <Link href="/(auth)/sign-up" asChild>
            <Pressable style={{ paddingVertical: space.sm }}>
              <Txt variant="body" color={colors.inkSoft} center>
                New here? <Txt variant="bodyStrong">Create an account</Txt>
              </Txt>
            </Pressable>
          </Link>
        </View>

        {/* Seeded demo accounts — delete this block before anyone real sees the app. */}
        <Pressable
          style={styles.demo}
          onPress={() => {
            setEmail("sam@example.com");
            setPassword("password123");
          }}
        >
          <Ionicons name="flask-outline" size={15} color={colors.inkMuted} />
          <Txt variant="caption" color={colors.inkMuted}>
            Tap to fill the demo account
          </Txt>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl,
    gap: space.xl,
  },
  mark: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  demo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    marginTop: "auto",
    paddingVertical: space.md,
  },
});
