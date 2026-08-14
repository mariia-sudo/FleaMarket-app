import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { Avatar, Badge, Button, Coins, Divider, Empty, Loader, Txt } from "../../src/components/ui";
import { formatCoins, formatDate } from "../../src/money";
import { colors, radius, shadow, space } from "../../src/theme";
import { useQuery } from "../../src/useQuery";

const CONDITION_LABEL: Record<string, string> = {
  NEW: "New",
  LIKE_NEW: "Like new",
  GOOD: "Good",
  FAIR: "Fair",
};

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, refresh } = useAuth();

  const [photoIndex, setPhotoIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useQuery(() => api.listing(id), [id]);
  const listing = data?.listing;

  if (loading && !listing) return <Loader />;
  if (error || !listing) {
    return <Empty icon="alert-circle-outline" title="Listing not found" body={error ?? "It may have been removed."} />;
  }

  const isMine = listing.seller.id === user?.id;
  const affordable = (user?.balanceCoins ?? 0) >= listing.priceCoins;
  const shortfall = listing.priceCoins - (user?.balanceCoins ?? 0);
  const place = [listing.city, listing.state].filter(Boolean).join(", ");

  async function buy() {
    setBusy(true);
    try {
      const { order } = await api.buy(listing!.id);
      await refresh();
      router.replace(`/order/${order.id}`);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Couldn't complete the purchase";
      Alert.alert("Purchase failed", message);
      void reload();
    } finally {
      setBusy(false);
    }
  }

  function confirmBuy() {
    Alert.alert(
      `Buy for ${formatCoins(listing!.priceCoins)} coins?`,
      // Spell out escrow every single time. It is the reason the coins exist, and
      // a buyer who doesn't understand it will read the deduction as a scam.
      `Your coins are held safely until you confirm you've picked the item up. ${listing!.seller.displayName} doesn't get paid before that, and you can cancel any time until then.`,
      [
        { text: "Not now", style: "cancel" },
        { text: "Hold my coins", onPress: buy },
      ],
    );
  }

  async function message() {
    setBusy(true);
    try {
      const { threadId } = await api.openThread(listing!.id);
      router.push(`/chat/${threadId}`);
    } catch (e) {
      Alert.alert("Couldn't open chat", e instanceof ApiError ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Photos: a plain paging ScrollView. No carousel library for four images. */}
        <View style={{ height: width }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / width))
            }
          >
            {listing.photos.map((photo) => (
              <Image
                key={photo.id}
                source={{ uri: photo.url }}
                style={{ width, height: width }}
                contentFit="cover"
                transition={200}
              />
            ))}
          </ScrollView>

          {listing.photos.length > 1 ? (
            <View style={styles.dots}>
              {listing.photos.map((photo, i) => (
                <View
                  key={photo.id}
                  style={[styles.dot, i === photoIndex && { backgroundColor: colors.onDark }]}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Badge label={CONDITION_LABEL[listing.condition] ?? listing.condition} />
            <Badge label={listing.category} />
            {listing.status !== "ACTIVE" ? <Badge label={listing.status} tone="warn" /> : null}
          </View>

          <Txt variant="title">{listing.title}</Txt>
          <Coins amount={listing.priceCoins} size="lg" tone="plain" />

          <View style={{ flexDirection: "row", gap: space.lg }}>
            {place ? (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={15} color={colors.inkMuted} />
                <Txt variant="caption" color={colors.inkMuted}>
                  {place}
                </Txt>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={15} color={colors.inkMuted} />
              <Txt variant="caption" color={colors.inkMuted}>
                {formatDate(listing.createdAt)}
              </Txt>
            </View>
          </View>

          <Divider />

          <Txt variant="body" color={colors.inkSoft}>
            {listing.description}
          </Txt>

          <Divider />

          <Pressable style={styles.seller}>
            <Avatar user={listing.seller} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="bodyStrong">{listing.seller.displayName}</Txt>
              <Txt variant="caption" color={colors.inkMuted} numberOfLines={1}>
                {listing.seller.bio ?? `Joined ${formatDate(listing.seller.createdAt)}`}
              </Txt>
            </View>
          </Pressable>

          <View style={styles.escrowNote}>
            <Ionicons name="lock-closed" size={16} color={colors.positive} />
            <Txt variant="caption" color={colors.inkSoft} style={{ flex: 1 } as object}>
              Coins are held until you confirm pickup. The seller keeps 100% — no selling fees.
            </Txt>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        {isMine ? (
          <Button label="This is your listing" onPress={() => router.push("/(tabs)/you")} variant="secondary" full />
        ) : listing.status !== "ACTIVE" ? (
          <Button label="No longer available" onPress={() => router.back()} variant="secondary" full disabled />
        ) : (
          <>
            <Button label="Message" icon="chatbubble-outline" onPress={message} variant="secondary" />
            <View style={{ flex: 1 }}>
              {affordable ? (
                <Button label={`Buy · ${formatCoins(listing.priceCoins)}`} onPress={confirmBuy} loading={busy} full />
              ) : (
                <Button
                  label={`Add ${formatCoins(shortfall)} coins`}
                  variant="coin"
                  onPress={() => router.push("/(tabs)/wallet")}
                  full
                />
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xl, gap: space.lg },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dots: {
    position: "absolute",
    bottom: space.lg,
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    backgroundColor: "rgba(20,17,14,0.35)",
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(251,248,243,0.45)" },
  seller: { flexDirection: "row", alignItems: "center", gap: space.md },
  escrowNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    backgroundColor: colors.positiveSoft,
    padding: space.lg,
    borderRadius: radius.md,
  },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    ...shadow.raised,
  },
});
