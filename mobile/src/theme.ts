/**
 * One place for every colour, space and type size in the app.
 *
 * The palette is warm paper + near-black + a single gold accent. Gold is reserved
 * exclusively for coins — if something is gold on screen, it is money. That rule
 * is what makes a made-up currency feel legible instead of decorative.
 */

export const colors = {
  bg: "#FBF8F3",
  surface: "#FFFFFF",
  surfaceSunken: "#F3EEE6",

  ink: "#16130F",
  inkSoft: "#5C554B",
  inkMuted: "#918878",

  line: "#E9E2D6",
  lineStrong: "#D8CEBD",

  coin: "#C08A2E",
  coinSoft: "#F6ECD8",

  positive: "#2F7A55",
  positiveSoft: "#E4F0E9",
  danger: "#B23B2B",
  dangerSoft: "#F8E7E4",

  onDark: "#FBF8F3",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 30, lineHeight: 34, fontWeight: "700" },
  title: { fontSize: 22, lineHeight: 27, fontWeight: "700" },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  caption: { fontSize: 13, lineHeight: 17, fontWeight: "500" },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: "600" },
} as const;

/** Soft lift used on cards and sheets. Subtle by design — this is a paper app. */
export const shadow = {
  card: {
    shadowColor: "#3D3327",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: "#3D3327",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;
