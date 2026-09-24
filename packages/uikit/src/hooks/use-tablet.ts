<<<<<<<< HEAD:packages/uikit/src/hooks/use-tablet.ts
import { useWindowDimensions } from "react-native"
import { breakpoints } from "../theme"

========
>>>>>>>> 36aa438 (feat(uikit,tablet): extract @opencode-ai/uikit package and tablet adaptivity; repo cleanup):src/lib/use-tablet.ts
/**
 * Back-compat shim (card 2/5 decompose).
 *
<<<<<<<< HEAD:packages/uikit/src/hooks/use-tablet.ts
 * Использует `useWindowDimensions().width` (реактивен к повороту), а не
 * статичный снапшот размера окна (см. MessageBubble.tsx:179 — там размер
 * снимается один раз при старте и не пересчитывается при повороте).
 *
 * Брейкпоинты — единый источник из `../theme` (tablet 768 / desktop 1024),
 * бывшие локальные константы TABLET_BREAKPOINT / DESKTOP_BREAKPOINT убраны.
========
 * Real hook lives in `@opencode-ai/uikit` (`packages/uikit/src/hooks/use-tablet.ts`,
 * breakpoints unified with the theme module). This file re-exports the package
 * so existing imports (`src/lib/use-tablet`, …) keep working — `app/` is untouched.
 * New code should import from `@opencode-ai/uikit` directly.
>>>>>>>> 36aa438 (feat(uikit,tablet): extract @opencode-ai/uikit package and tablet adaptivity; repo cleanup):src/lib/use-tablet.ts
 */
export * from "@opencode-ai/uikit"
