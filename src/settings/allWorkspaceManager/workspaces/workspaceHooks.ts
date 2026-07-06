import { useState, useEffect } from 'react';
import type { WorkspaceData } from './workspaceTypes';
import { getAllWorkspaces } from './workspaceData';

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);

  useEffect(() => {
    let isMounted = true;
    getAllWorkspaces().then(data => {
      if (isMounted) setWorkspaces(data);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return {
    workspaces,
  };
}
