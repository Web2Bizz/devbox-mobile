import { useState, useCallback, useEffect, useRef } from "react"
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, AppState } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useConnections } from "../stores/connections"
import { useEvents } from "../stores/events"
import { HARDCODED_SERVER_URL } from "../lib/server-config"

// How often the badge re-validates the server health in the background, so
// the dot/text/ping stay fresh without reopening the modal. 30s is a single
// tiny GET with a 5s abort — negligible next to the always-on SSE stream.
const BADGE_PING_INTERVAL_MS = 30_000

type BadgeState = "connected" | "error" | "offline"

// Connection status badge for tab headers (projects, tasks, settings,
// account). Color and text always derive from the same `state`, so they can
// never disagree: green/Connected, red/Error, gray/Offline.
export function ConnectionBadge({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation()
  const activeConnection = useConnections((s) => s.activeConnection)
  const client = useConnections((s) => s.client)
  const authError = useEvents((s) => s.authError)
  const state: BadgeState = authError ? "error" : activeConnection && client ? "connected" : "offline"
  const [visible, setVisible] = useState(false)
  const [ping, setPing] = useState<number | null>(null)
  const [pingLoading, setPingLoading] = useState(false)
  const [pingError, setPingError] = useState<string | null>(null)
  const pingInFlight = useRef(false)

  const doPing = useCallback(async (quiet = false) => {
    if (pingInFlight.current) return
    pingInFlight.current = true
    if (!quiet) {
      setPingLoading(true)
      setPingError(null)
    }
    const start = Date.now()
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(`${HARDCODED_SERVER_URL}/global/health`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })
      clearTimeout(timer)
      const elapsed = Date.now() - start
      // 401/403 means server reachable but auth required — still a successful ping
      if (!res.ok && res.status !== 401 && res.status !== 403) throw new Error(`HTTP ${res.status}`)
      setPing(elapsed)
      if (quiet) setPingError(null)
    } catch (e) {
      if (!quiet) setPingError(e instanceof Error ? e.message : String(e))
      setPing(null)
    } finally {
      pingInFlight.current = false
      if (!quiet) setPingLoading(false)
    }
  }, [])

  const open = useCallback(() => {
    setVisible(true)
    void doPing()
  }, [doPing])

  // Keep the badge fresh: ping on mount, re-validate on a timer and every
  // time the app comes back to the foreground (the most likely moment for
  // the network — and therefore the badge — to be stale). Interval pings are
  // quiet: they update the value without flashing the modal spinner.
  useEffect(() => {
    void doPing(true)
    const id = setInterval(() => {
      void doPing(true)
    }, BADGE_PING_INTERVAL_MS)
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void doPing(true)
    })
    return () => {
      clearInterval(id)
      sub.remove()
    }
  }, [doPing])

  const label =
    state === "connected"
      ? ping !== null
        ? `${t("common.connected")} · ${ping} ms`
        : t("common.connected")
      : state === "error"
        ? t("common.error")
        : t("common.offline")

  return (
    <>
      <TouchableOpacity
        onPress={open}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: isDark
            ? state === "connected"
              ? "#052e16"
              : state === "error"
                ? "#3f0a0a"
                : "#1a1a1a"
            : state === "connected"
              ? "#dcfce7"
              : state === "error"
                ? "#fef2f2"
                : "#f5f5f5",
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: isDark
            ? state === "connected"
              ? "#14532d"
              : state === "error"
                ? "#7f1d1d"
                : "#2a2a2a"
            : state === "connected"
              ? "#bbf7d0"
              : state === "error"
                ? "#fecaca"
                : "#e5e5e5",
        }}
        testID="connection-status-badge"
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: state === "connected" ? "#22c55e" : state === "error" ? "#ef4444" : "#999999",
          }}
        />
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: isDark
              ? state === "connected"
                ? "#4ade80"
                : state === "error"
                  ? "#f87171"
                  : "#888888"
              : state === "connected"
                ? "#15803d"
                : state === "error"
                  ? "#dc2626"
                  : "#666666",
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 }}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={{ width: "100%", maxWidth: 360 }}>
            <View
              style={{
                backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
                borderRadius: 16,
                padding: 20,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: isDark ? "#ffffff" : "#0a0a0a" }}>
                  {t("connection.status.title")}
                </Text>
                <TouchableOpacity onPress={() => setVisible(false)} hitSlop={8}>
                  <Ionicons name="close" size={20} color={isDark ? "#888888" : "#666666"} />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: state === "connected" ? "#22c55e" : state === "error" ? "#ef4444" : "#999999",
                  }}
                />
                <Text style={{ fontSize: 15, fontWeight: "600", color: isDark ? "#ffffff" : "#0a0a0a" }}>
                  {state === "connected"
                    ? t("connection.status.connected")
                    : state === "error"
                      ? t("connection.status.authError")
                      : t("connection.status.offline")}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: isDark ? "#0a0a0a" : "#f5f5f5",
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="pulse-outline" size={18} color={isDark ? "#888888" : "#666666"} />
                  <Text style={{ fontSize: 14, color: isDark ? "#888888" : "#666666" }}>{t("connection.status.ping")}</Text>
                </View>
                {pingLoading ? (
                  <ActivityIndicator size="small" color={isDark ? "#ffffff" : "#0a0a0a"} />
                ) : ping !== null ? (
                  <Text style={{ fontSize: 14, fontWeight: "600", color: isDark ? "#ffffff" : "#0a0a0a" }}>{ping} ms</Text>
                ) : pingError ? (
                  <Text style={{ fontSize: 13, color: "#ef4444" }}>{t("connection.status.unreachable")}</Text>
                ) : (
                  <Text style={{ fontSize: 13, color: "#888888" }}>—</Text>
                )}
              </View>

              <TouchableOpacity
                onPress={() => doPing()}
                disabled={pingLoading}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  backgroundColor: isDark ? "#0a0a0a" : "#ffffff",
                  borderWidth: 1,
                  borderColor: isDark ? "#2a2a2a" : "#e5e5e5",
                  padding: 12,
                  borderRadius: 10,
                }}
              >
                <Ionicons name="refresh" size={16} color={isDark ? "#ffffff" : "#0a0a0a"} />
                <Text style={{ fontSize: 14, fontWeight: "600", color: isDark ? "#ffffff" : "#0a0a0a" }}>
                  {t("connection.status.refresh")}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  )
}
