/**
 * Back-compat shim (uikit atoms card).
 *
 * Real component lives in `@opencode-ai/uikit`
 * (`packages/uikit/src/components/ErrorBoundary.tsx`).
 * This file re-exports the package so existing imports
 * (`src/components/ErrorBoundary`, …) keep working — `app/` is untouched.
 * New code should import from `@opencode-ai/uikit` directly.
 */
export * from "@opencode-ai/uikit"
