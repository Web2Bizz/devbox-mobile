import { create } from "zustand"
import { type Session, type Message, type Part, type Event, type MessageWithParts, type Client } from "../lib/sdk"
import { useConnections } from "./connections"
import { useSettings } from "./settings"
import { mergeIncomingMessage } from "../lib/message-merge"
import { isColdSessionLoad, isLiveEventForSession } from "../lib/session-load-reconcile"
import { queryClient } from "../lib/query-client"
import { queryKeys } from "../lib/query-keys"

// State split with React Query (see src/queries/):
// - React Query owns SERVER SNAPSHOTS: the session list, catalogs, project
//   info (fetch + cache + dedup + invalidation).
// - This store owns REALTIME / DETAIL state: the open session, its messages
//   and parts with live SSE merging, optimistic sending flags, pagination.
// Snapshots seed this store (selectSession/refreshMessages fetch through the
// query cache), and SSE handlers write server-pushed changes back into the
// cache — one source of truth per concern, no mirrors.

// Helper to convert API response to our internal format
function parseMessages(response: MessageWithParts[]): { messages: Message[]; parts: Record<string, Part[]> } {
  const messages: Message[] = []
  const parts: Record<string, Part[]> = {}

  for (const item of response || []) {
    messages.push(item.info)
    parts[item.info.id] = item.parts || []
  }

  return { messages, parts }
}

function pageSize(): number {
  return useSettings.getState().pageSize
}

interface SessionsState {
  currentSession: Session | null
  messages: Message[]
  parts: Record<string, Part[]>
  isLoading: boolean
  // Per-session optimistic sending flag — bridging gap between user tap and SSE busy
  sending: Record<string, boolean>
  loadingMore: boolean
  hasMore: boolean
  error: string | null

  // Actions
  selectSession: (sessionID: string, directory?: string) => Promise<void>
  loadOlderMessages: () => Promise<void>
  // Fire-and-forget prompt: the "response" arrives as streamed SSE events,
  // not as an HTTP response, so useMutation's request/response model does not
  // fit — the orchestration (optimistic message, sending flag, error + retry)
  // stays here while status/message updates flow through SSE as before.
  sendMessage: (
    text: string,
    model?: { providerID: string; modelID: string },
    agent?: string,
    files?: Array<{ uri: string; mime: string; filename?: string; base64?: string }>,
    variant?: string,
  ) => Promise<void>
  refreshMessages: () => Promise<void>

  // Event handling
  handleEvent: (event: Event) => void
}

// Sessions the user aborted since they last went busy. Mirrors events.ts's
// erroredSessions: SessionStatus has no "aborted" variant — an aborted run
// still ends with a busy -> idle transition — so without this mark a
// user-cancelled run would count as a success toward the store review prompt.
// events.ts (which already imports this module) clears entries on busy and
// checks them on busy -> idle.
export const abortedSessions = new Set<string>()

// Monotonic token guarding selectSession against out-of-order resolution: a
// slow fetch for a session the user has already navigated away from must not
// overwrite the messages/currentSession of a newer selection. Each call takes
// the next value and only commits its result if still the latest.
let selectSeq = 0

// Get the right client for a session's directory
function clientFor(directory?: string): Client | null {
  const connState = useConnections.getState()
  if (!directory) return connState.client
  const connDir = connState.activeConnection?.directory
  if (directory !== connDir) return connState.clientForDirectory(directory)
  return connState.client
}

