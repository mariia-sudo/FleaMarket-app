import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { ApiError, api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { Stars } from "../../src/components/Stars";
import { Avatar, Badge, Button, Card, Coins, Divider, Empty, Loader, Txt } from "../../src/components/ui";
import { formatCoins, formatDate } from "../../src/money";
import { colors, radius, space } from "../../src/theme";
import { useQuery } from "../../src/useQuery";

/**
 * The order screen exists to answer one question: where are my coins right now?
 * Everything on it is in service of that.
 */
export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);

  const [rating, setRating] = useState(0);
  const [reviewBody, setReviewBody] = useState("");
  const [posting, setPosting] = useState(false);

  const { data, loading, error, reload } = useQuery(() => api.order(id), [id]);
  const review = useQuery(() => api.reviewStatus(id), [id]);
  const order = data?.order;

  if (loading && !order) return <Loader />;
  if (error || !order) {
    return <Empty icon="alert-circle-outline" title="Order not found" body={error ?? ""} />;
  }

  const selling = order.seller.id === user?.id;
  const other = selling ? order.buyer : order.seller;

  async function act(action: "confirm" | "cancel") {
    setBusy(true);
    try {
      if (action === "confirm") await api.confirmOrder(order!.id);
      else await api.cancelOrder(order!.id);
      await Promise.all([reload(), refresh()]);
    } catch (e) {
      Alert.alert("Didn't work", e instanceof ApiError ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  const steps = [
    { label: "Coins held in escrow", done: true, at: order.createdAt },
    {
      label: order.status === "CANCELLED" ? "Order cancelled" : "Item handed over",
      done: order.status !== "ESCROW",
      at: order.completedAt,
    },
    {
      label: order.status === "CANCELLED" ? "Coins returned to buyer" : "Coins released to seller",
      done: order.status !== "ESCROW",
      at: order.completedAt,
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card style={{ gap: space.lg }}>
        <View style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
          {order.listing.coverUrl ? (
            <Image source={{ uri: order.listing.coverUrl }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.cover, { backgroundColor: colors.surfaceSunken }]} />
          )}
          <View style={{ flex: 1, gap: space.xs }}>
            <Txt variant="bodyStrong" numberOfLines={2}>
              {order.listing.title}
            </Txt>
            <Coins amount={order.amountCoins} size="md" tone="plain" />
          </View>
        </View>

        <Divider />

        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <Avatar user={other} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="caption" color={colors.inkMuted}>
              {selling ? "Buyer" : "Seller"}
            </Txt>
            <Txt variant="bodyStrong">{other.displayName}</Txt>
          </View>
          <Button
            label="Message"
            variant="secondary"
            onPress={async () => {
              try {
                const { threadId } = await api.openThread(order.listing.id);
                router.push(`/chat/${threadId}`);
              } catch {
                Alert.alert("Couldn't open chat", "Open it from your Inbox instead.");
              }
            }}
          />
        </View>
      </Card>

      {/* Escrow timeline */}
      <Card style={{ gap: space.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Ionicons
            name={order.status === "ESCROW" ? "lock-closed" : order.status === "COMPLETED" ? "checkmark-circle" : "close-circle"}
            size={18}
            color={order.status === "CANCELLED" ? colors.danger : colors.positive}
          />
          <Txt variant="heading">
            {order.status === "ESCROW"
              ? `${formatCoins(order.amountCoins)} coins in escrow`
              : order.status === "COMPLETED"
                ? "Deal completed"
                : "Order cancelled"}
          </Txt>
        </View>

        <View style={{ gap: space.md }}>
          {steps.map((step, index) => (
            <View key={index} style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
              <View style={[styles.stepDot, step.done && { backgroundColor: colors.positive, borderColor: colors.positive }]}>
                {step.done ? <Ionicons name="checkmark" size={11} color="#FFFFFF" /> : null}
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Txt variant="body" color={step.done ? colors.ink : colors.inkMuted}>
                  {step.label}
                </Txt>
                {step.at ? (
                  <Txt variant="caption" color={colors.inkMuted}>
                    {formatDate(step.at)}
                  </Txt>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </Card>

      {order.status === "ESCROW" ? (
        <View style={{ gap: space.md }}>
          {selling ? (
            <Card style={{ gap: space.sm }}>
              <Txt variant="bodyStrong">Waiting on the buyer</Txt>
              <Txt variant="body" color={colors.inkSoft}>
                {order.buyer.displayName} confirms once they've picked the item up, and the coins
                land in your wallet immediately. Message them to arrange a time and place.
              </Txt>
            </Card>
          ) : (
            <>
              <Card style={{ gap: space.sm }}>
                <Txt variant="bodyStrong">Got the item?</Txt>
                <Txt variant="body" color={colors.inkSoft}>
                  Only confirm after it's physically in your hands. This releases your coins to{" "}
                  {order.seller.displayName} and can't be undone.
                </Txt>
              </Card>
              <Button
                label="I picked it up — release the coins"
                onPress={() =>
                  Alert.alert("Release the coins?", "Do this only after you have the item.", [
                    { text: "Not yet", style: "cancel" },
                    { text: "Release", onPress: () => act("confirm") },
                  ])
                }
                loading={busy}
                full
              />
            </>
          )}

          <Button
            label="Cancel and return the coins"
            variant="danger"
            onPress={() =>
              Alert.alert("Cancel this order?", "The coins go back to the buyer and the item returns to the feed.", [
                { text: "Keep it", style: "cancel" },
                { text: "Cancel order", style: "destructive", onPress: () => act("cancel") },
              ])
            }
            loading={busy}
            full
          />
        </View>
      ) : order.status === "COMPLETED" ? (
        review.data?.reviewed ? (
          <Card style={{ gap: space.sm, alignItems: "flex-start" }}>
            <Txt variant="bodyStrong">You reviewed this trade</Txt>
            <Stars rating={review.data.rating ?? 0} size={17} />
            <Txt variant="caption" color={colors.inkMuted}>
              It's on {other.displayName}'s profile now.
            </Txt>
          </Card>
        ) : (
          <Card style={{ gap: space.lg }}>
            <View style={{ gap: space.xs }}>
              <Txt variant="heading">How did it go with {other.displayName}?</Txt>
              <Txt variant="caption" color={colors.inkMuted}>
                This shows on their public profile. Only people who actually traded can
                leave one, which is what makes them worth reading.
              </Txt>
            </View>

            <Stars rating={rating} size={30} onChange={setRating} />

            <TextInput
              value={reviewBody}
              onChangeText={setReviewBody}
              placeholder={
                selling
                  ? "Did they show up, pay, communicate?"
                  : "Was the item as described? Was the handoff easy?"
              }
              placeholderTextColor={colors.inkMuted}
              multiline
              maxLength={600}
              style={styles.reviewInput}
            />

            <Button
              label={rating === 0 ? "Pick a rating" : "Post review"}
              disabled={rating === 0}
              loading={posting}
              full
              onPress={async () => {
                setPosting(true);
                try {
                  await api.leaveReview(order.id, rating, reviewBody.trim() || undefined);
                  setReviewBody("");
                  await review.reload();
                } catch (e) {
                  Alert.alert("Couldn't post it", e instanceof ApiError ? e.message : "Try again");
                } finally {
                  setPosting(false);
                }
              }}
            />
          </Card>
        )
      ) : (
        <Badge label="Cancelled" tone="warn" />
      )}

      <View style={{ height: space.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, gap: space.lg },
  cover: { width: 72, height: 72, borderRadius: radius.md },
  reviewInput: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    padding: space.md,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: "top",
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
});
