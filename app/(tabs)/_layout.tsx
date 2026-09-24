import { Tabs } from "expo-router"
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, useColorScheme } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useConnections } from "../../src/stores/connections"
import { useEvents } from "../../src/stores/events"
import { HARDCODED_SERVER_URL } from "../../src/lib/server-config"
import { layout } from "../../src/lib/theme"
import { useState, useCallback } from "react"

function ConnectionBadge({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation()
  const activeConnection = useConnections((s) => s.activeConnection)
  const client = useConnections((s) => s.client)
  const authError = useEvents((s) => s.authError)
  const isConnected = !!activeConnection && !!client && !authError
  const isError = !!authError
  const [visible, setVisible] = useState(false)
  const [ping, setPing] = useState<number | null>(null)
  const [pingLoading, setPingLoading] = useState(false)
  const [pingError, setPingError] = useState<string | null>(null)

  const doPing = useCallback(async () => {
    setPingLoading(true)
    setPingError(null)
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
    } catch (e) {
      setPingError(e instanceof Error ? e.message : String(e))
      setPing(null)
    } finally {
      setPingLoading(false)
    }
  }, [])

  const open = useCallback(() => {
    setVisible(true)
    doPing()
  }, [doPing])

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
            ? isConnected
              ? "#052e16"
              : isError
                ? "#3f0a0a"
                : "#1a1a1a"
            : isConnected
              ? "#dcfce7"
              : isError
                ? "#fef2f2"
                : "#f5f5f5",
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: isDark
            ? isConnected
              ? "#14532d"
              : isError
                ? "#7f1d1d"
                : "#2a2a2a"
            : isConnected
              ? "#bbf7d0"
              : isError
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
            backgroundColor: isConnected ? "#22c55e" : isError ? "#ef4444" : "#999999",
          }}
        />
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: isDark
              ? isConnected
                ? "#4ade80"
                : isError
                  ? "#f87171"
                  : "#888888"
              : isConnected
                ? "#15803d"
                : isError
                  ? "#dc2626"
                  : "#666666",
          }}
        >
          {isConnected ? t("common.connected") : isError ? t("common.error") : t("common.offline")}
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
                    backgroundColor: isConnected ? "#22c55e" : isError ? "#ef4444" : "#999999",
                  }}
                />
                <Text style={{ fontSize: 15, fontWeight: "600", color: isDark ? "#ffffff" : "#0a0a0a" }}>
                  {isConnected
                    ? t("connection.status.connected")
                    : isError
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
                onPress={doPing}
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

export default function TabLayout() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()
  // Badge with the number of sessions where the agent is working right now.
  const busyCount = useEvents((s) =>
    Object.values(s.sessionStatus).filter((st) => st.type === "busy" || st.type === "retry").length,
  )

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: (isDark ? "#ffffff" : "#0a0a0a") as unknown as string,
        tabBarInactiveTintColor: (isDark ? "#666666" : "#999999") as unknown as string,
        tabBarStyle: {
          backgroundColor: isDark ? "#0a0a0a" : "#ffffff",
          borderTopColor: isDark ? "#1a1a1a" : "#e5e5e5",
        },
        headerStyle: {
          backgroundColor: isDark ? "#0a0a0a" : "#ffffff",
        },
        headerTintColor: (isDark ? "#ffffff" : "#0a0a0a") as unknown as string,
        // Badge должен следовать ширине контейнера: контент имеет
        // paddingHorizontal: layout.containerPadding (16), поэтому headerRight
        // выравнивается тем же токеном. headerLeftContainerStyle не трогаем —
        // пустой left-контейнер с paddingLeft сдвигает title вправо (двойной
        // отступ слева у заголовков, замеченный в ревью), title и так имеет
        // дефолтный отступ заголовка.
        headerRightContainerStyle: {
          paddingRight: layout.containerPadding,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.projectsTab"),
          tabBarIcon: ({ color, size }) => <Ionicons name="folder-outline" size={size} color={color as unknown as string} />,
          headerRight: () => <ConnectionBadge isDark={isDark} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t("nav.tasksTab"),
          tabBarIcon: ({ color, size }) => <Ionicons name="pulse-outline" size={size} color={color as unknown as string} />,
          tabBarBadge: busyCount > 0 ? busyCount : undefined,
        }}
      />
      <Tabs.Screen
        name="new-project"
        options={{
          title: t("nav.newProjectTab"),
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color as unknown as string} />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault()
            // Open new project modal via global UI store — handled in index.tsx
            const { openNewProject } = require("../../src/stores/ui").useUi.getState()
            openNewProject()
          },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("nav.settingsTab"),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color as unknown as string} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t("nav.accountTab"),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color as unknown as string} />,
        }}
      />
    </Tabs>
  )
}
