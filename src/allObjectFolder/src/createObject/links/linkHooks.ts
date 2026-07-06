/**
 * @file linkHooks.ts
 * @description Provides React hooks (`useLink` and `useLinks`) for subscribing to
 * link record data reactively from IndexedDB.
 * 
 * @usage
 * ```tsx
 * import { useLink } from './linkHooks';
 * const link = useLink(linkId);
 * ```
 */

import { useLiveQuery } from 'dexie-react-hooks';

import { getLink, getLinksForWorkspace, getAllLinks } from './linkData';

/**
 * Subscribes to a single link by its ID.
 */
export function useLink(id: string | null) {
  return useLiveQuery(() => (id ? getLink(id) : undefined), [id]);
}

/**
 * Subscribes to a collection of links.
 */
export function useLinks(workspaceId?: string) {
  return useLiveQuery(
    async () => {
      if (workspaceId) {
        return getLinksForWorkspace(workspaceId);
      }
      return getAllLinks();
    },
    [workspaceId],
    []
  );
}
