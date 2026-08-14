import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { formatCoins } from "../money";
import { colors, radius, shadow, space, type } from "../theme";

/** Text with the app's type scale applied. Nothing in the app uses raw <Text>. */
export function Txt({
  variant = "body",
  color = colors.ink,
  center,
  style,
  children,
  numberOfLines,
}: {
  variant?: keyof typeof type;
  color?: string;
  center?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        type[variant] as object,
        { color },
        center && { textAlign: "center" },
        style as object,
      ]}
    >
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  full,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "coin";
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  const palette = {
    primary: { bg: colors.ink, fg: colors.onDark, border: colors.ink },
    coin: { bg: colors.coin, fg: "#FFFFFF", border: colors.coin },
    secondary: { bg: colors.surface, fg: colors.ink, border: colors.lineStrong },
    ghost: { bg: "transparent", fg: colors.inkSoft, border: "transparent" },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: "transparent" },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive) }}
      disabled={inactive}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: inactive ? 0.45 : pressed ? 0.85 : 1,
        },
        full && { alignSelf: "stretch" },
        style as object,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={17} color={palette.fg} /> : null}
          <Text style={[type.bodyStrong as object, { color: palette.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  error,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={{ gap: space.sm }}>
      <Txt variant="caption" color={colors.inkSoft}>
        {label}
      </Txt>
      <TextInput
        placeholderTextColor={colors.inkMuted}
        {...props}
        style={[
          styles.input,
          props.multiline && { height: 110, paddingTop: space.md, textAlignVertical: "top" },
          error ? { borderColor: colors.danger } : null,
          props.style as object,
        ]}
      />
      {error ? (
        <Txt variant="caption" color={colors.danger}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="caption" color={colors.inkMuted}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

/**
 * A coin amount. Always gold, always with the coin glyph — the app's one rule
 * about money is that you can spot it without reading.
 */
export function Coins({
  amount,
  size = "md",
  tone = "solid",
}: {
  amount: number;
  size?: "sm" | "md" | "lg";
  tone?: "solid" | "plain";
}) {
  const fontSize = { sm: 13, md: 16, lg: 24 }[size];
  const glyph = { sm: 12, md: 15, lg: 21 }[size];

  const content = (
    <>
      <Ionicons name="ellipse" size={glyph} color={colors.coin} />
      <Text style={{ fontSize, fontWeight: "700", color: colors.ink }}>
        {formatCoins(amount)}
      </Text>
    </>
  );

  if (tone === "plain") {
    return <View style={styles.coinsPlain}>{content}</View>;
  }
  return <View style={[styles.coinsPill, size === "sm" && { paddingVertical: 3 }]}>{content}</View>;
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const body = <View style={[styles.card, style as object]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      {body}
    </Pressable>
  );
}

export function Avatar({ user, size = 40 }: { user: { displayName: string; avatarUrl: string | null }; size?: number }) {
  if (user.avatarUrl) {
    return (
      <Image
        source={{ uri: user.avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceSunken }}
        contentFit="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surfaceSunken,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.4, fontWeight: "700", color: colors.inkSoft }}>
        {user.displayName.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "positive" | "warn" | "coin";
}) {
  const palette = {
    neutral: { bg: colors.surfaceSunken, fg: colors.inkSoft },
    positive: { bg: colors.positiveSoft, fg: colors.positive },
    warn: { bg: colors.dangerSoft, fg: colors.danger },
    coin: { bg: colors.coinSoft, fg: colors.coin },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[type.micro as object, { color: palette.fg, letterSpacing: 0.4 }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={colors.inkMuted} />
      </View>
      <Txt variant="heading" center>
        {title}
      </Txt>
      <Txt variant="body" color={colors.inkMuted} center style={{ maxWidth: 280 } as object}>
        {body}
      </Txt>
      {action}
    </View>
  );
}

export function Loader() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={colors.inkMuted} />
    </View>
  );
}

/** Full-width horizontal rule that matches the paper aesthetic. */
export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.line }} />;
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: 50,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    fontSize: 15,
    color: colors.ink,
  },
  coinsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: colors.coinSoft,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  coinsPlain: { flexDirection: "row", alignItems: "center", gap: 5 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    ...shadow.card,
  },
  badge: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    paddingVertical: 64,
    paddingHorizontal: space.xl,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  loader: { paddingVertical: 48, alignItems: "center" },
});
