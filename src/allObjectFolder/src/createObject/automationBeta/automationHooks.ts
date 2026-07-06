/**
 * @file automationHooks.ts
 * @description Provides custom React hooks (`useAutomation` and `useAutomations`) 
 * to fetch and subscribe to automation records reactively from IndexedDB.
 * 
 * @usage
 * ```tsx
 * import { useAutomation } from './automationHooks';
 * const automation = useAutomation(automationId);
 * ```
 */

import { useLiveQuery } from 'dexie-react-hooks';

import { getAutomation, getAutomationsForWorkspace, getAllAutomations } from './automationData';

/**
 * Subscribes to a single automation by its ID.
 */
export function useAutomation(id: string | null) {
  return useLiveQuery(() => (id ? getAutomation(id) : undefined), [id]);
}

/**
 * Subscribes to a collection of automations.
 */
export function useAutomations(workspaceId?: string) {
  return useLiveQuery(
    async () => {
      if (workspaceId) {
        return getAutomationsForWorkspace(workspaceId);
      }
      return getAllAutomations();
    },
    [workspaceId],
    []
  );
}
