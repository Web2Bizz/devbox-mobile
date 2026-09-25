import { useCallback, useMemo, useState, useRef, useEffect } from "react"
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native"
import { router, useFocusEffect } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useSessions } from "../../src/stores/sessions"
import { useConnections } from "../../src/stores/connections"
import { useEvents } from "../../src/stores/events"
import { useCatalog } from "../../src/stores/catalog"
import type BottomSheet from "@gorhom/bottom-sheet"
import type { Session, Project } from "../../src/lib/sdk"
import { DirectorySwitcher, DirectoryBrowserSheet } from "../../src/components/chat"
import { groupByDirectory } from "../../src/lib/session-grouping"
import { UpdateBanner } from "../../src/components/UpdateBanner"
import { nameOf } from "../../src/lib/path-utils"
import { useUi } from "../../src/stores/ui"
import { breakpoints, colors } from "../../src/lib/theme"
import { useTablet } from "../../src/lib/use-tablet"

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

function ProjectCard({
  directory,
  count,
  lastUpdated,
  isDark,
}: {
  directory: string
  count: number
  lastUpdated: number
  isDark: boolean
}) {
  const { t } = useTranslation()
  const shortName = directory.split("/").filter(Boolean).pop() || directory
  const onPress = () => {
    router.push({
      pathname: "/project/[directory]",
      params: { directory: encodeURIComponent(directory) },
    })
  }
  return (
    <TouchableOpacity
      style={[styles.projectCard, isDark && styles.projectCardDark]}
      onPress={onPress}
      testID={`project-card-${directory}`}
    >
      <View style={styles.projectCardHeader}>
        <Ionicons name="folder" size={22} color={isDark ? colors.accentPale : colors.accentStrong} />
        <Text style={[styles.projectCardTitle, isDark && styles.textDark]} numberOfLines={1}>
          {shortName}
        </Text>
        <View style={[styles.countBadge, isDark && styles.countBadgeDark]}>
          <Text style={[styles.countBadgeText, isDark && styles.countBadgeTextDark]}>{count}</Text>
        </View>
      </View>
      <Text style={[styles.projectCardPath, isDark && styles.metaDark]} numberOfLines={1}>
        {directory}
      </Text>
      <Text style={[styles.projectCardMeta, isDark && styles.metaDark]}>
        {t("sessionsList.filesCount", { count })} · {formatTime(lastUpdated, t)}
      </Text>
    </TouchableOpacity>
  )
}

// Get short directory name (last folder or project name)
function getShortPath(
  project: { path?: { cwd?: string; root?: string; absolute?: string }; name?: string } | null | undefined,
): string {
  if (!project) return ""
  if (project.name) return project.name
  if (!project.path?.absolute) return ""
  const parts = project.path.absolute.split("/").filter(Boolean)
  return parts[parts.length - 1] || project.path.absolute
}

