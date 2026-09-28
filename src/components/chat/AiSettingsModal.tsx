import { useCallback, useMemo } from "react"
import { View, Text, StyleSheet, useWindowDimensions } from "react-native"
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet"
import { useTranslation } from "react-i18next"
import { colors, breakpoints } from "../../lib/theme"
import { isLandscapeSize, shouldCapSheetContent, sheetContentCap } from "../../lib/sheet-layout"
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
  // Parent-owned ref — the sheet is UNCONTROLLED (no `visible` prop): the
  // parent opens/closes it imperatively, exactly like the folder sheets.
  // A controlled `visible` + onChange→close feedback loop proved fragile
  // here (spurious close commands cancel the opening animation), so this
  // deliberately keeps no open/close state of its own.
  sheetRef: React.RefObject<BottomSheet | null>
}

const MODEL_ID_SEP = "/"

// Single AI settings sheet: agent + model + reasoning effort as three
// custom Select dropdowns in app theme. A real bottom sheet (draggable
// handle, swipe-down to close) built on the SAME proven recipe as the folder
// sheets (BottomSheet + index -1 + imperative expand/close via a parent-owned
// ref): BottomSheetModal present()/dismiss() proved unreliable on this stack
// (upstream portal and dynamic-sizing flakiness in 5.2.x — the sheet silently
// never opened), and a controlled `visible` prop with an onChange→close loop
// backfires the same way. Model selection closes the dialog; agent/effort
// stay open so several settings can change in one go.
export function AiSettingsModal({
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
  sheetRef,
}: Props) {
  const { t } = useTranslation()

  // Detents: phones open tall (70%) so agent/model/effort lists are usable
  // without cramped scrolling; tablets keep the compact 40% portrait sheet.
  // Landscape always goes near-full height — "40%" of a landscape-height
  // screen is a ~300pt strip. Wide content cap: rows must not stretch
  // across a 1100pt+ tablet.
  const { width: winWidth, height: winHeight } = useWindowDimensions()
  const isLandscape = isLandscapeSize(winWidth, winHeight)
  const isPhone = winWidth < breakpoints.tablet
  const capContent = shouldCapSheetContent(winWidth)
  const snapPoints = useMemo(() => {
    if (isLandscape) return ["85%"]
    return [isPhone ? "70%" : "40%"]
  }, [isLandscape, isPhone])
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
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      // Explicit (true by default): the handle pill must stay draggable.
      enableHandlePanningGesture
      handleComponent={SheetHandle}
      backdropComponent={renderBackdrop}
      backgroundStyle={[s.sheet, isDark && s.sheetDark]}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <View style={[s.titleRow, capContent && sheetContentCap]}>
        <Text style={[s.title, isDark && s.textWhite]}>{t("chat.aiSettings.title")}</Text>
      </View>
      <BottomSheetScrollView contentContainerStyle={s.content}>
        <View style={[s.contentInner, capContent && sheetContentCap]}>
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
            sheetRef.current?.close()
          }}
          searchPlaceholder={t("chat.modelPicker.searchPlaceholder")}
          testID="model-select"
        />
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
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
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  // Inner column: carries the gap + the wide-screen centered cap (the cap
  // must sit on an inner View — on the scroll content container itself it
  // would left-stick instead of centering).
  contentInner: { gap: 12 },
})
