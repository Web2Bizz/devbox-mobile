/**
 * Back-compat shim (uikit atoms card).
 *
 * Real component lives in `@web2bizz/ui-native`
 * (`packages/uikit/src/components/chat/Select.tsx`).
 * This file re-exports the package so existing imports
 * (`src/components/chat/Select`, `src/components/chat`, …) keep working —
 * `app/` is untouched.
 * New code should import from `@web2bizz/ui-native` directly.
 */
export * from "@web2bizz/ui-native"
