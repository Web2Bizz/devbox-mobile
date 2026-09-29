/**
 * Minimal chat-domain types (uikit card 2/5 — clean chat/markdown delta).
 *
 * Mirrors `src/lib/sdk.ts` (`Message`, `Part`) field-for-field so values
 * flowing from the app store stay structurally assignable, but lives inside
 * the package so uikit components never import `../../lib/*` (which does not
 * exist in the package — that import class is the known 16× TS2307 debt from
 * card 1). New code in this package should import these types directly.
 *
 * NOTE (debt, same class as card 1): other uikit chat components
 * (ToolCallCard, DirectoryBrowserSheet, …) still import `../../lib/*` /
 * `../../stores/*` — out of scope for this card, tracked separately.
 */

export interface Message {
  id: string
  sessionID: string
  role: "user" | "assistant"
  parentID?: string
  time: {
    created: number
    completed?: number
  }
  // User message fields
  agent?: string
  model?: { providerID: string; modelID: string }
  // Assistant message fields
  modelID?: string
  providerID?: string
  cost?: number
  tokens?: {
    input: number
    output: number
    reasoning?: number
    cache?: { read: number; write: number }
  }
  error?: { message: string }
  finish?: string
}

export interface Part {
  id: string
  sessionID?: string
  messageID: string
  type:
    | "text"
    | "reasoning"
    | "tool"
    | "file"
    | "snapshot"
    | "patch"
    | "step-start"
    | "step-finish"
    | "subtask"
    | "retry"
    | "compaction"
    | "agent"
  // Text / reasoning part
  text?: string
  // Tool part
  tool?: string
  callID?: string
  state?: {
    status: "pending" | "running" | "completed" | "error"
    input?: unknown
    output?: unknown
    title?: string
    error?: { message: string }
    time?: { start?: number; end?: number }
  }
  // Timing
  time?: { start?: number; end?: number }
  // File part
  mime?: string
  url?: string
  filename?: string
}
