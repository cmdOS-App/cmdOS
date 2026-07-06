/**
 * @file useSessionManager.ts
 * @description Custom React hook managing active link-gathering sessions in extension windows/tabs,
 * including prefilling tab URLs, window change tracking, duplicate group name checking, and session lifecycle controls.
 * 
 * @usage
 * ```tsx
 * import { useLinkSessionManager } from './useSessionManager';
 * const manager = useLinkSessionManager(handleTabCaptured);
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';


/**
 * Interface representing a browser session tracked for link gathering.
 */
export interface LinkSession {
  sessionId: string;
  sessionName: string;
  windowId: number;
}

export function useLinkSessionManager(onTabCaptured?: (tab: any) => void) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string>('');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isStartingSession, setIsStartingSession] = useState<boolean>(false);
  const [prefillUrls, setPrefillUrls] = useState<{ url: string; title: string; favIconUrl: string; id: string }[]>([]);
  const capturedUrlsRef = useRef<Set<string>>(new Set());

  // Stable ref to chrome API — avoids triggering useEffect deps on every render
  const chromeRef = useRef<any>((window as any)?.chrome);
  const chromeAny = chromeRef.current;

  // Track whether the prefill check has completed (use state so window-check effect re-fires)
  const [prefillChecked, setPrefillChecked] = useState(false);

  // Load session from pending prefill if launched from context menu / background
  useEffect(() => {
    if (!chromeAny?.storage?.local) {
      setPrefillChecked(true);
      return;
    }
    chromeAny.storage.local.get('pending_session_prefill', (result: any) => {
      const prefill = result.pending_session_prefill;
      if (prefill?.sessionId) {
        setActiveSessionId(prefill.sessionId);
        // BoardView writes `title`, legacy paths may write `sessionName`
        setSessionName(prefill.title || prefill.sessionName || '');
        if (prefill.urls) {
          const urls = Array.isArray(prefill.urls) ? prefill.urls : [];
          const names = Array.isArray(prefill.names) ? prefill.names : [];
          setPrefillUrls(urls.map((u: string, i: number) => ({
            id: String(Date.now() + Math.random()),
            url: u,
            title: names[i] || u,
            favIconUrl: ''
          })));
        }
        chromeAny.storage.local.remove('pending_session_prefill');
      }
      setPrefillChecked(true);
    });
  }, []);

  // Load active session for current window — only after prefill check completes (to avoid race)
  useEffect(() => {
    if (!prefillChecked || !chromeAny?.storage?.local || !chromeAny?.windows || activeSessionId) return;

    const checkCurrentWindowSession = async () => {
      chromeAny.windows.getCurrent((currentWindow: any) => {
        chromeAny.storage.local.get('active_sessions', (result: any) => {
          const sessions: LinkSession[] = result.active_sessions || [];
          const matchedSession = sessions.find((s) => s.windowId === currentWindow.id);
          if (matchedSession) {
            setSessionName(matchedSession.sessionName);
            setActiveSessionId(matchedSession.sessionId);
          }
        });
      });
    };

    checkCurrentWindowSession();
  }, [prefillChecked, activeSessionId]);

  /**
   * Validates if a session name is duplicate
   */
  const validateSessionName = useCallback(
    (name: string, onResult: (isValid: boolean, errorMsg: string | null) => void) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        onResult(false, 'Tab group name is required');
        return;
      }

      if (!chromeAny?.storage?.local) {
        onResult(true, null);
        return;
      }

      chromeAny.storage.local.get('active_sessions', (res: any) => {
        const activeSessions: LinkSession[] = res.active_sessions || [];
        const duplicateActive = activeSessions.some(
          (s) => s.sessionName?.toLowerCase() === trimmedName.toLowerCase()
        );

        if (duplicateActive) {
          onResult(false, 'A tab group with this name is currently active.');
        } else {
          onResult(true, null);
        }
      });
    },
    []
  );


  // Listen for real-time session tab captures from the background script
  useEffect(() => {
    capturedUrlsRef.current.clear();
  }, [activeSessionId]);

  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.action === 'session_tab_captured') {
        if (activeSessionId && message.sessionId === activeSessionId) {
          const url = message.url;
          if (url && capturedUrlsRef.current.has(url)) {
            return; // Deduplicate
          }
          if (url) {
            capturedUrlsRef.current.add(url);
          }

          if (onTabCaptured) {
            onTabCaptured({
              id: String(Date.now() + Math.random()),
              name: message.title || message.url,
              url: message.url,
              source: 'tab',
              favIconUrl: message.favIconUrl || ''
            });
          }
        }
      }
    };

    if (chromeAny?.runtime?.onMessage) {
      chromeAny.runtime.onMessage.addListener(handleMessage);
      return () => chromeAny.runtime.onMessage.removeListener(handleMessage);
    }
    return () => {};
  }, [activeSessionId, onTabCaptured]);

  return {
    activeSessionId,
    setActiveSessionId,
    sessionName,
    setSessionName,
    sessionError,
    setSessionError,
    isStartingSession,
    setIsStartingSession,
    validateSessionName,
    prefillUrls,
  };
}
