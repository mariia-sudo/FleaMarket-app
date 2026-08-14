import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";
import type { Listing } from "../api";
import { colors, radius, shadow, space } from "../theme";
import { Coins, Txt } from "./ui";

/**
 * The feed cell. Photo-first with a fixed square, because a marketplace feed
 * where every row is a different height is a feed nobody scrolls.
 */
export function ListingCard({
  listing,
  onPress,
  onToggleFavorite,
}: {
  listing: Listing;
  onPress: () => void;
  onToggleFavorite?: () => void;
}) {
  const cover = listing.photos[0]?.url;
  const place = [listing.city, listing.state].filter(Boolean).join(", ");

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}>
      <View style={styles.photoWrap}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.photo} contentFit="cover" transition={180} />
        ) : (
          <View style={[styles.photo, styles.photoEmpty]}>
            <Ionicons name="image-outline" size={22} color={colors.inkMuted} />
          </View>
        )}

        {onToggleFavorite ? (
          <Pressable
            onPress={onToggleFavorite}
            hitSlop={10}
            style={styles.heart}
            accessibilityRole="button"
            accessibilityLabel={listing.favorited ? "Remove from saved" : "Save listing"}
          >
            <Ionicons
              name={listing.favorited ? "heart" : "heart-outline"}
              size={17}
              color={listing.favorited ? colors.danger : colors.ink}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: 5, paddingHorizontal: 2 }}>
        <Coins amount={listing.priceCoins} size="md" tone="plain" />
        <Txt variant="body" numberOfLines={2}>
          {listing.title}
        </Txt>
        {place ? (
          <Txt variant="caption" color={colors.inkMuted} numberOfLines={1}>
            {place}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: space.md },
  photoWrap: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
    ...shadow.card,
  },
  photo: { width: "100%", height: "100%" },
  photoEmpty: { alignItems: "center", justifyContent: "center" },
  heart: {
    position: "absolute",
    top: space.sm,
    right: space.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
});
