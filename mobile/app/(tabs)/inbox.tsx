import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Order } from "../../src/api";
import { useAuth } from "../../src/auth";
import { Avatar, Badge, Coins, Empty, Loader, Txt } from "../../src/components/ui";
import { formatDate } from "../../src/money";
import { colors, radius, space } from "../../src/theme";
import { useQuery } from "../../src/useQuery";

type Tab = "messages" | "orders";

export default function Inbox() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("messages");

  const threads = useQuery(() => api.threads(), []);
  const orders = useQuery(() => api.orders("all"), []);

  const openOrders = orders.data?.orders.filter((o) => o.status === "ESCROW").length ?? 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Txt variant="title">Inbox</Txt>
        <View style={styles.segment}>
          {(["messages", "orders"] as Tab[]).map((id) => {
            const active = tab === id;
            return (
              <Pressable
                key={id}
                onPress={() => setTab(id)}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
              >
                <Txt variant="caption" color={active ? colors.ink : colors.inkMuted}>
                  {id === "messages" ? "Messages" : `Orders${openOrders ? ` · ${openOrders}` : ""}`}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </View>

      {tab === "messages" ? (
        threads.loading && !threads.data ? (
          <Loader />
        ) : (
          <FlatList
            data={threads.data?.threads ?? []}
            keyExtractor={(t) => t.id}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/chat/${item.id}`)}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
              >
                <Avatar user={item.counterparty} size={46} />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <Txt variant="bodyStrong" numberOfLines={1} style={{ flex: 1 } as object}>
                      {item.counterparty.displayName}
                    </Txt>
                    <Txt variant="caption" color={colors.inkMuted}>
                      {formatDate(item.lastMessageAt)}
                    </Txt>
                  </View>
                  <Txt variant="caption" color={colors.inkMuted} numberOfLines={1}>
                    {item.lastMessage ?? `About: ${item.listing.title}`}
                  </Txt>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <Badge label={item.role === "buying" ? "Buying" : "Selling"} />
                    <Txt variant="caption" color={colors.inkMuted} numberOfLines={1} style={{ flex: 1 } as object}>
                      {item.listing.title}
                    </Txt>
                  </View>
                </View>
                {item.listing.coverUrl ? (
                  <Image source={{ uri: item.listing.coverUrl }} style={styles.thumb} contentFit="cover" />
                ) : null}
              </Pressable>
            )}
            ListEmptyComponent={
              <Empty
                icon="chatbubbles-outline"
                title="No messages yet"
                body="When you ask a seller about something, the conversation shows up here."
              />
            }
          />
        )
      ) : orders.loading && !orders.data ? (
        <Loader />
      ) : (
        <FlatList
          data={orders.data?.orders ?? []}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          renderItem={({ item }) => <OrderRow order={item} meId={user?.id} />}
          ListEmptyComponent={
            <Empty
              icon="receipt-outline"
              title="No orders yet"
              body="Everything you buy or sell shows up here, with its escrow status."
            />
          }
        />
      )}
    </View>
  );
}

function OrderRow({ order, meId }: { order: Order; meId?: string }) {
  const selling = order.seller.id === meId;
  const other = selling ? order.buyer : order.seller;

  const tone = order.status === "COMPLETED" ? "positive" : order.status === "CANCELLED" ? "warn" : "coin";
  const label =
    order.status === "ESCROW"
      ? selling
        ? "Awaiting pickup"
        : "In escrow"
      : order.status === "COMPLETED"
        ? "Completed"
        : "Cancelled";

  return (
    <Pressable
      onPress={() => router.push(`/order/${order.id}`)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
    >
      {order.listing.coverUrl ? (
        <Image source={{ uri: order.listing.coverUrl }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, { backgroundColor: colors.surfaceSunken }]} />
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {order.listing.title}
        </Txt>
        <Txt variant="caption" color={colors.inkMuted}>
          {selling ? "Sold to" : "From"} {other.displayName} · {formatDate(order.createdAt)}
        </Txt>
        <Badge label={label} tone={tone} />
      </View>
      <Coins amount={order.amountCoins} size="sm" tone="plain" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.pill,
    padding: 3,
  },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.pill },
  segmentItemActive: { backgroundColor: colors.surface },
  list: { padding: space.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
  },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceSunken },
});
