/**
 * Back-compat shim (card 2/5 decompose).
 *
 * Real hook lives in `@opencode-ai/uikit` (`packages/uikit/src/hooks/use-tablet.ts`,
 * breakpoints unified with the theme module). This file re-exports the package
 * so existing imports (`src/lib/use-tablet`, …) keep working — `app/` is untouched.
 * New code should import from `@opencode-ai/uikit` directly.
 */
export * from "@opencode-ai/uikit"
