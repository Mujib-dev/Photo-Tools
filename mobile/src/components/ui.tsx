import { Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from "react-native";
import { useColorScheme } from "react-native";

export const palette = {
  light: {
    bg: "#f6f7f9",
    surface: "#ffffff",
    surfaceAlt: "#eef0f4",
    border: "#d8dce3",
    text: "#12151a",
    textMuted: "#5b6472",
    primary: "#2f6df6",
    onPrimary: "#ffffff",
    success: "#177245",
    danger: "#b3261e",
    warning: "#8a5a00",
  },
  dark: {
    bg: "#0e1116",
    surface: "#171b22",
    surfaceAlt: "#1f242d",
    border: "#2c333d",
    text: "#eef1f6",
    textMuted: "#9aa4b2",
    primary: "#6f9bff",
    onPrimary: "#0b1020",
    success: "#5ddb9b",
    danger: "#ff8a80",
    warning: "#ffc46b",
  },
} as const;

export interface Colors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  success: string;
  danger: string;
  warning: string;
}

export function useColors(): Colors {
  const scheme = useColorScheme();
  return scheme === "dark" ? palette.dark : palette.light;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: c.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <Text style={[styles.sectionTitle, { color: c.textMuted }]}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <Text style={[styles.label, { color: c.textMuted }]}>{children}</Text>;
}

export function Body({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  const c = useColors();
  return <Text style={[styles.body, { color: muted ? c.textMuted : c.text }]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const c = useColors();
  const paletteFor = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary },
    secondary: { bg: c.surfaceAlt, fg: c.text, border: c.border },
    danger: { bg: "transparent", fg: c.danger, border: c.danger },
    ghost: { bg: "transparent", fg: c.primary, border: "transparent" },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: paletteFor.bg,
          borderColor: paletteFor.border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: paletteFor.fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "none",
  autoCorrect = false,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "numeric" | "email-address" | "url";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
}) {
  const c = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={c.textMuted}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      style={[
        styles.input,
        { backgroundColor: c.surfaceAlt, borderColor: c.border, color: c.text },
      ]}
    />
  );
}

export interface Option<T extends string | number> {
  value: T;
  label: string;
}

/** A single independently selectable chip, used for multi-select groups. */
export function ToggleChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? c.primary : c.surfaceAlt,
          borderColor: active ? c.primary : c.border,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? c.onPrimary : c.text }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Numeric input with stepper buttons.
 *
 * A native slider is deliberately avoided so the app keeps a small native
 * dependency surface and stays compatible with Expo Go.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  decimals = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
}) {
  const c = useColors();

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const round = (v: number) => Number(v.toFixed(decimals));

  const set = (v: number) => onChange(round(clamp(v)));
  const display = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));

  return (
    <View style={numberStyles.wrapper}>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <View style={numberStyles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          onPress={() => set(value - step)}
          disabled={value <= min}
          style={[
            numberStyles.stepper,
            { backgroundColor: c.surfaceAlt, borderColor: c.border, opacity: value <= min ? 0.4 : 1 },
          ]}
        >
          <Text style={[numberStyles.stepperText, { color: c.text }]}>−</Text>
        </Pressable>

        <TextInput
          value={display}
          onChangeText={(text) => {
            const parsed = Number(text.replace(/[^0-9.]/g, ""));
            if (Number.isFinite(parsed)) set(parsed);
          }}
          keyboardType="numeric"
          selectTextOnFocus
          style={[
            numberStyles.input,
            { backgroundColor: c.surfaceAlt, borderColor: c.border, color: c.text },
          ]}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          onPress={() => set(value + step)}
          disabled={value >= max}
          style={[
            numberStyles.stepper,
            { backgroundColor: c.surfaceAlt, borderColor: c.border, opacity: value >= max ? 0.4 : 1 },
          ]}
        >
          <Text style={[numberStyles.stepperText, { color: c.text }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Horizontal wrapping chip group — the mobile stand-in for a select. */
export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? c.primary : c.surfaceAlt,
                borderColor: active ? c.primary : c.border,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: active ? c.onPrimary : c.text }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {  const c = useColors();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.toggleRow}
    >
      <Text style={[styles.body, { color: c.text, flex: 1 }]}>{label}</Text>
      <View
        style={[
          styles.toggleTrack,
          { backgroundColor: value ? c.primary : c.surfaceAlt, borderColor: c.border },
        ]}
      >
        <View
          style={[
            styles.toggleThumb,
            { backgroundColor: value ? c.onPrimary : c.textMuted, alignSelf: value ? "flex-end" : "flex-start" },
          ]}
        />
      </View>
    </Pressable>
  );
}

export function Banner({ tone, children }: { tone: "error" | "info" | "success"; children: React.ReactNode }) {
  const c = useColors();
  const color = tone === "error" ? c.danger : tone === "success" ? c.success : c.primary;
  return (
    <View style={[styles.banner, { borderColor: color, backgroundColor: c.surfaceAlt }]}>
      <Text style={[styles.body, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  label: { fontSize: 13, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 21 },
  button: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  buttonText: { fontSize: 16, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    minHeight: 38,
    justifyContent: "center",
  },
  chipText: { fontSize: 14, fontWeight: "600" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  toggleTrack: {
    width: 52,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    padding: 3,
    justifyContent: "center",
  },
  toggleThumb: { width: 22, height: 22, borderRadius: 999 },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12 },
});

const numberStyles = StyleSheet.create({
  wrapper: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperText: { fontSize: 22, fontWeight: "700", lineHeight: 26 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlign: "center",
    minHeight: 48,
  },
});
