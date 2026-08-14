import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/auth";
import { colors } from "../src/theme";

/**
 * Entry gate. Sits on `/` and immediately hands off to the app or the sign-in
 * flow once the stored session has been checked.
 */
export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.inkMuted} />
      </View>
    );
  }

  return <Redirect href={user ? "/(tabs)" : "/(auth)/sign-in"} />;
}
