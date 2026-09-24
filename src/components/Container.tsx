/**
 * Back-compat shim (card 2/5 decompose).
 *
 * Real component lives in `@opencode-ai/uikit` (`packages/uikit/src/Container.tsx`).
 * This file re-exports the package so existing imports
 * (`src/components/Container`, …) keep working — `app/` is untouched.
 * New code should import from `@opencode-ai/uikit` directly.
 */
export * from "@opencode-ai/uikit"
