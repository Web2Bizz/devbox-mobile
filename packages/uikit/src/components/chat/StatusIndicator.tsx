import { memo, useEffect, useState } from "react"
import { View, Text, StyleSheet } from "react-native"
import MaskedView from "@react-native-masked-view/masked-view"
import { LinearGradient } from "expo-linear-gradient"
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import { useTranslation } from "react-i18next"

// Классический терминальный спиннер точками Брайля — вместо системного
// кружка показывает, что агент работает.
const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const
const BRAILLE_INTERVAL_MS = 80

// Шиммер подписи как у ИИ-чатов: серая плашка с пробегающей белой
// вертикальной полосой. Полоса — трёхстопный градиент [base, band, base],
// окно start→end шириной SHIMMER_SPAN едет слева направо по UI-потоку.
const SHIMMER_DURATION_MS = 1600
const SHIMMER_SPAN = 0.45

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient)

// Тик спиннера живёт в отдельном мемо-компоненте: setState каждые 80ms
// перерисовывает только маленький Text, а не весь бар. Раньше кадр хранился
// в StatusIndicator — каждый тик рекомпозитил MaskedView-маску и шиммер,
// и анимация выглядела прерывистой. Маунтится только пока busy (родитель
// в простое рисует плейсхолдер), так что отдельного флага не нужно —
// монтирование стартует тик, размонтирование его останавливает.
const BrailleSpinner = memo(function BrailleSpinner({ isDark }: { isDark: boolean }) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % BRAILLE_FRAMES.length)
    }, BRAILLE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])
  return <Text style={[s.spinner, isDark && s.textDark]}>{BRAILLE_FRAMES[frame]}</Text>
})

// Server-reported session status, read by the parent from its own store and
// passed in — the kit never imports app zustand stores (which do not exist
// in the package). Extra fields on the caller's status object are fine.
export interface StatusSnapshot {
  type: string
  attempt?: number
}

interface Props {
  status?: StatusSnapshot
  statusText?: string
  optimistic?: boolean
  isDark: boolean
}

export function StatusIndicator({ status, statusText, optimistic, isDark }: Props) {
  const { t } = useTranslation()

  // Server status is the source of truth, but the optimistic `sending` flag
  // must also count on its own: it bridges the gap between the user tapping
  // send and the server confirming busy (including a stale `idle` left over
  // from the previous run). Once the server reports idle for the current
  // run, the parent clears `sending` too, so `sseBusy || optimistic` can't
  // get stuck.
  const sseBusy = !!status && status.type !== "idle"
  const busy = sseBusy || optimistic

  // Прогон шиммера — только пока busy, shared value живёт вне рендера.
  const sweep = useSharedValue(0)
  useEffect(() => {
    if (!busy) return
    sweep.value = withRepeat(
      withTiming(1, { duration: SHIMMER_DURATION_MS, easing: Easing.linear }),
      -1,
      false,
    )
    return () => cancelAnimation(sweep)
  }, [busy, sweep])
  const gradientProps = useAnimatedProps(() => {
    const x = sweep.value * (1 + SHIMMER_SPAN) - SHIMMER_SPAN
    return {
      start: { x, y: 0 },
      end: { x: x + SHIMMER_SPAN, y: 0 },
    }
  })

  if (!busy) return <View style={s.barPlaceholder} />

  const label =
    status?.type === "retry" && typeof status.attempt === "number"
      ? t("chat.statusIndicator.retrying", { attempt: status.attempt })
      : statusText || t("chat.statusIndicator.working")
  // База градиента — цвет подписи в текущей теме, полоса — белая.
  const shimmerColors = isDark
    ? (["#888888", "#ffffff", "#888888"] as const)
    : (["#666666", "#ffffff", "#666666"] as const)

  return (
    <View style={[s.bar, isDark && s.barDark]}>
      <BrailleSpinner isDark={isDark} />
      {/* Маска вырезает градиент строго по форме букв — полоса бежит
          только по тексту, а не прямоугольником поверх строки. */}
      <MaskedView
        style={s.labelMask}
        maskElement={
          <View style={s.labelMaskInner}>
            <Text style={s.maskText}>{label}</Text>
          </View>
        }
      >
        <AnimatedGradient
          colors={shimmerColors}
          start={{ x: -SHIMMER_SPAN, y: 0 }}
          end={{ x: 0, y: 0 }}
          animatedProps={gradientProps}
          style={s.labelGradient}
        />
      </MaskedView>
    </View>
  )
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    // Без собственных горизонтальных отступов: бар — ListHeaderComponent
    // внутри списка, у которого уже есть padding 16. Свои paddingHorizontal
    // давали двойной отступ (32) и выбивали текст из сетки пузырей.
    height: 36,
    backgroundColor: "transparent",
  },
  barPlaceholder: { height: 36 },
  barDark: { backgroundColor: "transparent" },
  // Брайлевский спиннер: кегль крупнее подписи, цвет — как у неё.
  spinner: { fontSize: 16, color: "#666666" },
  textDark: { color: "#888888" },
  // Шиммер подписи: маска занимает остаток строки, градиент — её целиком.
  labelMask: { flex: 1, height: 36 },
  labelMaskInner: { flex: 1, justifyContent: "center" },
  // Метрики бывшей подписи (13px/500); цвет любой непрозрачный —
  // маска смотрит только на альфу.
  maskText: { fontSize: 13, fontWeight: "500", color: "#000000" },
  labelGradient: { flex: 1 },
})
