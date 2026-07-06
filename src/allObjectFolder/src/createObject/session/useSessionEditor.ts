/**
 * @file useSessionEditor.ts
 * @description A custom React hook containing state management and logic for the Session editor,
 * including tab-list comparison, autosaving, workspace/tag syncing, and concurrency conflict checks.
 * 
 * @usage
 * ```tsx
 * import { useSessionEditor } from './useSessionEditor';
 * const state = useSessionEditor({ sessionId });
 * ```
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { createSession, updateSession, deleteSession } from './sessionData';
import type { SessionRecord, CreateSessionInput, UpdateSessionInput } from './sessionTypes';
import type { LinkItem } from '../links/linkTypes';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { getSmartDefaultWorkspace } from '../../../../storage/localStorage/lastUsedWorkspace';
import { SessionOpenSettings, DEFAULT_SESSION_SETTINGS } from './sessionSettings';

export interface UseSessionEditorParams {
  sessionId?: string;
  initialDraftKey?: string;
  initialDraftUrls?: LinkItem[];
  sessionOpenSettings?: SessionOpenSettings;
}

const areLinkItemsEqual = (a: LinkItem[], b: LinkItem[]) => {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.url === b[i].url && (item.title || item.name) === (b[i].title || b[i].name) && item.id === b[i].id);
};

const areStringArraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every(item => setB.has(item));
};

export function useSessionEditor(props: UseSessionEditorParams) {
  const { sessionId, initialDraftKey, initialDraftUrls } = props;

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const lastSavedTitleRef = useRef<string>(initialDraftKey || '');
  const lastSavedUrlsRef = useRef<LinkItem[]>(initialDraftUrls || []);
  const lastSavedWorkspaceIdRef = useRef<string | null>(null);
  const lastSavedFolderIdRef = useRef<string | null>(null);
  const lastSavedTagIdsRef = useRef<string[]>([]);
  const lastSavedSettingsRef = useRef<SessionOpenSettings>(DEFAULT_SESSION_SETTINGS);
  const lastSavedUpdatedAtRef = useRef<number | null>(null);

  const activeSessionIdRef = useRef<string | null>(sessionId ?? null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionId ?? null);

  const [sessionTitle, setSessionTitle] = useState<string>(initialDraftKey || '');
  const [sessionUrls, setSessionUrls] = useState<LinkItem[]>(initialDraftUrls || []);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [openSettings, setOpenSettings] = useState<SessionOpenSettings>(DEFAULT_SESSION_SETTINGS);
  const [isInitialized, setIsInitialized] = useState<boolean>(!sessionId);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isSessionDeleted, setIsSessionDeleted] = useState(false);

  const saveAgainRef = useRef(false);
  const savePromiseRef = useRef<Promise<string | false> | null>(null);

  const currentInputsRef = useRef({ sessionTitle, sessionUrls, workspaceId, folderId, tagIds, openSettings, isInitialized });
  currentInputsRef.current = { sessionTitle, sessionUrls, workspaceId, folderId, tagIds, openSettings, isInitialized };

  // Load or initialize
  useEffect(() => {
    if (sessionId) {
      activeSessionIdRef.current = sessionId;
      setActiveSessionId(sessionId);
      setIsSessionDeleted(false);
      
      if (!isInitialized && (initialDraftKey || (initialDraftUrls && initialDraftUrls.length > 0))) {
        setSessionTitle(initialDraftKey || '');
        setSessionUrls(initialDraftUrls || []);
        lastSavedTitleRef.current = initialDraftKey || '';
        lastSavedUrlsRef.current = initialDraftUrls || [];
        setIsInitialized(true);
      } else {
        setIsInitialized(false);
      }
      return;
    }

    activeSessionIdRef.current = null;
    setActiveSessionId(null);
    setSessionTitle(initialDraftKey || '');
    setSessionUrls(initialDraftUrls || []);
    setOpenSettings(DEFAULT_SESSION_SETTINGS);

    const initDefaults = async () => {
      const smartWs = await getSmartDefaultWorkspace();
      if (smartWs) {
        setWorkspaceId(smartWs.id);
        lastSavedWorkspaceIdRef.current = smartWs.id;
        const savedFolderId = localStorage.getItem('lastUsedFolderId');
        setFolderId(savedFolderId || null);
        lastSavedFolderIdRef.current = savedFolderId || null;
      } else {
        setWorkspaceId(null);
        lastSavedWorkspaceIdRef.current = null;
        setFolderId(null);
        lastSavedFolderIdRef.current = null;
      }
    };
    void initDefaults();

    setTagIds([]);
    lastSavedTitleRef.current = initialDraftKey || '';
    lastSavedUrlsRef.current = initialDraftUrls || [];
    lastSavedWorkspaceIdRef.current = null;
    lastSavedFolderIdRef.current = null;
    lastSavedTagIdsRef.current = [];
    lastSavedSettingsRef.current = DEFAULT_SESSION_SETTINGS;
    lastSavedUpdatedAtRef.current = null;
    setSaveStatus('idle');
    setIsSessionDeleted(false);
    setIsInitialized(true);
  }, [sessionId, initialDraftKey, initialDraftUrls]);

  // Sync state reactively with Zustand store
  const liveSession = useDbStore(state => state.sessions.find(s => s.id === activeSessionId));

  useEffect(() => {
    if (!liveSession || isSessionDeleted) return;

    // Load live session state into the editor if we haven't initialized or if someone else edited it
    const isOutdated = lastSavedUpdatedAtRef.current !== liveSession.updatedAt;
    if (!isInitialized || isOutdated) {
      setSessionTitle(liveSession.title);
      setSessionUrls(liveSession.urls || []);
      setWorkspaceId(liveSession.workspaceId);
      setFolderId(liveSession.folderId);
      setTagIds(liveSession.tagIds || []);
      setOpenSettings(liveSession.sessionOpenSettings || DEFAULT_SESSION_SETTINGS);

      lastSavedTitleRef.current = liveSession.title;
      lastSavedUrlsRef.current = liveSession.urls || [];
      lastSavedWorkspaceIdRef.current = liveSession.workspaceId;
      lastSavedFolderIdRef.current = liveSession.folderId;
      lastSavedTagIdsRef.current = liveSession.tagIds || [];
      lastSavedSettingsRef.current = liveSession.sessionOpenSettings || DEFAULT_SESSION_SETTINGS;
      lastSavedUpdatedAtRef.current = liveSession.updatedAt;

      setIsInitialized(true);
      setSaveStatus('saved');
      setLastSavedAt(new Date(liveSession.updatedAt));
    }
  }, [liveSession, isInitialized, isSessionDeleted]);

  const isDirty = useMemo(() => {
    const titleChanged = sessionTitle !== lastSavedTitleRef.current;
    const workspaceChanged = workspaceId !== lastSavedWorkspaceIdRef.current;
    const folderChanged = folderId !== lastSavedFolderIdRef.current;
    const urlsChanged = !areLinkItemsEqual(sessionUrls, lastSavedUrlsRef.current);
    const tagsChanged = !areStringArraysEqual(tagIds, lastSavedTagIdsRef.current);
    const settingsChanged = JSON.stringify(openSettings) !== JSON.stringify(lastSavedSettingsRef.current);

    return titleChanged || workspaceChanged || folderChanged || urlsChanged || tagsChanged || settingsChanged;
  }, [sessionTitle, workspaceId, folderId, sessionUrls, tagIds, openSettings]);

  const handleSave = useCallback(async function saveFn(
    isAutoSave: boolean = false,
    overrideProps?: {
      workspaceId?: string | null;
      folderId?: string | null;
      tagIds?: string[];
      openSettings?: SessionOpenSettings;
      title?: string;
      urls?: any[];
    }
  ): Promise<string | false> {
    if (savePromiseRef.current) {
      saveAgainRef.current = true;
      return savePromiseRef.current as Promise<any>;
    }

    const { sessionTitle: title, sessionUrls: urls, workspaceId: wsId, folderId: fldId, tagIds: tIds, openSettings: settings } = currentInputsRef.current;
    const finalWorkspaceId = overrideProps?.workspaceId !== undefined ? overrideProps.workspaceId : wsId;
    const finalFolderId = overrideProps?.folderId !== undefined ? overrideProps.folderId : fldId;
    const finalTagIds = overrideProps?.tagIds !== undefined ? overrideProps.tagIds : tIds;
    const finalSettings = overrideProps?.openSettings !== undefined ? overrideProps.openSettings : settings;
    const finalTitle = overrideProps?.title !== undefined ? overrideProps.title : title;
    const finalUrls = overrideProps?.urls !== undefined ? overrideProps.urls : urls;

    setSaveStatus('saving');

    const execute = async (): Promise<string | false> => {
      try {
        if (!activeSessionIdRef.current) {
          // Create new
          const input: CreateSessionInput = {
            title: finalTitle,
            urls: finalUrls,
            workspaceId: finalWorkspaceId || undefined,
            folderId: finalFolderId,
            tagIds: finalTagIds,
            sessionOpenSettings: finalSettings,
          };
          const created = await createSession(input);
          if (isMounted.current) {
            activeSessionIdRef.current = created.id;
            setActiveSessionId(created.id);
            setSessionTitle(created.title);
            setSessionUrls(created.urls);
            setWorkspaceId(created.workspaceId);
            setFolderId(created.folderId);
            setTagIds(created.tagIds);
            setOpenSettings(created.sessionOpenSettings || DEFAULT_SESSION_SETTINGS);

            lastSavedTitleRef.current = created.title;
            lastSavedUrlsRef.current = created.urls;
            lastSavedWorkspaceIdRef.current = created.workspaceId;
            lastSavedFolderIdRef.current = created.folderId;
            lastSavedTagIdsRef.current = created.tagIds;
            lastSavedSettingsRef.current = created.sessionOpenSettings || DEFAULT_SESSION_SETTINGS;
            lastSavedUpdatedAtRef.current = created.updatedAt;
            setSaveStatus('saved');
            setLastSavedAt(new Date(created.updatedAt));
          }
        } else {
          // Update existing
          const input: UpdateSessionInput = {
            title: finalTitle,
            urls: finalUrls,
            workspaceId: finalWorkspaceId || undefined,
            folderId: finalFolderId,
            tagIds: finalTagIds,
            sessionOpenSettings: finalSettings,
            expectedUpdatedAt: lastSavedUpdatedAtRef.current || undefined,
          };
          const updated = await updateSession(activeSessionIdRef.current, input);
          if (isMounted.current) {
            setSessionTitle(updated.title);
            setSessionUrls(updated.urls);
            setWorkspaceId(updated.workspaceId);
            setFolderId(updated.folderId);
            setTagIds(updated.tagIds);
            setOpenSettings(updated.sessionOpenSettings || DEFAULT_SESSION_SETTINGS);

            lastSavedTitleRef.current = updated.title;
            lastSavedUrlsRef.current = updated.urls;
            lastSavedWorkspaceIdRef.current = updated.workspaceId;
            lastSavedFolderIdRef.current = updated.folderId;
            lastSavedTagIdsRef.current = updated.tagIds;
            lastSavedSettingsRef.current = updated.sessionOpenSettings || DEFAULT_SESSION_SETTINGS;
            lastSavedUpdatedAtRef.current = updated.updatedAt;
            setSaveStatus('saved');
            setLastSavedAt(new Date(updated.updatedAt));
          }
        }
        return activeSessionIdRef.current || false;
      } catch (err: any) {
        console.error('[SessionFlow][useSessionEditor] ✘ save FAILED:', err);
        if (isMounted.current) {
          setSaveStatus('error');
          setSaveError(err.message || 'Unknown save error');
        }
        return false;
      } finally {
        savePromiseRef.current = null;
        if (saveAgainRef.current && isMounted.current) {
          saveAgainRef.current = false;
          void saveFn(isAutoSave, overrideProps);
        }
      }
    };

    savePromiseRef.current = execute() as Promise<string | false>;
    return savePromiseRef.current;
  }, []);

  const handleDelete = useCallback(async () => {
    if (!activeSessionIdRef.current) return;
    try {
      await deleteSession(activeSessionIdRef.current);
      setIsSessionDeleted(true);
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }, []);

  return {
    sessionTitle,
    setSessionTitle,
    sessionUrls,
    setSessionUrls,
    workspaceId,
    setWorkspaceId,
    folderId,
    setFolderId,
    tagIds,
    setTagIds,
    openSettings,
    setOpenSettings,
    saveStatus,
    saveError,
    lastSavedAt,
    isDirty,
    handleSave,
    handleDelete,
    isInitialized,
    activeSessionId,
  };
}
