/**
 * Back-compat shim (card 2/5 decompose).
 *
 * Real tokens live in `@web2bizz/ui-native` (`packages/uikit/src/theme.ts`).
 * This file re-exports the package so existing imports
 * (`src/lib/theme`, `../lib/theme`, …) keep working — `app/` is untouched.
 * New code should import from `@web2bizz/ui-native` directly.
 */
export * from "@web2bizz/ui-native"
