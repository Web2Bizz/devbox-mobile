// Metro bundler config - Sentry removed, use default Expo config.
// Card 1/5 (uikit skeleton): resolve `@opencode-ai/uikit` to packages/uikit.
// Variant B (tsconfig paths + extraNodeModules) is the primary working resolve —
// works immediately without reinstall. Variant A (npm workspaces + file: dep in
// root package.json) is declared in parallel; once `npm install` materializes
// node_modules/@opencode-ai/uikit, watchFolders keeps Metro watching it.
const path = require("path")
const { getDefaultConfig } = require("expo/metro-config")

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "packages")]
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@opencode-ai/uikit": path.resolve(__dirname, "packages/uikit"),
}

module.exports = config
