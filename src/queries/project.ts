// Project-scoped reads: current project info + server-known project list.
//
// Both are keyed on the ACTIVE connection implicitly (the queryFn reads the
// current client lazily), so every connection change must invalidate them —
// see invalidateConnectionScopeQueries(), called from the connections store.
// The Zustand connections store no longer mirrors this data: hooks below are
// the single source of truth.
import { useQuery } from "@tanstack/react-query"
import { useConnections } from "../stores/connections"
import { queryKeys } from "../lib/query-keys"
import type { Project } from "../lib/sdk"

export interface ProjectInfo {
  project: Project | null
  home: string | null
}

async function fetchProjectInfo(): Promise<ProjectInfo> {
  const client = useConnections.getState().client
  if (!client) throw new Error("No active connection")
  const [project, paths] = await Promise.all([
    client.project.current().catch(() => null),
    client.path.get().catch(() => null),
  ])
  return { project, home: paths?.home ?? null }
}

export function useProjectInfo() {
  const client = useConnections((s) => s.client)
  return useQuery({
    queryKey: queryKeys.projectInfo,
    queryFn: fetchProjectInfo,
    enabled: !!client,
    staleTime: 60_000,
  })
}

async function fetchServerProjects(connectionId?: string): Promise<Project[]> {
  const conn = useConnections.getState()
  // Explicit origin: the caller's connection id wins, otherwise the active
  // one. NEVER fall back to the active server when an explicit id was given
  // and is unknown — a wrong-server list is worse than an explicit error.
  const targetId = connectionId ?? conn.activeConnection?.id
  if (!targetId) throw new Error("No active connection")
  if (connectionId && !conn.clientBases[connectionId]) throw new Error("No active connection")
  // No stored credentials (LAN added but not logged in): surface it instead
  // of swallowing into an empty list — the LAN tab renders "login required".
  if (!conn.clientBases[targetId]?.auth) throw new Error("Login required")
  const client = conn.clientForConnection(targetId)
  if (!client) throw new Error("No active connection")
  // Errors (401/network) propagate to the caller — the LAN tab shows them
  // instead of an indistinguishable empty state.
  return client.project.list()
}

export function useServerProjects(enabled: boolean) {
  const activeId = useConnections((s) => s.activeConnection?.id)
  const hasClient = useConnections((s) => !!s.client)
  const targetId = activeId ?? ""
  return useQuery({
    // Keyed on the connection so per-server snapshots never collide and a
    // setActiveConnection/addLanConnection switch refetches via the key
    // change alone (plus invalidateConnectionScopeQueries' prefix drop).
    queryKey: queryKeys.serverProjectsFor(targetId),
    queryFn: () => fetchServerProjects(targetId || undefined),
    enabled: enabled && !!activeId && hasClient,
    staleTime: 60_000,
  })
}
