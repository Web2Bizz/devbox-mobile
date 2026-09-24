/**
 * @opencode-ai/uikit — shared UI kit (card 2/5 decompose).
 *
 * Card 2: theme tokens, tablet hook and Container live here as the single
 * source of truth. `src/lib/theme.ts`, `src/lib/use-tablet.ts` and
 * `src/components/Container.tsx` are thin re-export shims over this package
 * (no breaking changes — `app/` imports are untouched).
 *
 * Cards 3-5 (atoms, chat/markdown, import switching) are NOT part of this card.
 */

export * from "./theme"
export * from "./Container"
export * from "./hooks/use-tablet"
