import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "../../src/api";
import { useAuth } from "../../src/auth";
import { Button, Field, Txt } from "../../src/components/ui";
import { colors, space } from "../../src/theme";

export default function SignUp() {
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signUp({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        city: city.trim() || undefined,
        // The API wants a 2-letter code; anything else is dropped rather than
        // rejected, since location is optional.
        state: state.trim().length === 2 ? state.trim().toUpperCase() : undefined,
      });
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create the account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: space.sm }}>
          <Txt variant="display">Create your account</Txt>
          <Txt variant="body" color={colors.inkSoft}>
            Your neighbourhood is only used to show buyers roughly where you are.
          </Txt>
        </View>

        <View style={{ gap: space.lg }}>
          <Field
            label="Name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How you'll show up to buyers"
            autoComplete="name"
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            hint="At least 8 characters"
            placeholder="••••••••"
            error={error}
          />

          <View style={{ flexDirection: "row", gap: space.md }}>
            <View style={{ flex: 3 }}>
              <Field label="City" value={city} onChangeText={setCity} placeholder="Brooklyn" />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="State"
                value={state}
                onChangeText={setState}
                placeholder="NY"
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>
          </View>

          <Button label="Create account" onPress={submit} loading={busy} full />

          <Pressable onPress={() => router.back()} style={{ paddingVertical: space.sm }}>
            <Txt variant="body" color={colors.inkSoft} center>
              Already have an account? <Txt variant="bodyStrong">Sign in</Txt>
            </Txt>
          </Pressable>
        </View>
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
});
