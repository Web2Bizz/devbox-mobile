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

async function fetchServerProjects(): Promise<Project[]> {
  const client = useConnections.getState().client
  if (!client) throw new Error("No active connection")
  return client.project.list().catch(() => [] as Project[])
}

export function useServerProjects(enabled: boolean) {
  const client = useConnections((s) => s.client)
  return useQuery({
    queryKey: queryKeys.serverProjects,
    queryFn: fetchServerProjects,
    enabled: enabled && !!client,
    staleTime: 60_000,
  })
}
