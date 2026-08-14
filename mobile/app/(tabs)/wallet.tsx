import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, api, type LedgerEntry } from "../../src/api";
import { useAuth } from "../../src/auth";
import { Badge, Button, Card, Coins, Divider, Empty, Loader, Txt } from "../../src/components/ui";
import { formatCoins, formatDate, formatUsd } from "../../src/money";
import { colors, radius, space } from "../../src/theme";
import { useQuery } from "../../src/useQuery";

const ENTRY_META: Record<LedgerEntry["kind"], { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  TOPUP: { icon: "add-circle-outline", label: "Bought coins" },
  BONUS: { icon: "gift-outline", label: "Bonus" },
  PURCHASE: { icon: "bag-outline", label: "Purchase" },
  RELEASE: { icon: "checkmark-circle-outline", label: "Sale" },
  REFUND: { icon: "arrow-undo-outline", label: "Refund" },
  PAYOUT: { icon: "cash-outline", label: "Cash out" },
};

export default function Wallet() {
  const insets = useSafeAreaInsets();
  const { refresh } = useAuth();

  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const wallet = useQuery(() => api.wallet(), []);
  const history = useQuery(() => api.walletHistory(), []);

  async function reloadAll() {
    await Promise.all([wallet.reload(), history.reload(), refresh()]);
  }

  async function buyPack(packId: string) {
    setBusy(packId);
    try {
      const result = await api.topUp(packId);
      if (result.sandbox) {
        // No Stripe key configured — coins land immediately. See server/src/routes/wallet.ts.
        await reloadAll();
        Alert.alert("Coins added", "Sandbox mode: no card was charged.");
      } else if (result.checkoutUrl) {
        // Stripe Checkout in a system browser sheet. The webhook is what actually
        // credits the coins, so we just refresh once the sheet closes.
        await WebBrowser.openAuthSessionAsync(result.checkoutUrl, "fleamarket://wallet");
        await reloadAll();
      }
    } catch (e) {
      Alert.alert("Couldn't buy coins", e instanceof ApiError ? e.message : "Try again");
    } finally {
      setBusy(null);
    }
  }

  async function setUpPayouts() {
    setBusy("connect");
    try {
      const result = await api.connectPayouts();
      if (result.onboardingUrl) {
        await WebBrowser.openAuthSessionAsync(result.onboardingUrl, "fleamarket://wallet");
      }
      await reloadAll();
    } catch (e) {
      Alert.alert("Couldn't start setup", e instanceof ApiError ? e.message : "Try again");
    } finally {
      setBusy(null);
    }
  }

  async function cashOut() {
    const data = wallet.data;
    if (!data) return;
    const usd = formatUsd(data.payouts.availableUsdCents);

    Alert.alert(
      `Cash out ${formatCoins(data.balanceCoins)} coins?`,
      `You'll receive ${usd} in your bank account. Coins cash out at ${formatUsd(
        data.rates.payoutUsdCentsPerCoin,
      )} each — that spread is how the app makes money instead of charging sellers a fee.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Cash out ${usd}`,
          onPress: async () => {
            setBusy("payout");
            try {
              await api.cashOut(data.balanceCoins);
              await reloadAll();
            } catch (e) {
              Alert.alert("Cash out failed", e instanceof ApiError ? e.message : "Try again");
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  if (wallet.loading && !wallet.data) return <Loader />;
  if (!wallet.data) {
    return <Empty icon="cloud-offline-outline" title="Can't load your wallet" body={wallet.error ?? ""} />;
  }

  const data = wallet.data;
  const canCashOut = data.payouts.enabled && data.balanceCoins >= data.rates.minPayoutCoins;

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + space.lg }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await reloadAll();
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={{ gap: space.xs }}>
        <Txt variant="title">Wallet</Txt>
        {data.sandbox ? <Badge label="Sandbox — no real charges" tone="coin" /> : null}
      </View>

      {/* Balance */}
      <View style={styles.balance}>
        <Txt variant="caption" color={colors.inkMuted}>
          Your balance
        </Txt>
        <Coins amount={data.balanceCoins} size="lg" tone="plain" />
        <Txt variant="caption" color={colors.inkMuted}>
          Worth {formatUsd(data.payouts.availableUsdCents)} if you cash out
        </Txt>
      </View>

      {/* Top up */}
      <View style={{ gap: space.md }}>
        <Txt variant="heading">Add coins</Txt>
        <View style={styles.packs}>
          {data.packs.map((pack) => {
            const total = pack.coins + pack.bonusCoins;
            return (
              <Pressable
                key={pack.id}
                onPress={() => buyPack(pack.id)}
                disabled={busy !== null}
                style={({ pressed }) => [
                  styles.pack,
                  pack.bonusCoins > 0 && { borderColor: colors.coin },
                  pressed && { opacity: 0.85 },
                ]}
              >
                {pack.bonusCoins > 0 ? (
                  <View style={styles.packFlag}>
                    <Txt variant="micro" color="#FFFFFF">
                      +{formatCoins(pack.bonusCoins)}
                    </Txt>
                  </View>
                ) : null}
                <Coins amount={total} size="md" tone="plain" />
                <Txt variant="caption" color={colors.inkMuted}>
                  {formatUsd(pack.usdCents)}
                </Txt>
              </Pressable>
            );
          })}
        </View>
        <Txt variant="caption" color={colors.inkMuted}>
          Bigger packs come with bonus coins. Paid by card — Apple's in-app purchases
          aren't allowed for real-world goods.
        </Txt>
      </View>

      {/* Cash out */}
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Ionicons name="cash-outline" size={18} color={colors.ink} />
          <Txt variant="heading">Cash out</Txt>
        </View>

        {!data.payouts.enabled ? (
          <>
            <Txt variant="body" color={colors.inkSoft}>
              Turn coins you've earned into dollars in your bank account. Stripe verifies
              your identity — we never touch your bank details.
            </Txt>
            <Button
              label={data.payouts.onboardingStarted ? "Finish setup" : "Set up payouts"}
              onPress={setUpPayouts}
              loading={busy === "connect"}
              variant="secondary"
              full
            />
          </>
        ) : (
          <>
            <Txt variant="body" color={colors.inkSoft}>
              {canCashOut
                ? `${formatCoins(data.balanceCoins)} coins → ${formatUsd(data.payouts.availableUsdCents)}`
                : `Minimum cash-out is ${formatCoins(data.rates.minPayoutCoins)} coins.`}
            </Txt>
            <Button
              label="Cash out everything"
              onPress={cashOut}
              loading={busy === "payout"}
              disabled={!canCashOut}
              variant="secondary"
              full
            />
          </>
        )}
      </Card>

      {/* History */}
      <View style={{ gap: space.md }}>
        <Txt variant="heading">Activity</Txt>
        {history.data?.entries.length ? (
          <Card style={{ padding: 0, gap: 0 }}>
            {history.data.entries.map((entry, index) => {
              const meta = ENTRY_META[entry.kind];
              const positive = entry.delta > 0;
              return (
                <View key={entry.id}>
                  {index > 0 ? <Divider /> : null}
                  <View style={styles.entry}>
                    <View style={styles.entryIcon}>
                      <Ionicons name={meta.icon} size={17} color={colors.inkSoft} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt variant="bodyStrong" numberOfLines={1}>
                        {entry.memo ?? meta.label}
                      </Txt>
                      <Txt variant="caption" color={colors.inkMuted}>
                        {meta.label} · {formatDate(entry.createdAt)}
                      </Txt>
                    </View>
                    <Txt
                      variant="bodyStrong"
                      color={positive ? colors.positive : colors.ink}
                    >
                      {positive ? "+" : "−"}
                      {formatCoins(Math.abs(entry.delta))}
                    </Txt>
                  </View>
                </View>
              );
            })}
          </Card>
        ) : (
          <Card>
            <Txt variant="body" color={colors.inkMuted}>
              Nothing yet. Add coins to get started.
            </Txt>
          </Card>
        )}
      </View>

      <Txt variant="caption" color={colors.inkMuted}>
        1 coin costs {formatUsd(data.rates.topUpUsdCentsPerCoin)} and cashes out at{" "}
        {formatUsd(data.rates.payoutUsdCentsPerCoin)}. Coins you spend inside the app keep
        their full value — only cashing out costs you the spread.
      </Txt>

      <View style={{ height: space.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: space.lg, gap: space.xl, paddingBottom: space.xl },
  balance: {
    backgroundColor: colors.coinSoft,
    borderRadius: radius.xl,
    padding: space.xl,
    gap: space.xs,
    alignItems: "flex-start",
  },
  packs: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  pack: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
  },
  packFlag: {
    position: "absolute",
    top: space.sm,
    right: space.sm,
    backgroundColor: colors.coin,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  entry: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  entryIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
});
