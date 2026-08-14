import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { ListingCard } from "../../src/components/ListingCard";
import { Stars } from "../../src/components/Stars";
import { Avatar, Badge, Divider, Empty, Loader, Txt } from "../../src/components/ui";
import { formatDate } from "../../src/money";
import { colors, radius, space } from "../../src/theme";
import { useQuery } from "../../src/useQuery";

/**
 * Public seller profile — the trust screen.
 *
 * A stranger is about to hand over coins for a used sofa. Everything here exists
 * to answer "is this person real and have they done this before", using only
 * things they can't fabricate: completed trades and reviews attached to them.
 */
export default function SellerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();

  const { data, loading, error } = useQuery(() => api.profile(id), [id]);

  if (loading && !data) return <Loader />;
  if (error || !data) {
    return <Empty icon="person-outline" title="Profile not found" body={error ?? ""} />;
  }

  const { user, stats, listings, reviews } = data;
  const isMe = me?.id === user.id;
  const place = [user.city, user.state].filter(Boolean).join(", ");

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Avatar user={user} size={72} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Txt variant="title">{user.displayName}</Txt>

          {stats.ratingCount > 0 ? (
            <View style={styles.ratingRow}>
              <Stars rating={stats.ratingAverage ?? 0} size={15} />
              <Txt variant="caption" color={colors.inkSoft}>
                {stats.ratingAverage} · {stats.ratingCount}{" "}
                {stats.ratingCount === 1 ? "review" : "reviews"}
              </Txt>
            </View>
          ) : (
            <Badge label="No reviews yet" />
          )}

          <Txt variant="caption" color={colors.inkMuted}>
            Member since {formatDate(user.createdAt)}
          </Txt>
        </View>
      </View>

      {user.bio ? (
        <Txt variant="body" color={colors.inkSoft}>
          {user.bio}
        </Txt>
      ) : null}

      {/* Location. Deliberately vague, and said out loud so nobody wonders. */}
      {place ? (
        <View style={styles.location}>
          <Ionicons name="location-outline" size={17} color={colors.inkSoft} />
          <View style={{ flex: 1, gap: 1 }}>
            <Txt variant="bodyStrong">{place}</Txt>
            <Txt variant="caption" color={colors.inkMuted}>
              Neighbourhood only — you agree on the exact spot in chat
            </Txt>
          </View>
        </View>
      ) : null}

      <View style={styles.stats}>
        <Stat value={stats.completedSales} label={stats.completedSales === 1 ? "sale" : "sales"} />
        <View style={styles.statDivider} />
        <Stat
          value={stats.completedPurchases}
          label={stats.completedPurchases === 1 ? "purchase" : "purchases"}
        />
        <View style={styles.statDivider} />
        <Stat value={stats.activeListings} label="listed now" />
      </View>

      {/* Listings */}
      <View style={{ gap: space.md }}>
        <Txt variant="heading">
          {isMe ? "Your listings" : `${user.displayName}'s listings`}
        </Txt>
        {listings.length === 0 ? (
          <Txt variant="body" color={colors.inkMuted}>
            Nothing for sale right now.
          </Txt>
        ) : (
          <View style={styles.grid}>
            {listings.map((listing) => (
              <View key={listing.id} style={{ width: "47%" }}>
                <ListingCard
                  listing={listing}
                  onPress={() => router.push(`/listing/${listing.id}`)}
                />
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Reviews */}
      <View style={{ gap: space.md }}>
        <Txt variant="heading">Reviews</Txt>

        {reviews.length === 0 ? (
          <View style={styles.noReviews}>
            <Txt variant="body" color={colors.inkMuted}>
              No reviews yet. They only appear after a completed trade — nobody can
              leave one without actually buying or selling something.
            </Txt>
          </View>
        ) : (
          <View style={{ gap: space.md }}>
            {reviews.map((review) => (
              <View key={review.id} style={styles.review}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                  <Avatar user={review.author} size={34} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="bodyStrong">{review.author.displayName}</Txt>
                    <Txt variant="caption" color={colors.inkMuted}>
                      {formatDate(review.createdAt)}
                    </Txt>
                  </View>
                  <Stars rating={review.rating} size={13} />
                </View>

                {review.body ? (
                  <Txt variant="body" color={colors.inkSoft}>
                    {review.body}
                  </Txt>
                ) : null}

                <Divider />

                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  {/* Says which hat they were wearing — "good buyer" and "good
                      seller" are genuinely different signals. */}
                  <Badge label={review.role === "seller" ? "As seller" : "As buyer"} />
                  <Txt variant="caption" color={colors.inkMuted} numberOfLines={1} style={{ flex: 1 } as object}>
                    {review.listingTitle}
                  </Txt>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={{ height: space.xxl }} />
    </ScrollView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Txt variant="title">{String(value)}</Txt>
      <Txt variant="caption" color={colors.inkMuted}>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, gap: space.lg },
  header: { flexDirection: "row", alignItems: "center", gap: space.lg },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    padding: space.lg,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
  },
  statDivider: { width: 1, height: 32, backgroundColor: colors.line },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.lg, justifyContent: "space-between" },
  noReviews: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    padding: space.lg,
  },
  review: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
});
