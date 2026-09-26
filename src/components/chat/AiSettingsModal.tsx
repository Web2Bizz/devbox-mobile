import { useState, useMemo } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  SectionList,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { colors } from "../../lib/theme"

interface ModelItem {
  providerID: string
  providerName: string
  modelID: string
  modelName: string
}

interface AgentItem {
  name: string
  color?: string
  description?: string
}

interface Provider {
  id: string
  name: string
  models: Array<{ id: string; name: string }>
}

interface Props {
  visible: boolean
  agents: AgentItem[]
  selectedAgent: string
  providers: Provider[]
  selectedModel: { providerID: string; modelID: string } | null
  variants: Record<string, { reasoningEffort?: string }> | undefined
  selectedVariant: string | null
  isDark: boolean
  onSelectAgent: (name: string) => void
  onSelectModel: (providerID: string, modelID: string) => void
  onSelectVariant: (variant: string | null) => void
  onClose: () => void
}

// Single AI settings dialog: agent + model + reasoning effort, all selectable
// in one place. Plain RN Modal (no bottom-sheet deps): guaranteed to open
// regardless of layout measurement. Model selection closes the dialog;
// agent/effort stay open so several settings can change in one go.
export function AiSettingsModal({
  visible,
  agents,
  selectedAgent,
  providers,
  selectedModel,
  variants,
  selectedVariant,
  isDark,
  onSelectAgent,
  onSelectModel,
  onSelectVariant,
  onClose,
}: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")

  const effortDescriptions: Record<string, string> = {
    low: t("chat.variantPicker.effort.low"),
    medium: t("chat.variantPicker.effort.medium"),
    high: t("chat.variantPicker.effort.high"),
  }
  const effortOptions = useMemo(
    () => [
      { id: null as string | null, label: t("chat.variantPicker.autoLabel") },
      ...Object.keys(variants || {}).map((id) => ({
        id: id as string | null,
        label: id.charAt(0).toUpperCase() + id.slice(1),
      })),
    ],
    [variants, t],
  )
  const showEffort = Object.keys(variants || {}).length > 0

  const sections = useMemo(() => {
    const list = Array.isArray(providers) ? providers : []
    const q = search.toLowerCase()
    const result = list
      .map((p) => {
        const models = (p.models || [])
          .filter(
            (m) =>
              !q ||
              m.id.toLowerCase().includes(q) ||
              m.name.toLowerCase().includes(q) ||
              p.name.toLowerCase().includes(q),
          )
          .map((m) => ({
            providerID: p.id,
            providerName: p.name || p.id,
            modelID: m.id,
            modelName: m.name || m.id,
          }))
        if (selectedModel) {
          models.sort((a, b) => {
            const aActive = a.providerID === selectedModel.providerID && a.modelID === selectedModel.modelID
            const bActive = b.providerID === selectedModel.providerID && b.modelID === selectedModel.modelID
            return aActive === bActive ? 0 : aActive ? -1 : 1
          })
        }
        return { title: p.name || p.id, data: models }
      })
      .filter((s) => s.data.length > 0)
    if (selectedModel) {
      result.sort((a, b) => {
        const aHas = a.data.some(
          (m) => m.providerID === selectedModel.providerID && m.modelID === selectedModel.modelID,
        )
        const bHas = b.data.some(
          (m) => m.providerID === selectedModel.providerID && m.modelID === selectedModel.modelID,
        )
        return aHas === bHas ? 0 : aHas ? -1 : 1
      })
    }
    return result
  }, [providers, search, selectedModel])

  const closeAndReset = () => {
    setSearch("")
    onClose()
  }

  const header = (
    <View>
      <View style={s.handleRow}>
        <View style={[s.handle, isDark && s.handleDark]} />
      </View>
      <View style={s.titleRow}>
        <Text style={[s.title, isDark && s.textWhite]}>{t("chat.aiSettings.title")}</Text>
        <TouchableOpacity onPress={closeAndReset} hitSlop={12} testID="ai-settings-close">
          <Ionicons name="close" size={22} color={isDark ? "#888888" : "#666666"} />
        </TouchableOpacity>
      </View>
      <TextInput
        style={[s.search, isDark && s.searchDark]}
        placeholder={t("chat.modelPicker.searchPlaceholder")}
        placeholderTextColor={isDark ? "#666666" : "#999999"}
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        autoCapitalize="none"
      />

      <Text style={[s.sectionLabel, isDark && s.metaDark]}>{t("chat.aiSettings.agentLabel")}</Text>
      {agents.map((a) => {
        const active = a.name === selectedAgent
        return (
          <TouchableOpacity
            key={a.name}
            style={[s.row, isDark && s.rowDark, active && (isDark ? s.rowSelectedDark : s.rowSelected)]}
            onPress={() => onSelectAgent(a.name)}
            testID={`agent-option-${a.name}`}
          >
            <View style={[s.agentDot, { backgroundColor: a.color || colors.accent }]} />
            <View style={s.rowText}>
              <Text style={[s.rowName, isDark && s.textWhite]} numberOfLines={1}>
                {a.name}
              </Text>
              {!!a.description && (
                <Text style={[s.rowProvider, isDark && s.metaDark]} numberOfLines={1}>
                  {a.description}
                </Text>
              )}
            </View>
            {active && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
          </TouchableOpacity>
        )
      })}

      {showEffort && (
        <>
          <Text style={[s.sectionLabel, isDark && s.metaDark]}>{t("chat.aiSettings.effortLabel")}</Text>
          {effortOptions.map((o) => {
            const active = o.id === selectedVariant
            return (
              <TouchableOpacity
                key={o.id ?? "auto"}
                style={[s.row, isDark && s.rowDark, active && (isDark ? s.rowSelectedDark : s.rowSelected)]}
                onPress={() => onSelectVariant(o.id)}
                testID={`variant-option-${o.id ?? "auto"}`}
              >
                <View style={s.rowText}>
                  <Text style={[s.rowName, isDark && s.textWhite]} numberOfLines={1}>
                    {o.label}
                  </Text>
                  {!!o.id && !!effortDescriptions[o.id] && (
                    <Text style={[s.rowProvider, isDark && s.metaDark]} numberOfLines={1}>
                      {effortDescriptions[o.id]}
                    </Text>
                  )}
                </View>
                {active && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
              </TouchableOpacity>
            )
          })}
        </>
      )}

      <Text style={[s.sectionLabel, isDark && s.metaDark]}>{t("chat.aiSettings.modelLabel")}</Text>
    </View>
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={closeAndReset}
    >
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={closeAndReset} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[s.sheet, isDark && s.sheetDark]}
        >
          <SectionList
            sections={sections}
            ListHeaderComponent={header}
            keyExtractor={(item: ModelItem) => `${item.providerID}/${item.modelID}`}
            renderSectionHeader={({ section }: { section: { title: string } }) => (
              <View style={[s.sectionHeader, isDark && s.sectionHeaderDark]}>
                <Text style={[s.sectionTitle, isDark && s.metaDark]}>{section.title}</Text>
              </View>
            )}
            renderItem={({ item }: { item: ModelItem }) => {
              const active =
                selectedModel?.providerID === item.providerID && selectedModel?.modelID === item.modelID
              return (
                <TouchableOpacity
                  style={[s.row, isDark && s.rowDark, active && (isDark ? s.rowSelectedDark : s.rowSelected)]}
                  onPress={() => {
                    onSelectModel(item.providerID, item.modelID)
                    closeAndReset()
                  }}
                  testID={`model-option-${item.providerID}-${item.modelID}`}
                >
                  <View style={s.rowText}>
                    <Text style={[s.rowName, isDark && s.textWhite]} numberOfLines={1}>
                      {item.modelName || item.modelID}
                    </Text>
                    <Text style={[s.rowProvider, isDark && s.metaDark]}>{item.providerName || item.providerID}</Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                </TouchableOpacity>
              )
            }}
            contentContainerStyle={s.content}
            stickySectionHeadersEnabled
            keyboardShouldPersistTaps="handled"
          />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  backdrop: { flex: 1 },
  sheet: {
    maxHeight: "90%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    overflow: "hidden",
  },
  sheetDark: { backgroundColor: "#1a1a1a" },
  handleRow: { alignItems: "center", paddingVertical: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#cccccc" },
  handleDark: { backgroundColor: "#666666" },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#0a0a0a" },
  textWhite: { color: "#ffffff" },
  search: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0a0a0a",
    marginHorizontal: 16,
    marginBottom: 4,
  },
  searchDark: { backgroundColor: "#2a2a2a", color: "#ffffff" },
  content: { paddingBottom: 40 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sectionHeader: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeaderDark: { backgroundColor: "#111111" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaDark: { color: "#666666" },
  agentDot: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  rowDark: { borderBottomColor: "#2a2a2a" },
  rowSelected: { backgroundColor: colors.accentMuted },
  rowSelectedDark: { backgroundColor: colors.accentMutedDark },
  rowText: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "500", color: "#0a0a0a" },
  rowProvider: { fontSize: 12, color: "#999999", marginTop: 1 },
})
