import { View, StyleSheet, type ViewProps } from "react-native"
import { layout } from "../lib/theme"

/**
 * Container — единый горизонтальный контейнер для всего приложения.
 *
 * До этого в проекте Container / Header как отдельные компоненты отсутствовали:
 * - `app/_layout.tsx` и `app/(tabs)/_layout.tsx` используют нативный header
 *   expo-router (Stack / Tabs), без кастомного <Header>
 * - каждый экран задавал `padding: 16` / `paddingHorizontal: 16` вручную
 * - из-за отсутствия container-токена `headerRight` (ConnectionBadge) рендерился
 *   без отступа справа и не выравнивался с контентом
 *
 * Этот компонент фиксирует ширину контейнера через `layout.containerPadding`
 * (16) и используется как:
 *  - обёртка для контента экранов
 *  - источник токена для `headerRightContainerStyle` / `headerLeftContainerStyle`
 *
 * Не навязывает maxWidth — в мобильном приложении контейнер = 100% ширины
 * с горизонтальными полями, следовать теме достаточно.
 */
export function Container({ style, children, ...props }: ViewProps) {
  return (
    <View style={[styles.container, style]} {...props}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: layout.containerPadding,
  },
})
