// Session list reads + session CRUD mutations on React Query.
//
// The query cache owns the session LIST snapshot; the Zustand sessions store
// keeps only realtime/detail state (currentSession, messages, parts, sending).
// SSE handlers (events.ts) write server-pushed changes straight into the same
// cache via setQueryData, and realtime per-session cleanup (status/sending)
// runs in onSuccess — so the badge, the tasks screen and the project lists,
// which all read this one cache, can never diverge again.
import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useConnections } from "../stores/connections"
import { useEvents } from "../stores/events"
import { useSessions } from "../stores/sessions"
import { queryClient } from "../lib/query-client"
import { queryKeys } from "../lib/query-keys"
import type { Client, Session } from "../lib/sdk"

async function fetchSessionsList(): Promise<Session[]> {
  const conn = useConnections.getState()
  // A directory-less client so the server returns sessions from ALL projects,
  // not just the one matching the active connection's directory header.
  const client = conn.clientForDirectory(undefined) ?? conn.client
  if (!client) throw new Error("No active connection")
  return client.session.list({ roots: true, limit: 50 })
}

// Directory-aware client for a session (mirrors the old store helper): a
// session may belong to a project other than the active connection's.
function clientForSession(sessionID: string): Client | null {
  const conn = useConnections.getState()
  const session =
    queryClient.getQueryData<Session[]>(queryKeys.sessionsList)?.find((s) => s.id === sessionID) ??
    (useSessions.getState().currentSession?.id === sessionID
      ? useSessions.getState().currentSession
      : undefined)
  if (!session) return conn.client
  if (!session.directory) return conn.client
  const activeDir = conn.activeConnection?.directory
  if (session.directory === activeDir) return conn.client
  return conn.clientForDirectory(session.directory) ?? conn.client
}

export function useSessionsList() {
  const client = useConnections((s) => s.client)
  const query = useQuery({
    queryKey: queryKeys.sessionsList,
    queryFn: fetchSessionsList,
    enabled: !!client,
  })
  // The fresh list is authoritative about which sessions still exist: drop
  // statuses/sending flags for anything no longer present (deleted elsewhere,
  // outside the limit). Moved here from the old loadSessions() so every list
  // consumer benefits without imperative refetch calls.
  useEffect(() => {
    if (query.data) useEvents.getState().pruneStaleSessionStates(new Set(query.data.map((s) => s.id)))
  }, [query.data])
  return query
}

export function useCreateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars?: { directory?: string; title?: string }) => {
      const conn = useConnections.getState()
      const dir = vars?.directory?.trim() || undefined
      const client = dir ? (conn.clientForDirectory(dir) ?? conn.client) : conn.client
      if (!client) throw new Error("No active connection")
      return client.session.create({ title: vars?.title })
    },
    onSuccess: async (created, vars) => {
      // Creating into a custom folder must not mutate the connection's
      // default project — but the folder is worth remembering.
      const dir = vars?.directory?.trim() || undefined
      if (dir) await useConnections.getState().addRecentDirectory(dir)
      // Preserve the old createSession contract: the new session becomes
      // current with a clean slate (the session screen re-selects anyway).
      useSessions.setState({
        currentSession: created,
        messages: [],
        parts: {},
        hasMore: false,
        loadingMore: false,
      })
      await qc.invalidateQueries({ queryKey: queryKeys.sessionsList })
    },
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionID: string) => {
      const client = clientForSession(sessionID)
      if (!client) throw new Error("No active connection")
      await client.session.delete(sessionID)
      return sessionID
    },
    // Optimistic: the row disappears immediately; rollback on failure.
    onMutate: async (sessionID) => {
      await qc.cancelQueries({ queryKey: queryKeys.sessionsList })
      const previous = qc.getQueryData<Session[]>(queryKeys.sessionsList)
      qc.setQueryData<Session[]>(queryKeys.sessionsList, (old) => (old ?? []).filter((s) => s.id !== sessionID))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) qc.setQueryData(queryKeys.sessionsList, context.previous)
    },
    onSuccess: (sessionID) => {
      // The server sends no busy -> idle for a deleted session — without this
      // its SSE status/sending entries would linger as a ghost task.
      useEvents.getState().removeSessionState(sessionID)
      useSessions.setState((state) => ({
        currentSession: state.currentSession?.id === sessionID ? null : state.currentSession,
        messages: state.currentSession?.id === sessionID ? [] : state.messages,
        parts: state.currentSession?.id === sessionID ? {} : state.parts,
      }))
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.sessionsList })
    },
  })
}

export function useRenameSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; title: string; directory?: string }) => {
      const conn = useConnections.getState()
      const client = vars.directory
        ? (conn.clientForDirectory(vars.directory) ?? conn.client)
        : conn.client
      if (!client) throw new Error("No active connection")
      await client.session.update(vars.id, { title: vars.title })
      return vars.id
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.sessionsList })
    },
  })
}
