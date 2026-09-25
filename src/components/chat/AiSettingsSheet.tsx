import { useState, useCallback, useMemo } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetSectionList,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet"
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
  sheetRef: React.RefObject<BottomSheetModal | null>
}

// Single AI settings sheet: agent + model + reasoning effort, all selectable
// in one place. Model selection closes the sheet; agent/effort stay open so
// several settings can be changed in one go.
export function AiSettingsSheet({
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

  const handleSelectModel = useCallback(
    (providerID: string, modelID: string) => {
      onSelectModel(providerID, modelID)
      setSearch("")
      sheetRef.current?.dismiss()
    },
    [onSelectModel, sheetRef],
  )

  const header = (
    <View>
      <View style={s.header}>
        <Text style={[s.title, isDark && s.textWhite]}>{t("chat.aiSettings.title")}</Text>
        <BottomSheetTextInput
          style={[s.search, isDark && s.searchDark]}
          placeholder={t("chat.modelPicker.searchPlaceholder")}
          placeholderTextColor={isDark ? "#666666" : "#999999"}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

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
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={["60%", "90%"]}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={isDark ? s.sheetDark : s.sheet}
      handleIndicatorStyle={{ backgroundColor: isDark ? "#666666" : "#cccccc" }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
      )}
      onChange={(idx) => {
        if (idx === -1) setSearch("")
      }}
    >
      <BottomSheetSectionList
        sections={sections}
        ListHeaderComponent={header}
        keyExtractor={(item: ModelItem) => `${item.providerID}/${item.modelID}`}
        renderSectionHeader={({ section }: { section: { title: string } }) => (
          <View style={[s.sectionHeader, isDark && s.sectionHeaderDark]}>
            <Text style={[s.sectionTitle, isDark && s.metaDark]}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }: { item: ModelItem }) => {
          const active = selectedModel?.providerID === item.providerID && selectedModel?.modelID === item.modelID
          return (
            <TouchableOpacity
              style={[s.row, isDark && s.rowDark, active && (isDark ? s.rowSelectedDark : s.rowSelected)]}
              onPress={() => handleSelectModel(item.providerID, item.modelID)}
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
      />
    </BottomSheetModal>
  )
}

const s = StyleSheet.create({
  sheet: { backgroundColor: "#ffffff" },
  sheetDark: { backgroundColor: "#1a1a1a" },
  header: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  title: { fontSize: 18, fontWeight: "700", color: "#0a0a0a" },
  textWhite: { color: "#ffffff" },
  search: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0a0a0a",
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
    paddingTop: 8,
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
