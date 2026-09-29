/**
 * Back-compat shim (card 2/5 decompose).
 *
 * Real component lives in `@web2bizz/ui-native` (`packages/uikit/src/Container.tsx`).
 * This file re-exports the package so existing imports
 * (`src/components/Container`, …) keep working — `app/` is untouched.
 * New code should import from `@web2bizz/ui-native` directly.
 */
export * from "@web2bizz/ui-native"