export const useSessions = create<SessionsState>((set, get) => ({
  currentSession: null,
  messages: [],
  parts: {},
  isLoading: false,
  sending: {},
  loadingMore: false,
  hasMore: false,
  error: null,

  selectSession: async (sessionID, directory) => {
    // Use directory-specific client if the session belongs to a different project
    const connState = useConnections.getState()
    const client = directory ? connState.clientForDirectory(directory) : connState.client
    if (!client) {
      set({ error: "No active connection" })
      return
    }

    const seq = ++selectSeq
    // Re-selecting the session already shown on screen (e.g. #121's
    // useFocusEffect resync firing again on re-entry) is a background
    // refresh, not a cold load: the screen already has this session's
    // messages, and live SSE updates keep flowing to them the whole time.
    // Forcing isLoading back to true here would hide the entire
    // conversation — including anything streaming in live right now —
    // behind a spinner for as long as this redundant fetch takes, and if it
    // stalls (flaky network), the screen looks permanently stuck "loading"
    // until the user backs out and re-enters (issue #150). Only a
    // genuinely new/different session needs the blocking spinner.
    const isColdLoad = isColdSessionLoad(get().currentSession?.id, sessionID)
    try {
      // NOTE: do NOT reset sending[sessionID] here. It bridges the gap
      // between tap and SSE busy, and selectSession runs on every screen
      // focus (see useFocusEffect) — clearing it hid the Stop button after
      // leaving and re-entering a running chat. SSE sessionStatus is the
      // source of truth and events.ts already clears `sending` on idle/error.
      set((state) => ({
        isLoading: isColdLoad ? true : state.isLoading,
        error: null,
        hasMore: false,
        loadingMore: false,
      }))

      // Seeded through the query cache: re-entering a recently seen session
      // resolves from cache (inside staleTime) instead of flashing a spinner
      // and hammering the server — live SSE updates continue on top.
      const [session, messagesResponse] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: queryKeys.sessionDetail(sessionID),
          queryFn: () => client.session.get(sessionID),
        }),
        queryClient.fetchQuery({
          queryKey: queryKeys.sessionMessages(sessionID),
          queryFn: () => client.session.messages(sessionID, { limit: pageSize() }),
        }),
      ])

      // A newer selectSession started while we were fetching — discard this
      // stale result so it can't clobber the newer selection.
      if (seq !== selectSeq) return

      // Parse the API response format: array of { info, parts }
      const { messages, parts } = parseMessages(messagesResponse)

      set({
        currentSession: session,
        messages,
        parts,
        isLoading: false,
        // If we got exactly PAGE_SIZE messages, there are probably more
        hasMore: messagesResponse.length >= pageSize(),
      })
    } catch (err) {
      if (seq !== selectSeq) return
      console.error("Failed to load session:", err)
      set({ error: "Failed to load session", isLoading: false })
    }
  },

  loadOlderMessages: async () => {
    const client = clientFor(get().currentSession?.directory)
    const session = get().currentSession
    if (!client || !session) return
    if (get().loadingMore || !get().hasMore) return

    try {
      set({ loadingMore: true })

      // Full-history escape hatch: fetches ALL messages bypassing the paged
      // cache entry (a different shape — unpaged) and merges locally with any
      // optimistic temp messages. Deliberately not cached: it exists to
      // collapse pagination, and the next selectSession seeds from cache.
      const response = await client.session.messages(session.id)
      const { messages: all, parts: allParts } = parseMessages(response)

      // Merge: use all messages from full fetch, but keep any temp/optimistic messages
      const existing = get().messages
      const temp = existing.filter((m) => m.id.startsWith("temp-"))
      const merged = [...all, ...temp]

      set({
        messages: merged,
        parts: { ...allParts, ...Object.fromEntries(temp.map((m) => [m.id, get().parts[m.id] || []])) },
        loadingMore: false,
        hasMore: false, // We loaded everything
      })
    } catch (error) {
      console.error("Failed to load older messages:", error)
      set({ loadingMore: false })
    }
  },

  sendMessage: async (text, model, agent, files, variant) => {
    const client = clientFor(get().currentSession?.directory)
    const session = get().currentSession
    if (!client || !session) {
      set({ error: "No active session" })
      return
    }

    try {
      set((state) => ({ sending: { ...state.sending, [session.id]: true }, error: null }))

      // Add user message optimistically
      const ts = Date.now()
      const userMessage: Message = {
        id: `temp-${ts}`,
        sessionID: session.id,
        role: "user",
        time: { created: ts },
        model,
        agent,
      }
      const optimisticParts: Part[] = []
      if (text) {
        optimisticParts.push({
          id: `temp-part-text-${ts}`,
          messageID: userMessage.id,
          type: "text",
          text,
        })
      }
      if (files) {
        for (let i = 0; i < files.length; i++) {
          const f = files[i]
          optimisticParts.push({
            id: `temp-part-file-${ts}-${i}`,
            messageID: userMessage.id,
            type: "file",
            mime: f.mime,
            url: f.uri,
            filename: f.filename,
          })
        }
      }

      set((state) => ({
        messages: [...state.messages, userMessage],
        parts: { ...state.parts, [userMessage.id]: optimisticParts },
      }))

      // Build prompt parts - images are already converted to JPEG with base64 by toJpeg()
      const promptParts: Array<
        { type: "text"; text: string } | { type: "file"; mime: string; url: string; filename?: string }
      > = []
      if (text) {
        promptParts.push({ type: "text", text })
      }
      if (files) {
        for (const f of files) {
          const url = f.base64 ? `data:${f.mime};base64,${f.base64}` : f.uri
          promptParts.push({ type: "file", mime: f.mime, url, filename: f.filename })
        }
      }

      // Await submission (POST to /prompt_async resolves fast, well before the
      // streamed response) so a failure here can propagate to the caller — SSE
      // events still update messages/parts/status in real-time on success.
      await client.session.prompt(session.id, { parts: promptParts, model, agent, variant })
    } catch (err) {
      console.error("[sendMessage] error:", err)
      const stillCurrent = get().currentSession?.id === session.id
      set((state) => ({
        ...(stillCurrent ? { error: String(err) } : {}),
        sending: { ...state.sending, [session.id]: false },
      }))
      if (stillCurrent) get().refreshMessages()
      throw err
    }
  },

  refreshMessages: async () => {
    const client = clientFor(get().currentSession?.directory)
    const session = get().currentSession
    if (!client || !session) return

    try {
      // Explicit refresh — bypass the stale window so error/completion paths
      // always reconcile against the live server state.
      const response = await queryClient.fetchQuery({
        queryKey: queryKeys.sessionMessages(session.id),
        queryFn: () => client.session.messages(session.id),
        staleTime: 0,
      })
      const { messages, parts } = parseMessages(response)
      set({ messages, parts })
    } catch (error) {
      set({ error: "Failed to refresh messages" })
    }
  },

  handleEvent: (event) => {
    const { currentSession } = get()
    if (!currentSession) return

    const props = (event as any).properties || {}

    switch (event.type) {
      case "message.updated": {
        const message = (props.info || props.message) as Message | undefined
        if (!message || !isLiveEventForSession(message.sessionID, currentSession.id)) return

        set((state) => ({
          messages: mergeIncomingMessage(state.messages, message),
          // A live update for the session on screen is proof it has content
          // to show — clear any stuck spinner even if the initial (or a
          // redundant re-focus) GET hasn't resolved yet, or never does
          // (issue #150). Only ever clears, never sets it back to true.
          isLoading: false,
        }))
        break
      }

      case "message.part.updated": {
        const part = props.part as Part | undefined
        if (!part) return
        // Only handle parts for current session
        if (part.sessionID && part.sessionID !== currentSession.id) return

        set((state) => {
          const messageParts = state.parts[part.messageID] || []
          const exists = messageParts.some((p) => p.id === part.id)
          return {
            parts: {
              ...state.parts,
              [part.messageID]: exists
                ? messageParts.map((p) => (p.id === part.id ? part : p))
                : [...messageParts, part],
            },
            // See message.updated above — a live part update is just as
            // much proof of life as a message update.
            isLoading: false,
          }
        })
        break
      }

      case "message.removed": {
        const messageID = props.messageID as string
        if (!messageID) return
        set((state) => ({
          messages: state.messages.filter((m) => m.id !== messageID),
          parts: Object.fromEntries(Object.entries(state.parts).filter(([k]) => k !== messageID)),
        }))
        break
      }

      case "session.updated": {
        const session = (props.info || props) as Session | undefined
        if (!session?.id) return

        // The list snapshot lives in the React Query cache (updated there by
        // events.ts) — here only the open session's own copy is refreshed.
        set((state) => ({
          currentSession: state.currentSession?.id === session.id ? session : state.currentSession,
          isLoading: isLiveEventForSession(session.id, state.currentSession?.id) ? false : state.isLoading,
        }))
        break
      }
    }
  },
}))
