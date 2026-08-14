import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { Button, Field, Txt } from "../../src/components/ui";
import { COIN, parseCoins } from "../../src/money";
import { colors, radius, space } from "../../src/theme";

const CATEGORIES = [
  "furniture",
  "electronics",
  "clothing",
  "home",
  "kids",
  "sports",
  "books",
  "tools",
  "garden",
  "other",
];

const CONDITIONS = [
  { id: "NEW", label: "New" },
  { id: "LIKE_NEW", label: "Like new" },
  { id: "GOOD", label: "Good" },
  { id: "FAIR", label: "Fair" },
];

const MAX_PHOTOS = 8;

export default function Sell() {
  const insets = useSafeAreaInsets();
  const { refresh } = useAuth();

  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("furniture");
  const [condition, setCondition] = useState("GOOD");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Pick images, then push them to the API as base64 data URLs. `quality: 0.6`
   * matters: a raw iPhone photo is several MB, and base64 inflates it by a third.
   */
  async function addPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo access to add pictures to your listing.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.6,
      base64: true,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const asset of result.assets) {
        if (!asset.base64) continue;
        const mime = asset.mimeType ?? "image/jpeg";
        const { url } = await api.upload(`data:${mime};base64,${asset.base64}`);
        uploaded.push(url);
      }
      setPhotos((current) => [...current, ...uploaded].slice(0, MAX_PHOTOS));
    } catch (e) {
      Alert.alert("Upload failed", e instanceof ApiError ? e.message : "Try again");
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setPhotos([]);
    setTitle("");
    setPrice("");
    setDescription("");
    setCategory("furniture");
    setCondition("GOOD");
    setError(null);
  }

  async function submit() {
    const priceCoins = parseCoins(price);

    if (photos.length === 0) return setError("Add at least one photo");
    if (title.trim().length < 3) return setError("Give it a title buyers can search for");
    if (!priceCoins || priceCoins < COIN) return setError("Set a price of at least 1 coin");
    if (description.trim().length < 1) return setError("Add a short description");

    setError(null);
    setBusy(true);
    try {
      const { listing } = await api.createListing({
        title: title.trim(),
        description: description.trim(),
        priceCoins,
        category,
        condition,
        photoUrls: photos,
      });
      reset();
      await refresh();
      router.push(`/listing/${listing.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't post the listing");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + space.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: space.xs }}>
          <Txt variant="title">Sell something</Txt>
          <Txt variant="body" color={colors.inkSoft}>
            You keep every coin — there's no selling fee.
          </Txt>
        </View>

        {/* Photos */}
        <View style={{ gap: space.md }}>
          <Txt variant="caption" color={colors.inkSoft}>
            Photos · {photos.length}/{MAX_PHOTOS}
          </Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
            {photos.map((url, index) => (
              <View key={url} style={styles.thumb}>
                <Image source={{ uri: url }} style={styles.thumbImage} contentFit="cover" />
                <Pressable
                  onPress={() => setPhotos((c) => c.filter((_, i) => i !== index))}
                  style={styles.thumbRemove}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={13} color={colors.onDark} />
                </Pressable>
                {index === 0 ? (
                  <View style={styles.coverFlag}>
                    <Txt variant="micro" color={colors.onDark}>
                      COVER
                    </Txt>
                  </View>
                ) : null}
              </View>
            ))}

            {photos.length < MAX_PHOTOS ? (
              <Pressable onPress={addPhotos} disabled={uploading} style={styles.addPhoto}>
                <Ionicons
                  name={uploading ? "cloud-upload-outline" : "camera-outline"}
                  size={22}
                  color={colors.inkMuted}
                />
                <Txt variant="caption" color={colors.inkMuted}>
                  {uploading ? "Uploading…" : "Add"}
                </Txt>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>

        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Mid-century walnut dresser"
          maxLength={80}
        />

        <Field
          label="Price in coins"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          placeholder="120"
          hint="1 coin = $1 when buyers top up"
        />

        {/* Category */}
        <View style={{ gap: space.sm }}>
          <Txt variant="caption" color={colors.inkSoft}>
            Category
          </Txt>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, active && styles.chipActive]}>
                  <Txt variant="caption" color={active ? colors.onDark : colors.inkSoft}>
                    {c[0]!.toUpperCase() + c.slice(1)}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Condition */}
        <View style={{ gap: space.sm }}>
          <Txt variant="caption" color={colors.inkSoft}>
            Condition
          </Txt>
          <View style={styles.chips}>
            {CONDITIONS.map((c) => {
              const active = c.id === condition;
              return (
                <Pressable key={c.id} onPress={() => setCondition(c.id)} style={[styles.chip, active && styles.chipActive]}>
                  <Txt variant="caption" color={active ? colors.onDark : colors.inkSoft}>
                    {c.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Be honest about the flaws — it's what makes people trust the listing."
          maxLength={2000}
          error={error}
        />

        <Button label="Post listing" onPress={submit} loading={busy} full />
        <View style={{ height: space.xxl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: space.lg, gap: space.xl, paddingBottom: space.xl },
  thumb: { width: 96, height: 96, borderRadius: radius.md, overflow: "hidden" },
  thumbImage: { width: "100%", height: "100%", backgroundColor: colors.surfaceSunken },
  thumbRemove: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(20,17,14,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverFlag: {
    position: "absolute",
    bottom: 5,
    left: 5,
    backgroundColor: "rgba(20,17,14,0.65)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  addPhoto: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.surface,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
});
