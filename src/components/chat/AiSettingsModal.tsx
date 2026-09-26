import { useMemo } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { colors } from "../../lib/theme"
import { Select, type SelectOption } from "./Select"

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

const MODEL_ID_SEP = "/"

// Single AI settings dialog: agent + model + reasoning effort as three
// custom Select dropdowns in app theme. Plain RN Modal (no bottom-sheet
// deps): guaranteed to open regardless of layout measurement. Model
// selection closes the dialog; agent/effort stay open so several settings
// can change in one go.
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

  const effortDescriptions: Record<string, string> = {
    low: t("chat.variantPicker.effort.low"),
    medium: t("chat.variantPicker.effort.medium"),
    high: t("chat.variantPicker.effort.high"),
  }

  const agentOptions: SelectOption[] = useMemo(
    () =>
      agents.map((a) => ({
        id: a.name,
        label: a.name,
        description: a.description,
        dotColor: a.color || colors.accent,
      })),
    [agents],
  )

  const effortOptions: SelectOption[] = useMemo(
    () => [
      { id: null, label: t("chat.variantPicker.autoLabel"), description: t("chat.variantPicker.autoDescription") },
      ...Object.keys(variants || {}).map((id) => ({
        id: id as string,
        label: id.charAt(0).toUpperCase() + id.slice(1),
        description: effortDescriptions[id],
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variants, t],
  )
  const showEffort = Object.keys(variants || {}).length > 0

  const modelOptions: SelectOption[] = useMemo(() => {
    const list = Array.isArray(providers) ? providers : []
    const out: SelectOption[] = []
    // Selected model first within its provider group
    const ordered = selectedModel
      ? [...list].sort((a, b) => {
          const aHas = a.id === selectedModel.providerID ? 0 : 1
          const bHas = b.id === selectedModel.providerID ? 0 : 1
          return aHas - bHas
        })
      : list
    for (const p of ordered) {
      const models = [...(p.models || [])]
      if (selectedModel && p.id === selectedModel.providerID) {
        models.sort((a, b) => (a.id === selectedModel.modelID ? -1 : b.id === selectedModel.modelID ? 1 : 0))
      }
      for (const m of models) {
        out.push({
          id: `${p.id}${MODEL_ID_SEP}${m.id}`,
          label: m.name || m.id,
          description: p.name || p.id,
          group: p.name || p.id,
        })
      }
    }
    return out
  }, [providers, selectedModel])

  const selectedModelId = selectedModel ? `${selectedModel.providerID}${MODEL_ID_SEP}${selectedModel.modelID}` : null

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[s.sheet, isDark && s.sheetDark]}
        >
          <View style={s.handleRow}>
            <View style={[s.handle, isDark && s.handleDark]} />
          </View>
          <View style={s.titleRow}>
            <Text style={[s.title, isDark && s.textWhite]}>{t("chat.aiSettings.title")}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} testID="ai-settings-close">
              <Ionicons name="close" size={22} color={isDark ? "#888888" : "#666666"} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <Select
              label={t("chat.aiSettings.agentLabel")}
              options={agentOptions}
              selectedId={selectedAgent}
              isDark={isDark}
              onSelect={(id) => id && onSelectAgent(id)}
              testID="agent-select"
            />
            {showEffort && (
              <Select
                label={t("chat.aiSettings.effortLabel")}
                options={effortOptions}
                selectedId={selectedVariant}
                isDark={isDark}
                onSelect={onSelectVariant}
                testID="effort-select"
              />
            )}
            <Select
              label={t("chat.aiSettings.modelLabel")}
              options={modelOptions}
              selectedId={selectedModelId}
              isDark={isDark}
              onSelect={(id) => {
                if (!id) return
                const sep = id.indexOf(MODEL_ID_SEP)
                onSelectModel(id.slice(0, sep), id.slice(sep + 1))
                onClose()
              }}
              searchPlaceholder={t("chat.modelPicker.searchPlaceholder")}
              testID="model-select"
            />
          </ScrollView>
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
    paddingBottom: 24,
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
  content: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
})
