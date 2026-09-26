import { useCallback, useMemo } from "react"
import { View, Text, FlatList, TouchableOpacity, StyleSheet, useColorScheme, ActivityIndicator, Alert } from "react-native"
import { Stack, useLocalSearchParams, router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useSessionsList, useCreateSession, useDeleteSession } from "../../src/queries/sessions"
import { useConnections } from "../../src/stores/connections"
import { colors } from "../../src/lib/theme"

function formatTime(timestamp: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 60000) return t("sessionsList.time.justNow")
  if (diff < 3600000) return t("sessionsList.time.minutesAgo", { count: Math.floor(diff / 60000) })
  if (diff < 86400000) return t("sessionsList.time.hoursAgo", { count: Math.floor(diff / 3600000) })
  if (diff < 604800000) return t("sessionsList.time.daysAgo", { count: Math.floor(diff / 86400000) })
  return date.toLocaleDateString()
}

export default function ProjectSessionsScreen() {
  const { directory } = useLocalSearchParams<{ directory: string }>()
  const decodedDir = directory ? decodeURIComponent(directory) : ""
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()
  const { data: sessionsData, isLoading } = useSessionsList()
  const sessions = sessionsData ?? []
  const deleteSession = useDeleteSession()
  const createSession = useCreateSession()
  const { activeConnection } = useConnections()

  const projectSessions = useMemo(
    () => sessions.filter((s) => (s.directory || "") === decodedDir),
    [sessions, decodedDir],
  )

  const shortName = decodedDir.split("/").filter(Boolean).pop() || decodedDir || "—"

  const handleDelete = useCallback(
    (session: (typeof sessions)[number]) => {
      Alert.alert(
        t("sessionsList.alerts.deleteTitle"),
        t("sessionsList.alerts.deleteMessage", { title: session.title || t("sessionsList.untitledSession") }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: async () => {
              try {
                await deleteSession.mutateAsync(session.id)
              } catch {
                Alert.alert(t("sessionsList.alerts.deleteFailedTitle"), t("sessionsList.alerts.deleteFailedMessage"))
              }
            },
          },
        ],
      )
    },
    [deleteSession, t],
  )

  const handleRename = useCallback(
    (session: (typeof sessions)[number]) => {
      // For now, just show alert — full rename modal is in main list
      Alert.alert("Rename", `Rename ${session.title || "session"} — use main list for now`)
    },
    [],
  )

  return (
    <>
      <Stack.Screen options={{ title: shortName, headerBackTitle: "Проекты" }} />
      <View style={[styles.container, isDark && styles.containerDark]}>
        <View style={[styles.header, isDark && styles.headerDark]}>
          <Ionicons name="folder" size={20} color={isDark ? colors.accentPale : colors.accentStrong} />
          <Text style={[styles.path, isDark && styles.textDark]} numberOfLines={1}>
            {decodedDir}
          </Text>
          <Text style={[styles.count, isDark && styles.metaDark]}>{projectSessions.length}</Text>
        </View>

        <FlatList
          data={projectSessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.sessionItem, isDark && styles.sessionItemDark]}
              onPress={() =>
                router.push({
                  pathname: "/session/[id]",
                  params: { id: item.id, ...(item.directory ? { directory: item.directory } : {}) },
                })
              }
              onLongPress={() =>
                Alert.alert(item.title || t("sessionsList.untitledSession"), undefined, [
                  { text: t("common.cancel"), style: "cancel" },
                  { text: t("sessionsList.actions.rename"), onPress: () => handleRename(item) },
                  { text: t("common.delete"), style: "destructive", onPress: () => handleDelete(item) },
                ])
              }
            >
              <View style={styles.sessionContent}>
                <Text style={[styles.sessionTitle, isDark && styles.textDark]} numberOfLines={1}>
                  {item.title || t("sessionsList.untitledSession")}
                </Text>
                <Text style={[styles.sessionMeta, isDark && styles.metaDark]}>
                  {formatTime(item.time.updated, t)}
                  {item.summary && item.summary.files > 0 ? ` · ${t("sessionsList.filesCount", { count: item.summary.files })}` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={isDark ? "#666666" : "#999999"} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color={isDark ? "#ffffff" : "#0a0a0a"} />
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={48} color={isDark ? "#444444" : "#cccccc"} />
                <Text style={[styles.emptyText, isDark && styles.metaDark]}>{t("sessionsList.empty.noSessions")}</Text>
              </View>
            )
          }
        />

        <TouchableOpacity
          style={[styles.fab, isDark && styles.fabDark]}
          onPress={async () => {
            if (!activeConnection) return
            try {
              const session = await createSession.mutateAsync({ directory: decodedDir })
              router.push({
                pathname: "/session/[id]",
                params: { id: session.id, ...(session.directory ? { directory: session.directory } : { directory: decodedDir }) },
              })
            } catch {
              Alert.alert(t("common.error"), t("sessionsList.alerts.createFailedMessage"))
            }
          }}
          testID="new-session-in-project-fab"
        >
          <Ionicons name="add" size={28} color={isDark ? "#0a0a0a" : "#ffffff"} />
        </TouchableOpacity>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  containerDark: { backgroundColor: "#0a0a0a" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    backgroundColor: "#f5f5f5",
  },
  headerDark: { backgroundColor: "#1a1a1a", borderBottomColor: "#2a2a2a" },
  path: { flex: 1, fontSize: 14, fontWeight: "600", color: "#0a0a0a" },
  textDark: { color: "#ffffff" },
  count: { fontSize: 12, color: "#666666" },
  metaDark: { color: "#888888" },
  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  sessionItemDark: { backgroundColor: "#1a1a1a", borderColor: "#2a2a2a" },
  listContent: { padding: 16, gap: 12 },
  sessionContent: { flex: 1 },
  sessionTitle: { fontSize: 16, fontWeight: "500", color: "#0a0a0a", marginBottom: 4 },
  sessionMeta: { fontSize: 13, color: "#666666" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 64 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 64 },
  emptyText: { fontSize: 16, color: "#666666", marginTop: 12 },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  fabDark: { backgroundColor: "#ffffff" },
})
