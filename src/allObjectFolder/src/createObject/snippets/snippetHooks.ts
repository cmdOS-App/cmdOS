/**
 * @file snippetHooks.ts
 * @description Provides React hooks (`useSnippet` and `useSnippets`) for subscribing to
 * snippet records reactively using dexie-react-hooks.
 * 
 * @usage
 * ```tsx
 * import { useSnippet } from './snippetHooks';
 * const snippet = useSnippet(snippetId);
 * ```
 */

import { useLiveQuery } from 'dexie-react-hooks';

import { getSnippet, getSnippetsForWorkspace, getAllSnippets } from './snippetData';

/**
 * Subscribes to a single snippet by its ID.
 */
export function useSnippet(id: string | null) {
  return useLiveQuery(() => (id ? getSnippet(id) : undefined), [id]);
}

/**
 * Subscribes to a collection of snippets.
 */
export function useSnippets(workspaceId?: string) {
  return useLiveQuery(
    async () => {
      if (workspaceId) {
        return getSnippetsForWorkspace(workspaceId);
      }
      return getAllSnippets();
    },
    [workspaceId],
    []
  );
}
