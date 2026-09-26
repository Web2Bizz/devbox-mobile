// Catalog (agents / commands / providers) as a React Query snapshot.
//
// Split of responsibilities with the Zustand catalog store:
// - this module owns FETCHING + CACHING the server lists (deduped across
//   screens, refetched on reconnect/foreground, invalidated on connection
//   switch via invalidateConnectionScopeQueries);
// - the store owns the user's SELECTIONS (active agent/model/variant),
//   seeded from the snapshot via reseed() — selections are client state,
//   React Query must not own them.
import { useQuery } from "@tanstack/react-query"
import { useConnections } from "../stores/connections"
import { queryKeys } from "../lib/query-keys"
import { parseCatalogResponse, type ParsedCatalog, type RawProviderList } from "../lib/catalog-parse"
import type { Agent, Command } from "../lib/sdk"

// Shared fetcher behind both useCatalogData() and the connect-time prefetch
// in app/_layout.tsx — reads the current client lazily so it never closes
// over a stale one. Individual list failures degrade to empty (same tolerance
// the old store-level Promise.all(...).catch() had).
export async function fetchCatalogData(): Promise<ParsedCatalog> {
  const client = useConnections.getState().client
  if (!client) throw new Error("No active connection")
  const [agentResult, commandResult, providerResult] = await Promise.all([
    client.agent.list().catch(() => [] as Agent[]),
    client.command.list().catch(() => [] as Command[]),
    client.provider.list().catch(() => null as RawProviderList | null),
  ])
  return parseCatalogResponse(agentResult, commandResult, providerResult)
}

export function useCatalogData() {
  const client = useConnections((s) => s.client)
  return useQuery({
    queryKey: queryKeys.catalog,
    queryFn: fetchCatalogData,
    // Model/agent availability changes rarely; connection switches and
    // reconnects invalidate explicitly.
    staleTime: 5 * 60_000,
    enabled: !!client,
  })
}
