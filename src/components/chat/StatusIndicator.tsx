import { View, Text, StyleSheet, ActivityIndicator } from "react-native"
import { useTranslation } from "react-i18next"
import { useEvents } from "../../stores/events"
import { useSessions } from "../../stores/sessions"

interface Props {
  sessionID: string
  isDark: boolean
}

export function StatusIndicator({ sessionID, isDark }: Props) {
  const { t } = useTranslation()
  const status = useEvents((s) => s.sessionStatus[sessionID])
  const text = useEvents((s) => s.statusText[sessionID])
  const optimistic = useSessions((s) => s.sending[sessionID])

  // SSE status is the source of truth, but the optimistic `sending` flag
  // must also count on its own: it bridges the gap between the user tapping
  // send and SSE confirming busy (including a stale `idle` left over from
  // the previous run), and it survives only if selectSession doesn't clear
  // it. Once SSE reports idle for the current run, events.ts clears
  // `sending` too, so `sseBusy || optimistic` can't get stuck.
  const sseBusy = status && status.type !== "idle"
  const busy = sseBusy || optimistic
  if (!busy) return <View style={s.barPlaceholder} />

  const label =
    status?.type === "retry" ? t("chat.statusIndicator.retrying", { attempt: status.attempt }) : text || t("chat.statusIndicator.working")

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
