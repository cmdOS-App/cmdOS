/**
 * @file useAiPromptEditor.ts
 * @description A custom React hook containing state management and logic for the AI Prompt editor.
 * It manages prompt title, prompt body/content, active model selection, tag associations, folder/workspace syncing,
 * debounced autosaving, sessionStorage-based drafts for new prompts, and interaction with background script
 * for auto-submitting prompts to target AI model interfaces.
 * 
 * @usage
 * ```tsx
 * import { useAiPromptEditor } from './useAiPromptEditor';
 * const state = useAiPromptEditor({ aiPromptId: 'some-id' });
 * ```
 */

import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';

import { createAiPrompt, updateAiPrompt } from './aiPromptData';
import type { AiPromptRecord, CreateAiPromptInput, UpdateAiPromptInput } from './aiPromptTypes';
import { useAiPrompt } from './aiPromptHooks';
import { getSmartDefaultWorkspace } from '../../../../storage/localStorage/lastUsedWorkspace';
import { StorageManager } from '../../../../storage/localStorage/storageManager';

export interface AiPromptEditorProps {
  aiPromptId?: string | null;
  onBack?: () => void;
  initialTitle?: string;
  initialPrompt?: string;
}

const DRAFT_KEY = 'aiPrompt_draft';
let draftCache: { promptTitle: string; promptBody: string; promptRules: string; modelUrls: Record<string, string> } | null = null;

function saveDraft(title: string, body: string, rules: string, urls: Record<string, string>) {
  draftCache = { promptTitle: title, promptBody: body, promptRules: rules, modelUrls: urls };
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draftCache));
  } catch { /* quota exceeded */ }
}

