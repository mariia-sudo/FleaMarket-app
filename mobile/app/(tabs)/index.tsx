import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Listing } from "../../src/api";
import { useAuth } from "../../src/auth";
import { ListingCard } from "../../src/components/ListingCard";
import { Coins, Empty, Loader, Txt } from "../../src/components/ui";
import { useQuery } from "../../src/useQuery";
import { colors, radius, space } from "../../src/theme";

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "furniture", label: "Furniture" },
  { id: "electronics", label: "Electronics" },
  { id: "clothing", label: "Clothing" },
  { id: "home", label: "Home" },
  { id: "sports", label: "Sports" },
  { id: "books", label: "Books" },
  { id: "kids", label: "Kids" },
  { id: "tools", label: "Tools" },
  { id: "garden", label: "Garden" },
  { id: "other", label: "Other" },
];

export default function Browse() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [category, setCategory] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data, loading, error, reload, setData } = useQuery(
    () => api.listings({ q: submitted || undefined, category: category || undefined }),
    [submitted, category],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  /** Appends the next page. The server hands back a cursor or null when done. */
  const loadMore = useCallback(async () => {
    if (!data?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await api.listings({
        q: submitted || undefined,
        category: category || undefined,
        cursor: data.nextCursor,
      });
      setData({ listings: [...data.listings, ...next.listings], nextCursor: next.nextCursor });
    } catch {
      // Silently stop paginating — the user can pull to refresh.
    } finally {
      setLoadingMore(false);
    }
  }, [data, loadingMore, submitted, category, setData]);

  /** Optimistic heart: flip it locally, then tell the server. */
  const toggleFavorite = useCallback(
    async (listing: Listing) => {
      if (!data) return;
      setData({
        ...data,
        listings: data.listings.map((l) =>
          l.id === listing.id ? { ...l, favorited: !l.favorited } : l,
        ),
      });
      try {
        await api.toggleFavorite(listing.id);
      } catch {
        void reload();
      }
    },
    [data, setData, reload],
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.headerRow}>
          <View>
            <Txt variant="caption" color={colors.inkMuted}>
              {user?.city ? `${user.city}${user.state ? `, ${user.state}` : ""}` : "Nearby"}
            </Txt>
            <Txt variant="title">Browse</Txt>
          </View>

          <Pressable onPress={() => router.push("/(tabs)/wallet")} hitSlop={8}>
            <Coins amount={user?.balanceCoins ?? 0} size="md" />
          </Pressable>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={17} color={colors.inkMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => setSubmitted(search.trim())}
            returnKeyType="search"
            placeholder="Dresser, speakers, denim…"
            placeholderTextColor={colors.inkMuted}
            style={styles.searchInput}
          />
          {search ? (
            <Pressable
              hitSlop={8}
              onPress={() => {
                setSearch("");
                setSubmitted("");
              }}
            >
              <Ionicons name="close-circle" size={17} color={colors.inkMuted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {CATEGORIES.map((c) => {
            const active = c.id === category;
            return (
              <Pressable
                key={c.id || "all"}
                onPress={() => setCategory(c.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Txt variant="caption" color={active ? colors.onDark : colors.inkSoft}>
                  {c.label}
                </Txt>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading && !data ? (
        <Loader />
      ) : error ? (
        <Empty icon="cloud-offline-outline" title="Can't load the feed" body={error} />
      ) : (
        <FlatList
          data={data?.listings ?? []}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: space.lg }}
          contentContainerStyle={styles.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() => router.push(`/listing/${item.id}`)}
              onToggleFavorite={() => toggleFavorite(item)}
            />
          )}
          ListEmptyComponent={
            <Empty
              icon="cube-outline"
              title="Nothing here yet"
              body={
                submitted
                  ? `No results for "${submitted}". Try a different word.`
                  : "Be the first to list something in this category."
              }
            />
          }
          ListFooterComponent={loadingMore ? <Loader /> : <View style={{ height: space.xl }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    gap: space.md,
    backgroundColor: colors.bg,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    height: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink },
  chips: { gap: space.sm, paddingRight: space.lg },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  grid: { padding: space.lg, gap: space.xl },
});
