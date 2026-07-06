/**
 * @file tagHooks.ts
 * @description Provides React hook (`useTags`) for retrieving and filtering 
 * tags from the database store based on workspace ID.
 * 
 * @usage
 * ```tsx
 * import { useTags } from './tagHooks';
 * const tags = useTags(workspaceId);
 * ```
 */

import { useMemo } from 'react';

import { useDbStore } from '../../../../storage/store/useDbStore';

export const useTags = (workspaceId?: string) => {
  const allTags = useDbStore(state => state.tags);
  
  return useMemo(() => {
    if (!workspaceId) {
      return allTags;
    }
    return allTags.filter(tag => tag.workspaceId === workspaceId);
  }, [allTags, workspaceId]);
};