function loadDraft(): { promptTitle?: string; promptBody?: string; promptRules?: string; modelUrls?: Record<string, string> } | null {
  if (draftCache) return draftCache;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearDraft() {
  draftCache = null;
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export function useAiPromptEditor(props: AiPromptEditorProps) {
  const { aiPromptId, onBack, initialTitle, initialPrompt } = props;

  const [activeAiPromptId, setActiveAiPromptId] = useState<string | null>(aiPromptId ?? null);
  const activeAiPromptIdRef = useRef<string | null>(aiPromptId ?? null);

  const [promptTitle, setPromptTitle] = useState<string>(initialTitle || '');
  const [promptBody, setPromptBody] = useState<string>(initialPrompt || '');
  const [promptRules, setPromptRules] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState<boolean>(!aiPromptId);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const [modelUrls, setModelUrls] = useState<Record<string, string>>({
    gpt: 'https://chatgpt.com',
    claude: 'https://claude.ai/new',
    gemini: 'https://gemini.google.com/app',
    perplexity: 'https://www.perplexity.ai',
  });

  const setModelUrl = useCallback((modelId: string, url: string) => {
    setModelUrls(prev => ({ ...prev, [modelId]: url }));
  }, []);

  const generatingModelRef = useRef<string | null>(null);
  const isGeneratingRef = useRef(false);

  const lastSavedTitleRef = useRef<string>(initialTitle || '');
  const lastSavedPromptRef = useRef<string>(initialPrompt || '');
  const lastSavedRulesRef = useRef<string>('');
  const lastSavedModelUrlsRef = useRef<Record<string, string>>({});
  const lastSavedWorkspaceIdRef = useRef<string | null>(null);
  const lastSavedFolderIdRef = useRef<string | null>(null);
  const lastSavedTagIdsRef = useRef<string[]>([]);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize defaults for new prompt
  useEffect(() => {
    if (aiPromptId) {
      clearDraft();
      activeAiPromptIdRef.current = aiPromptId;
      setActiveAiPromptId(aiPromptId);
      setIsInitialized(false);
      return;
    }

    activeAiPromptIdRef.current = null;
    setActiveAiPromptId(null);
    setPromptTitle(initialTitle || '');
    setPromptBody(initialPrompt || '');
    setPromptRules('');
    setSelectedModel(null);

    const initDefaults = async () => {
      const smartWs = await getSmartDefaultWorkspace();
      if (smartWs) {
        setWorkspaceId(smartWs.id);
        const savedFolderId = await StorageManager.getItem('lastUsedFolderId');
        setFolderId(savedFolderId || null);
      } else {
        setWorkspaceId(null);
        setFolderId(null);
      }
    };
    void initDefaults();

    setTagIds([]);
    lastSavedTitleRef.current = initialTitle || '';
    lastSavedPromptRef.current = initialPrompt || '';
    lastSavedRulesRef.current = '';
    lastSavedModelUrlsRef.current = {};
    lastSavedWorkspaceIdRef.current = null;
    lastSavedFolderIdRef.current = null;
    lastSavedTagIdsRef.current = [];
    setSaveStatus('idle');
    setIsInitialized(true);

    // Restore previous draft from sessionStorage if available
    const draft = loadDraft();
    if (draft) {
      if (draft.promptTitle) setPromptTitle(draft.promptTitle);
      if (draft.promptBody) setPromptBody(draft.promptBody);
      if (draft.promptRules) setPromptRules(draft.promptRules);
      if (draft.modelUrls) setModelUrls(draft.modelUrls);
    }
  }, [aiPromptId, initialTitle, initialPrompt]);

  // Load existing record
  const liveAiPrompt = useAiPrompt(activeAiPromptId);

  const isDirty = useMemo(() => {
    if (!isInitialized) return false;
    const titleChanged = promptTitle !== lastSavedTitleRef.current;
    const promptChanged = promptBody !== lastSavedPromptRef.current;
    const rulesChanged = promptRules !== lastSavedRulesRef.current;
    const modelUrlsChanged = JSON.stringify(modelUrls) !== JSON.stringify(lastSavedModelUrlsRef.current);
    const workspaceChanged = workspaceId !== lastSavedWorkspaceIdRef.current;
    const folderChanged = folderId !== lastSavedFolderIdRef.current;
    const tagsChanged = [...tagIds].sort().join(',') !== [...lastSavedTagIdsRef.current].sort().join(',');

    return titleChanged || promptChanged || rulesChanged || modelUrlsChanged || workspaceChanged || folderChanged || tagsChanged;
  }, [promptTitle, promptBody, promptRules, modelUrls, workspaceId, folderId, tagIds, isInitialized]);

  useEffect(() => {
    if (!liveAiPrompt) return;

    if (!isInitialized || !isDirty) {
      setPromptTitle(liveAiPrompt.title);
      setPromptBody(liveAiPrompt.prompt);
      setPromptRules(liveAiPrompt.rules || '');
      if (liveAiPrompt.modelUrls) {
        setModelUrls(liveAiPrompt.modelUrls);
      }
      setWorkspaceId(liveAiPrompt.workspaceId);
      setFolderId(liveAiPrompt.folderId);
      setTagIds(liveAiPrompt.tagIds);

      lastSavedTitleRef.current = liveAiPrompt.title;
      lastSavedPromptRef.current = liveAiPrompt.prompt;
      lastSavedRulesRef.current = liveAiPrompt.rules || '';
      lastSavedModelUrlsRef.current = liveAiPrompt.modelUrls || {};
      lastSavedWorkspaceIdRef.current = liveAiPrompt.workspaceId;
      lastSavedFolderIdRef.current = liveAiPrompt.folderId;
      lastSavedTagIdsRef.current = liveAiPrompt.tagIds;

      setLastSavedAt(new Date(liveAiPrompt.updatedAt));
      setSaveStatus('saved');
      setIsInitialized(true);
    }
  }, [liveAiPrompt, isDirty, isInitialized]);

  // Sync refs with state
  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  // Auto-save draft for new prompts — useLayoutEffect fires synchronously before unmount
  // The module-level draftCache also survives component remounts within the same page
  useLayoutEffect(() => {
    if (!aiPromptId) {
      saveDraft(promptTitle, promptBody, promptRules, modelUrls);
    }
  }, [aiPromptId, promptTitle, promptBody, promptRules, modelUrls]);

  // Listen for AI session URL updates from background
  useEffect(() => {
    const handleAiUrlUpdate = (message: any) => {
      if (message.action === 'ai_session_url_updated' && message.url) {
        const activeModel = generatingModelRef.current;
        if (activeModel && message.model === activeModel) {
          setGeneratedUrl(message.url);
          setModelUrl(activeModel, message.url);
          setGenerationError(null);
          setIsGenerating(false);
          generatingModelRef.current = null;
          // Close the AI tab after capturing the URL with a slight delay
          // This gives the AI provider time to fully create the chat on their end
          if (message.tabId) {
            setTimeout(() => {
              chrome.tabs.remove(message.tabId).catch(() => {});
            }, 2500);
          }
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleAiUrlUpdate);
    return () => chrome.runtime.onMessage.removeListener(handleAiUrlUpdate);
  }, []);

  const MODEL_KIND: Record<string, string> = {
    gpt: 'chatgpt',
    claude: 'claude',
    gemini: 'gemini',
    perplexity: 'perplexity',
  };

  const handleGenerateLink = useCallback(async (modelId: string, customPrompt?: string) => {
    const basePrompt = stripHtml(promptBody).trim();
    const rules = stripHtml(promptRules).trim();
    
    let combinedPrompt = basePrompt;
    if (rules) {
      combinedPrompt = combinedPrompt 
        ? `${combinedPrompt}\n\nInstructions:\n${rules}`
        : `Instructions:\n${rules}`;
    }
    
    const cleanPrompt = customPrompt ? customPrompt.trim() : combinedPrompt;
    
    if (!modelId || !cleanPrompt.trim()) return;

    generatingModelRef.current = modelId;
    setSelectedModel(modelId);
    setIsGenerating(true);
    isGeneratingRef.current = true;
    setGenerationError(null);
    setGeneratedUrl(null);

    try {
      const targetUrl = modelUrls[modelId] || 'https://chatgpt.com';
      const kind = MODEL_KIND[modelId] || 'chatgpt';

      // Send message to background to open tab and auto-submit
      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'open_tab_with_auto_submit',
            url: targetUrl,
            autoSubmit: { kind, prompt: cleanPrompt },
            forceNewTab: true,
            active: true,
          },
          res => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(res);
          },
        );
      });

      // Register session for URL capture
      if (response?.tabId) {
        chrome.runtime.sendMessage({
          action: 'track_ai_session',
          prompt: cleanPrompt,
          tabIds: [response.tabId],
          models: [modelId],
        });
      }

      // Set a timeout for generation
      setTimeout(() => {
        if (isGeneratingRef.current) {
          setIsGenerating(false);
          isGeneratingRef.current = false;
          generatingModelRef.current = null;
          setGenerationError('Generation timed out. The AI may not have responded.');
        }
      }, 120000); // 2 minute timeout
    } catch (err) {
      setIsGenerating(false);
      isGeneratingRef.current = false;
      generatingModelRef.current = null;
      setGenerationError('Failed to trigger AI. Please try again.');
    }
  }, [promptBody]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    const currentPromptId = activeAiPromptIdRef.current;

    if (!promptTitle.trim()) {
      return false;
    }

    if (!promptTitle.trim() && !promptBody.trim()) {
      return false;
    }


    setSaveStatus('saving');
    try {
      let savedRecord: AiPromptRecord;
      
      if (currentPromptId) {
        const input: UpdateAiPromptInput = {
          workspaceId: workspaceId || undefined,
          folderId: folderId,
          title: promptTitle || 'AI Generated Link',
          prompt: promptBody,
          rules: promptRules,
          modelUrls: modelUrls,
          tagIds: tagIds,
        };
        savedRecord = await updateAiPrompt(currentPromptId, input);
      } else {
        const input: CreateAiPromptInput = {
          workspaceId: workspaceId || undefined,
          folderId: folderId,
          title: promptTitle || 'AI Generated Link',
          prompt: promptBody,
          rules: promptRules,
          modelUrls: modelUrls,
          tagIds: tagIds,
        };
        savedRecord = await createAiPrompt(input);
      }

      activeAiPromptIdRef.current = savedRecord.id;
      setActiveAiPromptId(savedRecord.id);

      setWorkspaceId(savedRecord.workspaceId);
      setFolderId(savedRecord.folderId);
      setTagIds(savedRecord.tagIds);

      clearDraft();
      lastSavedTitleRef.current = savedRecord.title;
      lastSavedPromptRef.current = savedRecord.prompt;
      lastSavedRulesRef.current = savedRecord.rules || '';
      lastSavedModelUrlsRef.current = savedRecord.modelUrls || {};
      lastSavedWorkspaceIdRef.current = savedRecord.workspaceId;
      lastSavedFolderIdRef.current = savedRecord.folderId;
      lastSavedTagIdsRef.current = savedRecord.tagIds;

      const wId = savedRecord.workspaceId;
      const fId = savedRecord.folderId;
      if (wId) void StorageManager.setItem('lastUsedWorkspaceId', wId);
      if (fId) void StorageManager.setItem('lastUsedFolderId', fId);
      else void StorageManager.removeItem('lastUsedFolderId');

      setSaveStatus('saved');
      setLastSavedAt(new Date(savedRecord.updatedAt));
      return true;
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      return false;
    }
  }, [promptTitle, promptBody, promptRules, modelUrls, selectedModel, generatedUrl, workspaceId, folderId, tagIds]);

  const handleClose = useCallback(() => {
    if (onBack) onBack();
  }, [onBack]);

  // Autosave effect triggered by input changes
  useEffect(() => {
    if (!isDirty) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    const delay = 1000;
    autosaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, delay);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [promptTitle, promptBody, promptRules, modelUrls, workspaceId, folderId, tagIds, handleSave, isDirty]);

  return {
    promptTitle,
    promptBody,
    promptRules,
    selectedModel,
    modelUrls,
    setModelUrl,
    activeAiPromptId,
    workspaceId,
    folderId,
    tagIds,
    saveStatus,
    lastSavedAt,
    isDirty,
    isGenerating,
    generationError,
    generatedUrl,
    titleInputRef,
    setPromptTitle,
    setPromptBody,
    setPromptRules,
    setSelectedModel,
    setWorkspaceId,
    setFolderId,
    setTagIds,
    handleGenerateLink,
    handleSave,
    handleClose,
  };
}
