/**
 * Back-compat shim (card 2/5 decompose).
 *
 * Real tokens live in `@opencode-ai/uikit` (`packages/uikit/src/theme.ts`).
 * This file re-exports the package so existing imports
 * (`src/lib/theme`, `../lib/theme`, …) keep working — `app/` is untouched.
 * New code should import from `@opencode-ai/uikit` directly.
 */
export * from "@opencode-ai/uikit"
