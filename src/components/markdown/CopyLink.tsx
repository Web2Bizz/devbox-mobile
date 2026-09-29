/**
 * Back-compat shim (uikit atoms card).
 *
 * Real component lives in `@opencode-ai/uikit`
 * (`packages/uikit/src/components/markdown/CopyLink.tsx`).
 * This file re-exports the package so existing imports
 * (`src/components/markdown/CopyLink`, …) keep working — `app/` is untouched.
 * New code should import from `@opencode-ai/uikit` directly.
 */
export * from "@opencode-ai/uikit"
