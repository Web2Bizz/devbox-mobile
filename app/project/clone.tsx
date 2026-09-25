import { useMemo, useState } from "react"
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
} from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { filterMockRepos } from "../../src/lib/github-mock"
import { useClonedProjects } from "../../src/stores/cloned-projects"
import { useConnections } from "../../src/stores/connections"

// UI stub: fake 1.5s "cloning", then stores the project locally and
// goes back. Backend will replace the setTimeout with a real clone
// call — the store shape stays.
export default function CloneRepoScreen() {
  const isDark = useColorScheme() === "dark"
  const { t } = useTranslation()
  const { targetDir } = useLocalSearchParams<{ targetDir?: string }>()
  const [query, setQuery] = useState("")
  const [cloningId, setCloningId] = useState<string | null>(null)
  const addCloned = useClonedProjects((s) => s.addCloned)
  const addRecentDirectory = useConnections((s) => s.addRecentDirectory)

  const repos = useMemo(() => filterMockRepos(query), [query])

  const onClone = (id: string) => {
    if (cloningId) return
    const repo = repos.find((r) => r.id === id)
    if (!repo) return
    setCloningId(id)
    setTimeout(() => {
      const project = addCloned(repo, typeof targetDir === "string" ? targetDir : undefined)
      void addRecentDirectory(project.path).catch(() => {})
      setCloningId(null)
      router.back()
    }, 1500)
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {typeof targetDir === "string" && !!targetDir && (
        <View style={[styles.targetBox, isDark && styles.targetBoxDark]} testID="clone-target-dir">
          <Ionicons name="folder-outline" size={14} color={isDark ? "#888888" : "#666666"} />
          <Text style={[styles.targetText, isDark && styles.metaDark]} numberOfLines={1}>
            {t("project.clone.targetLabel")}: {targetDir}
          </Text>
        </View>
      )}
      <TextInput
        style={[styles.search, isDark && styles.searchDark]}
        placeholder={t("project.clone.searchPlaceholder")}
        placeholderTextColor={isDark ? "#666666" : "#999999"}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        testID="clone-search-input"
      />

      <FlatList
        data={repos}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => {
          const cloning = cloningId === item.id
          return (
            <TouchableOpacity
              style={[styles.row, isDark && styles.rowDark]}
              onPress={() => onClone(item.id)}
              disabled={cloningId !== null}
              testID={`repo-item-${item.id}`}
            >
              <Ionicons
                name={item.isPrivate ? "lock-closed-outline" : "logo-github"}
                size={20}
                color={isDark ? "#888888" : "#666666"}
              />
              <View style={styles.rowContent}>
                <View style={styles.nameRow}>
                  <Text style={[styles.rowName, isDark && styles.textDark]} numberOfLines={1}>
                    {item.fullName}
                  </Text>
                  {item.isPrivate && (
                    <View style={styles.privateBadge}>
                      <Text style={styles.privateText}>{t("project.clone.private")}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.rowDesc, isDark && styles.metaDark]} numberOfLines={2}>
                  {item.description}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaText, isDark && styles.metaDark]}>{item.language}</Text>
                  <Text style={[styles.metaText, isDark && styles.metaDark]}>★ {item.stars}</Text>
                  <Text style={[styles.metaText, isDark && styles.metaDark]}>{item.updatedAt}</Text>
                </View>
              </View>
              {cloning ? (
                <ActivityIndicator size="small" color={isDark ? "#ffffff" : "#0a0a0a"} testID="cloning-indicator" />
              ) : (
                <Ionicons name="download-outline" size={20} color={isDark ? "#8b5cf6" : "#6d28d9"} />
              )}
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, isDark && styles.metaDark]}>{t("project.clone.empty")}</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff", padding: 16 },
  containerDark: { backgroundColor: "#0a0a0a" },
  search: { backgroundColor: "#f5f5f5", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: "#0a0a0a", marginBottom: 12 },
  searchDark: { backgroundColor: "#1a1a1a", color: "#ffffff" },
  targetBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f5f5f5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  targetBoxDark: { backgroundColor: "#1a1a1a" },
  targetText: { flex: 1, fontSize: 12, color: "#666666" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f5f5f5",
    padding: 14,
    borderRadius: 10,
    marginBottom: 6,
  },
  rowDark: { backgroundColor: "#1a1a1a" },
  rowContent: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowName: { fontSize: 14, fontWeight: "600", color: "#0a0a0a", flex: 1 },
  rowDesc: { fontSize: 13, color: "#666666", marginTop: 2 },
  metaRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  metaText: { fontSize: 12, color: "#999999" },
  privateBadge: { backgroundColor: "#fef3c7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  privateText: { fontSize: 10, fontWeight: "700", color: "#92400e" },
  textDark: { color: "#ffffff" },
  metaDark: { color: "#888888" },
  empty: { paddingVertical: 32, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#666666" },
})
