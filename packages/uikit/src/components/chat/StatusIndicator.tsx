import { View, Text, StyleSheet, ActivityIndicator } from "react-native"
import { useTranslation } from "react-i18next"

// Server-reported session status, read by the parent from its own store and
// passed in — the kit never imports app zustand stores (which do not exist
// in the package). Extra fields on the caller's status object are fine.
export interface StatusSnapshot {
  type: string
  attempt?: number
}

interface Props {
  status?: StatusSnapshot
  statusText?: string
  optimistic?: boolean
  isDark: boolean
}

export function StatusIndicator({ status, statusText, optimistic, isDark }: Props) {
  const { t } = useTranslation()

  // Server status is the source of truth, but the optimistic `sending` flag
  // must also count on its own: it bridges the gap between the user tapping
  // send and the server confirming busy (including a stale `idle` left over
  // from the previous run). Once the server reports idle for the current
  // run, the parent clears `sending` too, so `sseBusy || optimistic` can't
  // get stuck.
  const sseBusy = !!status && status.type !== "idle"
  const busy = sseBusy || optimistic
  if (!busy) return <View style={s.barPlaceholder} />

  const label =
    status?.type === "retry" && typeof status.attempt === "number"
      ? t("chat.statusIndicator.retrying", { attempt: status.attempt })
      : statusText || t("chat.statusIndicator.working")

  return (
    <View style={[s.bar, isDark && s.barDark]}>
      <ActivityIndicator size="small" color={isDark ? "#888888" : "#666666"} />
      <Text style={[s.text, isDark && s.textDark]}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    height: 36,
    backgroundColor: "transparent",
  },
  barPlaceholder: { height: 36 },
  barDark: { backgroundColor: "transparent" },
  text: { fontSize: 13, color: "#666666", fontWeight: "500" },
  textDark: { color: "#888888" },
})
