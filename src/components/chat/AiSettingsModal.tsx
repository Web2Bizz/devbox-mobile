import { useCallback, useEffect, useMemo, useRef } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet"
import { useTranslation } from "react-i18next"
import { colors } from "../../lib/theme"
import { Select, type SelectOption } from "./Select"
import { SheetHandle } from "./SheetHandle"

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

// Single AI settings sheet: agent + model + reasoning effort as three
// custom Select dropdowns in app theme. A real BottomSheetModal (not a stock
// RN Modal with a decorative pill) so it drags by the handle and dismisses
// on swipe-down like every other sheet. The `visible` prop API is kept —
// internally mapped to present()/dismiss() — so callers don't change. Model
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
  const sheetRef = useRef<BottomSheetModal>(null)

  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  const snapPoints = useMemo(() => ["60%", "92%"], [])
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" opacity={0.5} />
    ),
    [],
  )

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
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      enableDismissOnClose
      // Explicit (true by default): the handle pill must stay draggable.
      enableHandlePanningGesture
      handleComponent={SheetHandle}
      backdropComponent={renderBackdrop}
      backgroundStyle={[s.sheet, isDark && s.sheetDark]}
      onDismiss={onClose}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <View style={s.titleRow}>
        <Text style={[s.title, isDark && s.textWhite]}>{t("chat.aiSettings.title")}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={12} testID="ai-settings-close">
          <Ionicons name="close" size={22} color={isDark ? "#888888" : "#666666"} />
        </TouchableOpacity>
      </View>
      <BottomSheetScrollView contentContainerStyle={s.content}>
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
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetDark: { backgroundColor: "#1a1a1a" },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#0a0a0a" },
  textWhite: { color: "#ffffff" },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
})
