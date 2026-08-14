import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { colors } from "../theme";

/**
 * Star rating. Read-only by default; pass `onChange` to make it a picker.
 *
 * Half stars are shown for averages but can never be picked — a rating is always
 * a whole number, and pretending otherwise in the input would be a lie.
 */
export function Stars({
  rating,
  size = 15,
  onChange,
}: {
  rating: number;
  size?: number;
  onChange?: (value: number) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: onChange ? 6 : 2 }}>
      {[1, 2, 3, 4, 5].map((position) => {
        const filled = rating >= position;
        const half = !onChange && !filled && rating > position - 1;
        const icon = filled ? "star" : half ? "star-half" : "star-outline";

        const star = (
          <Ionicons
            name={icon}
            size={size}
            color={filled || half ? colors.coin : colors.lineStrong}
          />
        );

        if (!onChange) return <View key={position}>{star}</View>;
        return (
          <Pressable
            key={position}
            onPress={() => onChange(position)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${position} out of 5`}
          >
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}
