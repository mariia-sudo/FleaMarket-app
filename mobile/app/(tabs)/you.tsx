import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { Avatar, Button, Card, Coins, Divider, Empty, Txt } from "../../src/components/ui";
import { ListingCard } from "../../src/components/ListingCard";
import { formatUsd } from "../../src/money";
import { colors, radius, space } from "../../src/theme";
import { useQuery } from "../../src/useQuery";

type Tab = "listings" | "saved";

export default function You() {
  const insets = useSafeAreaInsets();
  const { user, signOut, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>("listings");

  const mine = useQuery(
    () => (user ? api.listings({ sellerId: user.id, limit: 50 }) : Promise.resolve({ listings: [], nextCursor: null })),
    [user?.id],
  );
  const saved = useQuery(() => api.favorites(), []);

  if (!user) return null;

  const items = tab === "listings" ? (mine.data?.listings ?? []) : (saved.data?.listings ?? []);

  async function remove(id: string) {
    Alert.alert("Remove this listing?", "It disappears from the feed. Past orders are kept.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await api.removeListing(id);
          await mine.reload();
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + space.lg }]}>
      <View style={styles.profile}>
        <Avatar user={user} size={64} />
        <View style={{ flex: 1, gap: 3 }}>
          <Txt variant="title">{user.displayName}</Txt>
          <Txt variant="caption" color={colors.inkMuted}>
            {[user.city, user.state].filter(Boolean).join(", ") || user.email}
          </Txt>
        </View>
      </View>

      {user.bio ? (
        <Txt variant="body" color={colors.inkSoft}>
          {user.bio}
        </Txt>
      ) : null}

      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ gap: 2 }}>
            <Txt variant="caption" color={colors.inkMuted}>
              Balance
            </Txt>
            <Coins amount={user.balanceCoins} size="md" tone="plain" />
          </View>
          <Button label="Wallet" variant="secondary" onPress={() => router.push("/(tabs)/wallet")} />
        </View>
        <Divider />
        <Pressable style={styles.link} onPress={() => router.push(`/seller/${user.id}`)}>
          <Ionicons name="star-outline" size={19} color={colors.inkSoft} />
          <Txt variant="body" style={{ flex: 1 } as object}>
            Your public profile & reviews
          </Txt>
          <Ionicons name="chevron-forward" size={17} color={colors.inkMuted} />
        </Pressable>
        <Pressable style={styles.link} onPress={() => router.push("/(tabs)/inbox")}>
          <Ionicons name="receipt-outline" size={19} color={colors.inkSoft} />
          <Txt variant="body" style={{ flex: 1 } as object}>
            Orders & messages
          </Txt>
          <Ionicons name="chevron-forward" size={17} color={colors.inkMuted} />
        </Pressable>
        <Pressable
          style={styles.link}
          onPress={async () => {
            await refresh();
            Alert.alert("Refreshed", `Balance is ${user.balanceCoins / 100} coins.`);
          }}
        >
          <Ionicons name="refresh-outline" size={19} color={colors.inkSoft} />
          <Txt variant="body" style={{ flex: 1 } as object}>
            Refresh account
          </Txt>
        </Pressable>
      </Card>

      <View style={styles.segment}>
        {(["listings", "saved"] as Tab[]).map((id) => {
          const active = tab === id;
          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
            >
              <Txt variant="caption" color={active ? colors.ink : colors.inkMuted}>
                {id === "listings" ? "My listings" : "Saved"}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      {items.length === 0 ? (
        <Empty
          icon={tab === "listings" ? "pricetag-outline" : "heart-outline"}
          title={tab === "listings" ? "Nothing listed yet" : "Nothing saved yet"}
          body={
            tab === "listings"
              ? "Post something you're not using. Sellers keep 100% of the coins."
              : "Tap the heart on anything in the feed to keep it here."
          }
          action={
            tab === "listings" ? (
              <Button label="Sell something" onPress={() => router.push("/(tabs)/sell")} />
            ) : undefined
          }
        />
      ) : (
        <View style={styles.grid}>
          {items.map((listing) => (
            <View key={listing.id} style={{ width: "47%" }}>
              <ListingCard listing={listing} onPress={() => router.push(`/listing/${listing.id}`)} />
              {tab === "listings" ? (
                <Pressable onPress={() => remove(listing.id)} style={{ paddingVertical: space.sm }}>
                  <Txt variant="caption" color={colors.danger}>
                    Remove
                  </Txt>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      )}

      <Button
        label="Sign out"
        variant="ghost"
        full
        onPress={() =>
          Alert.alert("Sign out?", "", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign out",
              style: "destructive",
              onPress: async () => {
                await signOut();
                router.replace("/(auth)/sign-in");
              },
            },
          ])
        }
      />

      <Txt variant="caption" color={colors.inkMuted} center>
        Coins cash out at {formatUsd(85)} each · {user.email}
      </Txt>

      <View style={{ height: space.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: space.lg, gap: space.lg, paddingBottom: space.xl },
  profile: { flexDirection: "row", alignItems: "center", gap: space.lg },
  link: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.pill,
    padding: 3,
  },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.pill },
  segmentItemActive: { backgroundColor: colors.surface },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.lg, justifyContent: "space-between" },
});