export default function SessionsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()
  const [showNewSession, setShowNewSession] = useState(false)
  const { showNewProject, closeNewProject } = useUi()
  const [customDir, setCustomDir] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [renaming, setRenaming] = useState<Session | null>(null)
  const [renameText, setRenameText] = useState("")
  const renamingInFlight = useRef(false)
  // Synchronous re-entrancy guard: `isCreating` state lags by a render, so a
  // fast double-tap on the FAB / "Use this folder" would fire two session
  // creates before the disabled state lands. This blocks the second call.
  const creatingInFlight = useRef(false)
  const [serverProjects, setServerProjects] = useState<Project[]>([])

  const { sessions, isLoading, error, loadSessions, createSession, deleteSession } = useSessions()
  const {
    activeConnection,
    client,
    currentProject,
    serverHome,
    refreshProject,
    clientForDirectory,
    switchDirectory,
    addRecentDirectory,
    recentDirectories,
  } = useConnections()
  const authError = useEvents((s) => s.authError)
  const reconnect = useEvents((s) => s.connect)
  const loadCatalog = useCatalog((s) => s.load)
  const dirSheetRef = useRef<BottomSheet>(null)
  const browserSheetRef = useRef<BottomSheet>(null)
  const [browseStartDir, setBrowseStartDir] = useState<string | null>(null)
  // Shared folder browser is opened either to pick a directory for a new
  // session, or to switch the active connection's directory.
  const [browseMode, setBrowseMode] = useState<"create" | "switch">("create")
  const [refreshing, setRefreshing] = useState(false)
  const { numColumns, width: windowWidth } = useTablet()
  const isWide = windowWidth >= breakpoints.desktop
  // Directories collapsed in the grouped session list. Empty by default —
  // all groups start expanded (#67).
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set())

  const toggleGroup = useCallback((directory: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(directory)) next.delete(directory)
      else next.add(directory)
      return next
    })
  }, [])

  // Projects = unique directories that have sessions, each as a card
  const projects = useMemo(() => {
    const groups = groupByDirectory(sessions)
    return groups
      .map((g) => ({
        directory: g.directory,
        count: g.items.length,
        lastUpdated: Math.max(...g.items.map((s) => s.time.updated), 0),
      }))
      .sort((a, b) => b.lastUpdated - a.lastUpdated)
  }, [sessions])

  // Fetch server-known projects when the new session modal opens
  useEffect(() => {
    if ((!showNewSession && !showNewProject) || !client) return
    client.project
      .list()
      .then(setServerProjects)
      .catch(() => setServerProjects([]))
  }, [showNewSession, showNewProject, client])

  const handleSwitchDirectory = useCallback(
    async (dir?: string) => {
      await switchDirectory(dir)
      loadSessions()
      refreshProject()
      loadCatalog()
    },
    [switchDirectory, loadSessions, refreshProject, loadCatalog],
  )

  useFocusEffect(
    useCallback(() => {
      if (client) {
        loadSessions()
        refreshProject()
      }
    }, [client, loadSessions, refreshProject]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([loadSessions(), refreshProject()])
    } catch (err) {
      console.error("Refresh failed:", err)
    } finally {
      setRefreshing(false)
    }
  }, [loadSessions, refreshProject])

  const handleRename = useCallback((session: Session) => {
    setRenameText(session.title || "")
    setRenaming(session)
  }, [])

  const submitRename = useCallback(async () => {
    const title = renameText.trim()
    if (!title || !renaming || renamingInFlight.current) return
    const renameClient = renaming.directory ? (clientForDirectory(renaming.directory) ?? client) : client
    if (!renameClient) return
    renamingInFlight.current = true
    try {
      await renameClient.session.update(renaming.id, { title })
      setRenaming(null)
      setRenameText("")
      loadSessions()
    } catch (err) {
      console.error("Rename failed:", err)
      Alert.alert(t("sessionsList.alerts.renameFailedTitle"), t("sessionsList.alerts.renameFailedMessage"))
    } finally {
      renamingInFlight.current = false
    }
  }, [renaming, renameText, client, clientForDirectory, loadSessions, t])

  const handleDelete = useCallback(
    (session: Session) => {
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
                await deleteSession(session.id)
              } catch (err) {
                console.error("Delete failed:", err)
                Alert.alert(t("sessionsList.alerts.deleteFailedTitle"), t("sessionsList.alerts.deleteFailedMessage"))
              }
            },
          },
        ],
      )
    },
    [deleteSession, t],
  )

  const onCreateSession = async () => {
    if (creatingInFlight.current) return
    creatingInFlight.current = true
    try {
      const session = await createSession()
      if (session) {
        router.push({
          pathname: `/session/[id]`,
          params: { id: session.id, ...(session.directory ? { directory: session.directory } : {}) },
        })
      } else {
        Alert.alert(t("common.error"), t("sessionsList.alerts.createFailedMessage"))
      }
    } finally {
      creatingInFlight.current = false
    }
  }

  const onCreateInDirectory = async (dir?: string) => {
    if (!activeConnection) return
    if (creatingInFlight.current) return
    creatingInFlight.current = true
    setIsCreating(true)

    try {
      // If a custom directory is specified, use a one-off client for that directory
      // so we don't mutate the connection's default project
      if (dir && dir.trim()) {
        const dirClient = clientForDirectory(dir.trim())
        if (!dirClient) return
        try {
          const session = await dirClient.session.create({})
          addRecentDirectory(dir.trim())
          setShowNewSession(false)
          closeNewProject()
          setCustomDir("")
          if (session) {
            router.push({
              pathname: `/session/[id]`,
              params: { id: session.id, ...(session.directory ? { directory: session.directory } : {}) },
            })
          }
        } catch (error) {
          console.error("Failed to create session in directory:", error)
          Alert.alert(t("common.error"), t("sessionsList.alerts.createFailedMessage"))
        }
        return
      }

      const session = await createSession()
      setShowNewSession(false)
      closeNewProject()
      setCustomDir("")
      if (session) {
        router.push({
          pathname: `/session/[id]`,
          params: { id: session.id, ...(session.directory ? { directory: session.directory } : {}) },
        })
      } else {
        Alert.alert(t("common.error"), t("sessionsList.alerts.createFailedMessage"))
      }
    } finally {
      creatingInFlight.current = false
      setIsCreating(false)
    }
  }

  // The browser sheet is a sibling of the New Session <Modal>. A native RN
  // Modal layers above everything in the React root (including bottom-sheet
  // portals), so the modal must be closed before the sheet is shown; this ref
  // remembers to bring it back if the user cancels without picking a folder.
  const restoreNewSessionOnDismiss = useRef(false)

  const openBrowser = useCallback(
    (startDir: string | null, mode: "create" | "switch") => {
      setBrowseStartDir(startDir || serverHome || null)
      setBrowseMode(mode)
      if (mode === "create" && (showNewSession || showNewProject)) {
        restoreNewSessionOnDismiss.current = true
        setShowNewSession(false)
        closeNewProject()
      }
      browserSheetRef.current?.expand()
    },
    [serverHome, showNewSession, showNewProject, closeNewProject],
  )

  const onBrowserSelect = useCallback(
    (directory: string) => {
      restoreNewSessionOnDismiss.current = false
      if (browseMode === "switch") {
        handleSwitchDirectory(directory)
        dirSheetRef.current?.close()
      } else {
        onCreateInDirectory(directory)
      }
    },
    [browseMode, handleSwitchDirectory, onCreateInDirectory],
  )

  const onBrowserDismiss = useCallback(() => {
    if (restoreNewSessionOnDismiss.current) {
      restoreNewSessionOnDismiss.current = false
      // Restore whichever modal was open (new project takes precedence)
      if (showNewProject) {
        // Already handled via store — no need to set
      } else {
        setShowNewSession(true)
      }
    }
  }, [showNewProject])

  const onFabPress = () => {
    // Quick create in current project
    onCreateSession()
  }

  const onFabLongPress = () => {
    // Show modal with more options
    setCustomDir("")
    setShowNewSession(true)
  }

  if (!activeConnection) {
    return (
      <View style={[styles.emptyContainer, isDark && styles.containerDark]}>
        <Ionicons name="lock-closed-outline" size={64} color={isDark ? "#444444" : "#cccccc"} />
        <Text style={[styles.emptyTitle, isDark && styles.textDark]}>Требуется вход</Text>
        <Text style={[styles.emptySubtitle, isDark && styles.metaDark]}>Требуется авторизация</Text>
        <TouchableOpacity
          style={[styles.addButton, isDark && styles.addButtonDark]}
          onPress={() => router.push("/login")}
          testID="go-login-button"
        >
          <Text style={[styles.addButtonText, isDark && styles.addButtonTextDark]}>Войти</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (authError) {
    return (
      <View style={[styles.emptyContainer, isDark && styles.containerDark]}>
        <Ionicons name="lock-closed-outline" size={64} color={isDark ? "#444444" : "#cccccc"} />
        <Text style={[styles.emptyTitle, isDark && styles.textDark]}>{t("sessionsList.empty.authFailedTitle")}</Text>
        <Text style={[styles.emptySubtitle, isDark && styles.metaDark]}>
          {t("sessionsList.empty.authFailedSubtitle", { name: activeConnection.name })}
        </Text>
        <TouchableOpacity
          style={[styles.addButton, isDark && styles.addButtonDark]}
          onPress={() => router.push("/login")}
          testID="go-login-button"
        >
          <Text style={[styles.addButtonText, isDark && styles.addButtonTextDark]}>Войти снова</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const shortPath = getShortPath(currentProject)

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Project path — tap to switch (server name removed per request) */}
      {shortPath ? (
        <TouchableOpacity
          style={[styles.connectionBar, isDark && styles.connectionBarDark]}
          onPress={() => dirSheetRef.current?.expand()}
          activeOpacity={0.7}
          testID="connection-status-bar"
        >
          <View style={styles.connectionInfo}>
            <Ionicons name="folder" size={14} color={isDark ? "#888888" : "#666666"} />
            <Text style={[styles.projectPath, isDark && styles.metaDark]} numberOfLines={1}>
              {shortPath}
            </Text>
          </View>
          <Ionicons name="swap-horizontal-outline" size={16} color={isDark ? "#666666" : "#999999"} />
        </TouchableOpacity>
      ) : null}

      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <UpdateBanner isDark={isDark} />

      <FlatList
        data={projects}
        key={numColumns}
        numColumns={numColumns}
        keyExtractor={(item) => item.directory}
        columnWrapperStyle={numColumns > 1 ? styles.projectGridRow : undefined}
        renderItem={({ item }) => (
          <ProjectCard
            directory={item.directory}
            count={item.count}
            lastUpdated={item.lastUpdated}
            isDark={isDark}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? "#ffffff" : "#0a0a0a"} />
        }
        testID="project-list"
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={isDark ? "#ffffff" : "#0a0a0a"} />
            </View>
          ) : (
            <View style={styles.emptyList}>
              <Text style={[styles.emptyListText, isDark && styles.metaDark]}>Нет проектов — создайте первый</Text>
            </View>
          )
        }
        contentContainerStyle={
          projects.length === 0
            ? styles.emptyContent
            : [
                { padding: 16, gap: 12 },
                isWide && {
                  maxWidth: breakpoints.desktop,
                  width: "100%",
                  alignSelf: "center",
                },
              ]
        }
      />

      {/* FAB removed per request */}

      {/* New Session Info Modal — also opened via Navbar New Project button */}
      <Modal
        visible={showNewSession || showNewProject}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowNewSession(false)
          closeNewProject()
        }}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity
            style={styles.modalDismiss}
            activeOpacity={1}
            onPress={() => {
              setShowNewSession(false)
              closeNewProject()
            }}
          />
          <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && styles.textDark]}>{t("sessionsList.newSessionModal.title")}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowNewSession(false)
                  closeNewProject()
                }}
              >
                <Ionicons name="close" size={24} color={isDark ? "#ffffff" : "#0a0a0a"} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollBody} keyboardShouldPersistTaps="handled">
              {/* Current directory — tapping creates session immediately */}
              <Text style={[styles.modalLabel, isDark && styles.metaDark]}>
                {t("sessionsList.newSessionModal.currentProjectLabel")}
              </Text>
              <TouchableOpacity
                style={[styles.modalDirBox, isDark && styles.modalDirBoxDark]}
                onPress={() => onCreateInDirectory()}
                disabled={isCreating}
              >
                <Ionicons name="folder" size={20} color={isDark ? colors.accentPale : colors.accentStrong} />
                <Text style={[styles.modalDirText, isDark && styles.textDark]} numberOfLines={2}>
                  {currentProject?.path?.absolute || activeConnection?.directory || t("sessionsList.newSessionModal.serverDefault")}
                </Text>
                <Ionicons name="arrow-forward-circle" size={20} color={isDark ? colors.accentPale : colors.accentStrong} />
              </TouchableOpacity>

              {/* Recent projects */}
              {recentDirectories.length > 0 && (
                <>
                  <Text style={[styles.modalLabel, isDark && styles.metaDark, { marginTop: 16 }]}>
                    {t("sessionsList.newSessionModal.recentProjectsLabel")}
                  </Text>
                  {recentDirectories.map((dir) => {
                    const short = dir.split("/").filter(Boolean).pop() || dir
                    const isCurrent =
                      dir === (currentProject?.path?.absolute || activeConnection?.directory)
                    return (
                      <TouchableOpacity
                        key={dir}
                        style={[
                          styles.projectRow,
                          isDark && styles.projectRowDark,
                          isCurrent && styles.projectRowActive,
                        ]}
                        onPress={() => onCreateInDirectory(dir)}
                        disabled={isCreating}
                      >
                        <Ionicons
                          name="folder-outline"
                          size={18}
                          color={isCurrent ? colors.accent : isDark ? "#888888" : "#666666"}
                        />
                        <View style={styles.projectRowContent}>
                          <Text
                            style={[
                              styles.projectRowName,
                              isDark && styles.textDark,
                              isCurrent && styles.projectRowNameActive,
                            ]}
                            numberOfLines={1}
                          >
                            {short}
                          </Text>
                          <Text style={[styles.projectRowPath, isDark && styles.metaDark]} numberOfLines={1}>
                            {dir}
                          </Text>
                        </View>
                        {isCurrent && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
                      </TouchableOpacity>
                    )
                  })}
                </>
              )}

              {/* Server-known projects (excluding current) */}
              {serverProjects.filter((p) => p.path?.absolute !== currentProject?.path?.absolute).length > 0 && (
                <>
                  <Text style={[styles.modalLabel, isDark && styles.metaDark, { marginTop: 16 }]}>
                    {t("sessionsList.newSessionModal.serverProjectsLabel")}
                  </Text>
                  {serverProjects
                    .filter((p) => p.path?.absolute !== currentProject?.path?.absolute)
                    .map((p) => {
                      const short = p.name || p.path?.absolute?.split("/").filter(Boolean).pop() || p.id
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.projectRow, isDark && styles.projectRowDark]}
                          onPress={() => onCreateInDirectory(p.path?.absolute)}
                          disabled={isCreating}
                        >
                          <Ionicons name="code-slash-outline" size={18} color={isDark ? "#888888" : "#666666"} />
                          <View style={styles.projectRowContent}>
                            <Text style={[styles.projectRowName, isDark && styles.textDark]} numberOfLines={1}>
                              {short}
                            </Text>
                            {p.path?.absolute && (
                              <Text style={[styles.projectRowPath, isDark && styles.metaDark]} numberOfLines={1}>
                                {p.path.absolute}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                </>
              )}

              {/* Browse the server's filesystem instead of typing a path */}
              <TouchableOpacity
                style={[styles.projectRow, isDark && styles.projectRowDark, { marginTop: 16 }]}
                onPress={() =>
                  openBrowser(currentProject?.path?.absolute || activeConnection?.directory || null, "create")
                }
                disabled={isCreating}
                testID="browse-folders-button"
              >
                <Ionicons name="folder-open-outline" size={18} color={isDark ? colors.accentPale : colors.accentStrong} />
                <View style={styles.projectRowContent}>
                  <Text style={[styles.projectRowName, isDark && styles.textDark]}>
                    {t("sessionsList.newSessionModal.browseFoldersLabel")}
                  </Text>
                  <Text style={[styles.projectRowPath, isDark && styles.metaDark]}>
                    {t("sessionsList.newSessionModal.browseFoldersHint")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={isDark ? "#666666" : "#999999"} />
              </TouchableOpacity>

              {/* Clone a GitHub repo onto the server (stub — backend lands later) */}
              <TouchableOpacity
                style={[styles.projectRow, isDark && styles.projectRowDark, { marginTop: 8 }]}
                onPress={() => {
                  setShowNewSession(false)
                  closeNewProject()
                  router.push("/project/clone")
                }}
                disabled={isCreating}
                testID="clone-repo-button"
              >
                <Ionicons name="logo-github" size={18} color={isDark ? colors.accentPale : colors.accentStrong} />
                <View style={styles.projectRowContent}>
                  <Text style={[styles.projectRowName, isDark && styles.textDark]}>
                    {t("sessionsList.newSessionModal.cloneRepoLabel")}
                  </Text>
                  <Text style={[styles.projectRowPath, isDark && styles.metaDark]}>
                    {t("sessionsList.newSessionModal.cloneRepoHint")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={isDark ? "#666666" : "#999999"} />
              </TouchableOpacity>

              {/* Manual path input fallback */}
              <Text style={[styles.modalLabel, isDark && styles.metaDark, { marginTop: 16 }]}>
                {t("sessionsList.newSessionModal.enterPathLabel")}
              </Text>
              <TextInput
                style={[styles.modalInput, isDark && styles.modalInputDark]}
                placeholder={serverHome ? `${serverHome}/...` : "/path/to/project"}
                placeholderTextColor={isDark ? "#666666" : "#999999"}
                value={customDir}
                onChangeText={(text) => {
                  // Expand ~ to server home directory
                  if (serverHome && text.startsWith("~/")) {
                    setCustomDir(serverHome + text.slice(1))
                  } else if (serverHome && text === "~") {
                    setCustomDir(serverHome)
                  } else {
                    setCustomDir(text)
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {/* Quick path shortcuts */}
              {serverHome && (
                <View style={styles.pathChips}>
                  <TouchableOpacity
                    style={[styles.pathChip, isDark && styles.pathChipDark]}
                    onPress={() => setCustomDir(serverHome)}
                  >
                    <Text style={[styles.pathChipText, isDark && styles.pathChipTextDark]}>~</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pathChip, isDark && styles.pathChipDark]}
                    onPress={() => setCustomDir(serverHome + "/")}
                  >
                    <Text style={[styles.pathChipText, isDark && styles.pathChipTextDark]}>~/</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              {customDir.trim() ? (
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalButtonPrimary,
                    isDark && styles.modalButtonPrimaryDark,
                    styles.modalButtonFull,
                  ]}
                  onPress={() => onCreateInDirectory(customDir)}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color={isDark ? "#0a0a0a" : "#ffffff"} />
                  ) : (
                    <Text style={[styles.modalButtonTextPrimary, isDark && styles.modalButtonTextPrimaryDark]}>
                      {t("sessionsList.newSessionModal.createInButton", {
                        dir: customDir.split("/").filter(Boolean).pop() || customDir,
                      })}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalButtonPrimary,
                    isDark && styles.modalButtonPrimaryDark,
                    styles.modalButtonFull,
                  ]}
                  onPress={() => onCreateInDirectory()}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color={isDark ? "#0a0a0a" : "#ffffff"} />
                  ) : (
                    <Text style={[styles.modalButtonTextPrimary, isDark && styles.modalButtonTextPrimaryDark]}>
                      {t("sessionsList.newSessionModal.createSessionButton")}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Rename modal */}
      <Modal visible={!!renaming} animationType="fade" transparent>
        <KeyboardAvoidingView
          style={[styles.modalOverlay, { justifyContent: "center" }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={() => setRenaming(null)} />
          <View style={[styles.renameCard, isDark && styles.renameCardDark]}>
            <Text style={[styles.renameTitle, isDark && styles.textDark]}>{t("sessionsList.renameModal.title")}</Text>
            <TextInput
              style={[styles.modalInput, isDark && styles.modalInputDark]}
              value={renameText}
              onChangeText={setRenameText}
              onSubmitEditing={submitRename}
              returnKeyType="done"
              autoFocus
              selectTextOnFocus
              autoCapitalize="sentences"
              autoCorrect={false}
            />
            <View style={styles.renameActions}>
              <TouchableOpacity style={[styles.renameBtn, styles.renameBtnCancel]} onPress={() => setRenaming(null)}>
                <Text style={styles.renameBtnCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameBtn, styles.modalButtonPrimary, isDark && styles.modalButtonPrimaryDark]}
                onPress={submitRename}
                disabled={!renameText.trim()}
              >
                <Text style={[styles.modalButtonTextPrimary, isDark && styles.modalButtonTextPrimaryDark]}>
                  {t("common.save")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={() => setRenaming(null)} />
        </KeyboardAvoidingView>
      </Modal>

      {/* Directory switcher bottom sheet */}
      <DirectorySwitcher
        sheetRef={dirSheetRef}
        current={activeConnection?.directory}
        recents={recentDirectories}
        serverHome={serverHome}
        isDark={isDark}
        onSwitch={handleSwitchDirectory}
        onBrowse={() =>
          openBrowser(activeConnection?.directory || currentProject?.path?.absolute || null, "switch")
        }
      />

      {/* Browsable folder picker — used for both "new session in..." and
          "switch project directory" flows (see browseMode). */}
      <DirectoryBrowserSheet
        sheetRef={browserSheetRef}
        startDirectory={browseStartDir}
        clientForDirectory={clientForDirectory}
        isDark={isDark}
        onSelect={onBrowserSelect}
        onDismiss={onBrowserDismiss}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  containerDark: {
    backgroundColor: "#0a0a0a",
  },
  connectionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  connectionBarDark: {
    borderBottomColor: "#1a1a1a",
  },
  connectionInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  connectionUrl: {
    fontSize: 12,
    color: "#666666",
  },
  projectPath: {
    fontSize: 13,
    color: "#666666",
    flex: 1,
  },
  errorBar: {
    backgroundColor: "#fef2f2",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  groupHeaderDark: {
    backgroundColor: "#151515",
    borderBottomColor: "#1a1a1a",
  },
  groupHeaderText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  groupHeaderCount: {
    fontSize: 12,
    color: "#666666",
  },
  textDark: {
    color: "#ffffff",
  },
  metaDark: {
    color: "#888888",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#ffffff",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    color: "#0a0a0a",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666666",
    marginTop: 8,
    textAlign: "center",
  },
  addButton: {
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  authErrorButtonRow: {
    flexDirection: "row",
    gap: 12,
  },
  addButtonDark: {
    backgroundColor: "#ffffff",
  },
  addButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  addButtonTextDark: {
    color: "#0a0a0a",
  },
  setupGuideLink: {
    marginTop: 16,
  },
  setupGuideLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent,
  },
  tryDemoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  tryDemoButtonDark: {
    borderColor: colors.accentPale,
  },
  tryDemoButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accentStrong,
  },
  tryDemoButtonTextDark: {
    color: colors.accentPale,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  emptyListText: {
    fontSize: 16,
    color: "#666666",
  },
  emptyContent: {
    flex: 1,
  },
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabDark: {
    backgroundColor: "#ffffff",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalContentDark: {
    backgroundColor: "#1a1a1a",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  modalBody: {
    marginBottom: 24,
  },
  modalScrollBody: {
    maxHeight: 420,
    marginBottom: 16,
  },
  projectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
    marginBottom: 6,
  },
  projectRowDark: {
    backgroundColor: "#2a2a2a",
  },
  projectRowActive: {
    backgroundColor: colors.accentMuted,
  },
  projectRowContent: {
    flex: 1,
  },
  projectRowName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  projectRowNameActive: {
    color: colors.accent,
  },
  projectRowPath: {
    fontSize: 11,
    color: "#999999",
    marginTop: 1,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666666",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  modalDirBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 12,
  },
  modalDirBoxDark: {
    backgroundColor: "#2a2a2a",
  },
  modalDirText: {
    fontSize: 15,
    color: "#0a0a0a",
    flex: 1,
  },
  modalInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#0a0a0a",
  },
  modalInputDark: {
    backgroundColor: "#2a2a2a",
    color: "#ffffff",
  },
  pathChips: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  pathChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.accentChipBg,
    borderRadius: 16,
  },
  pathChipDark: {
    backgroundColor: colors.accentChipBgDark,
  },
  pathChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.accentStrong,
  },
  pathChipTextDark: {
    color: colors.accentExtraPale,
  },
  modalHint: {
    fontSize: 13,
    color: "#666666",
    marginTop: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  modalButtonSecondary: {
    backgroundColor: "#f5f5f5",
  },
  modalButtonSecondaryDark: {
    backgroundColor: "#2a2a2a",
  },
  modalButtonPrimary: {
    backgroundColor: "#0a0a0a",
  },
  modalButtonPrimaryDark: {
    backgroundColor: "#ffffff",
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  modalButtonTextPrimary: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  modalButtonTextPrimaryDark: {
    color: "#0a0a0a",
  },
  modalButtonFull: {
    flex: 0,
    width: "100%",
  },
  // Rename modal
  renameCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 32,
    gap: 16,
  },
  renameCardDark: {
    backgroundColor: "#1a1a1a",
  },
  renameTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  renameActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  renameBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  renameBtnCancel: {
    backgroundColor: "transparent",
  },
  renameBtnCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#888888",
  },
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#0a0a0a",
  },
  inputDark: {
    backgroundColor: "#2a2a2a",
    color: "#ffffff",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0a0a0a",
    marginTop: 16,
    marginBottom: 8,
  },
  labelDark: {
    color: "#ffffff",
  },
  projectCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    gap: 6,
  },
  projectGridRow: {
    gap: 12,
  },
  projectCardDark: {
    backgroundColor: "#1a1a1a",
    borderColor: "#2a2a2a",
  },
  projectCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  projectCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0a0a0a",
    flex: 1,
  },
  projectCardPath: {
    fontSize: 13,
    color: "#666666",
  },
  projectCardMeta: {
    fontSize: 12,
    color: "#999999",
    marginTop: 4,
  },
  countBadge: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countBadgeDark: {
    backgroundColor: "#2a2a2a",
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666666",
  },
  countBadgeTextDark: {
    color: "#888888",
  },
})
