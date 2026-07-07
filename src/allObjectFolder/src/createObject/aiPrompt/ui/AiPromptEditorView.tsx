/**
 * @file AiPromptEditorView.tsx
 * @description The main user interface component for creating and editing AI prompts.
 * Renders the editor container, the title input field, a TextEditor component, a status bar indicating save state,
 * and a side-panel for choosing or generating AI model destination URLs.
 * 
 * @usage
 * ```tsx
 * import { AiPromptEditorView } from './ui/AiPromptEditorView';
 * <AiPromptEditorView aiPromptId={id} onBack={handleBack} />
 * ```
 */

import React, { useRef, useEffect, useState } from 'react';

import { useSelector } from 'react-redux';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { EditorContainer } from '../../../../../shared-components/editorContainer/EditorContainer';
import { createAiPrompt, getAiPrompt, updateAiPrompt } from '../aiPromptData';
import { StorageManager } from '../../../../../storage/localStorage/storageManager';
import { useAiPromptEditor } from '../useAiPromptEditor';
import TextEditor from '../../../../../shared-components/TextEditor';
import { useAppearance } from '@extension/ui';
import { FaTimes, FaCheckCircle, FaExternalLinkAlt, FaSpinner, FaPencilAlt, FaChevronDown, FaCog, FaAsterisk } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { getFaviconUrl } from '../../../../../pages/AltS_search_newtab/src/components/searchSystemComponents/searchBarMain/utilityFunctions/utils';
import { AutoSaveIndicator } from '../../../../../shared-components/autoSaveEngine/autoSave';

interface ModelOption {
  id: string;
  name: string;
  host: string;
}

const MODELS: ModelOption[] = [
  { id: 'gpt', name: 'ChatGPT', host: 'chatgpt.com' },
  { id: 'claude', name: 'Claude', host: 'claude.ai' },
  { id: 'gemini', name: 'Gemini', host: 'gemini.google.com' },
  { id: 'perplexity', name: 'Perplexity', host: 'perplexity.ai' },
];

export interface AiPromptEditorViewProps {
  aiPromptId?: string | null;
  onBack?: () => void;
  initialTitle?: string;
  initialPrompt?: string;
  isFullScreenMode?: boolean;
}

export function AiPromptEditorView(props: AiPromptEditorViewProps) {
  const { isFullScreenMode = false } = props;
  const state = useAiPromptEditor(props);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useAppearance();
  const isDark = theme.isDark;
  const toolbarIdRef = React.useRef(`prompt-toolbar-${Math.random().toString(36).slice(2, 10)}`);
  const toolbarSelector = `#${toolbarIdRef.current}`;


  const [excludedModels, setExcludedModels] = useState<string[]>([]);

  useEffect(() => {
    StorageManager.getItem('aiPrompt_excludedModels').then((stored: any) => {
      if (stored) {
        try {
          setExcludedModels(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
    });
  }, []);

  const toggleModelExclusion = (modelId: string) => {
    setExcludedModels(prev => {
      const next = prev.includes(modelId) ? prev.filter(id => id !== modelId) : [...prev, modelId];
      void StorageManager.setItem('aiPrompt_excludedModels', JSON.stringify(next));
      return next;
    });
  };





  const isFocusMode = useUIStore((s: any) => s.isFocusMode);
  const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';



  // Auto-save when URL is received (keep editor open, user closes manually)
  useEffect(() => {
    if (state.generatedUrl && !state.isGenerating && state.saveStatus !== 'saving' && state.saveStatus !== 'saved') {
      state.handleSave();
    }
  }, [state.generatedUrl, state.isGenerating, state.saveStatus]);

  const canGenerate = state.promptBody.trim().length > 0 && !state.isGenerating;

  return (
    <EditorContainer
      ref={containerRef}
      style={{ minHeight: '450px', height: '100%' }}
      innerStyle={{ minHeight: '450px', height: '100%' }}
      className={`w-full h-full flex flex-col items-center justify-center gap-1 text-left text-neutral-900 dark:text-white bg-transparent ${isFullScreenMode || isEmbedded ? '' : 'px-4 md:px-8 lg:px-12 py-6 md:py-10'}`}
      innerClassName={`flex flex-col relative overflow-visible ${isFullScreenMode ? 'w-full flex-1 flex-shrink-0 rounded-none' : 'w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto rounded-xl h-[80vh] min-h-[400px] -translate-x-6'} bg-[var(--color-editorBg)] ${isFocusMode || isFullScreenMode ? 'border-none' : 'border border-black/5 dark:border-white/10'}`}>
      <div className="flex-1 min-h-0 flex overflow-visible flex-col bg-transparent text-neutral-900 dark:text-white">
        <div className="flex-1 flex min-h-0 relative">
          {isFullScreenMode && <div className="h-20 flex-shrink-0" />}

          <div className="flex-1 flex flex-col min-h-0 relative">
            {/* Header Status & Close Button */}
            <div className="absolute top-4 right-4 md:top-5 md:right-5 z-50 flex items-center gap-3">
              <div className="transition-opacity duration-300 flex items-center gap-2">
                {state.isGenerating && (
                  <span className="text-sm font-medium text-blue-500 dark:text-blue-400 flex items-center gap-1.5 whitespace-nowrap">
                    <FaSpinner className="animate-spin" size={12} /> Generating...
                  </span>
                )}
                {state.generationError && (
                  <span className="text-sm font-medium text-red-500 dark:text-red-400 flex items-center gap-1 whitespace-nowrap">
                    {state.generationError}
                  </span>
                )}
                <AutoSaveIndicator
                  saveStatus={state.saveStatus}
                  lastSavedAt={state.lastSavedAt}
                />
                {state.generatedUrl && !state.isGenerating && (
                  <span className="text-sm font-medium text-emerald-500 flex items-center gap-1 whitespace-nowrap">
                    Link Generated! <FaExternalLinkAlt size={10} />
                  </span>
                )}
              </div>
              <button
                onClick={state.handleClose}
                disabled={state.isGenerating}
                className="p-2 opacity-50 hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-all focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-30"
                title="Close">
                <FaTimes size={16} />
              </button>
            </div>

            {/* Title & Editor */}
            <div className="w-full flex-1 flex flex-col min-h-0 pl-6 md:pl-8 pr-6 md:pr-8 pt-6 pb-4">
              {/* Title Input */}
              <div className={`flex flex-col relative z-10 ${isFullScreenMode ? 'pt-4 pr-6' : 'pt-2'} gap-1.5`}>
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 px-2 flex items-center gap-1">
                  Title <span className="text-red-500">*</span>
                </h4>
                <div className="flex-1 relative rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] overflow-hidden px-4 py-2.5">
                  <input
                    ref={state.titleInputRef}
                    value={state.promptTitle}
                    onChange={e => state.setPromptTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        const editorEl = containerRef.current?.querySelector('[contenteditable]');
                        (editorEl as HTMLElement)?.focus();
                      }
                    }}
                    type="text"
                    placeholder="Task title..."
                    className="w-full text-sm font-medium text-black dark:text-white placeholder-[var(--color-textPlaceholder)]/70 bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0"
                  />
                </div>
              </div>

                {/* Prompt Editor Area */}
                <div className={`flex-1 min-h-0 font-sans text-sm font-medium flex flex-col text-neutral-900 dark:text-white ${isFullScreenMode ? 'pl-8 pr-6 pt-4' : 'pt-2 pb-2'} gap-4`}>
                  
                  {/* Prompt */}
                  <div className="flex-1 min-h-[120px] relative flex flex-col gap-1.5">
                    <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 px-2 flex items-center gap-1">
                      Prompt <span className="text-red-500">*</span>
                    </h4>
                    <div className="flex-1 relative rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] overflow-hidden">
                      <TextEditor
                        value={state.promptBody}
                        onChange={state.setPromptBody}
                        placeholder="Elaborate your prompt"
                        readOnly={false}
                        onUpArrowAtStart={() => state.titleInputRef.current?.focus()}
                        showToolbar={true}
                        toolbarSelector={toolbarSelector}
                        isFocusMode={isFullScreenMode}
                      />
                    </div>
                  </div>

                </div>
            </div>
          </div>

          {/* Right Side Panel - Model Table */}
          <div className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 select-none rounded-xl border overflow-hidden ${isDark ? 'border-white/10 bg-[#0a0a0a]' : 'border-[#d8d2bf] bg-white'} w-[300px]`}>
            <div className="flex flex-col">
              {/* Header */}
              <div className={`grid grid-cols-[50px_90px_1fr] items-stretch border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-[#d8d2bf] bg-[#eee8d5]/50'}`}>
                <div className={`flex items-center justify-center py-2 border-r ${isDark ? 'border-white/10' : 'border-[#d8d2bf]/50'}`}>
                  <h3 className={`text-[10px] font-semibold ${isDark ? 'text-white/50' : 'text-[#586e75]'}`}>Enabled</h3>
                </div>
                <div className={`flex items-center py-2 px-3 border-r ${isDark ? 'border-white/10' : 'border-[#d8d2bf]/50'}`}>
                  <h3 className={`text-[10px] font-semibold ${isDark ? 'text-white/50' : 'text-[#586e75]'}`}>Model</h3>
                </div>
                <div className="flex items-center py-2 px-3">
                  <h3 className={`text-[10px] font-semibold ${isDark ? 'text-white/50' : 'text-[#586e75]'}`}>Link</h3>
                </div>
              </div>
              
              <div className="flex flex-col">
                {MODELS.map((model, idx) => {
                  const isEnabled = !excludedModels.includes(model.id);
                  return (
                    <div
                      key={model.id}
                      className={`grid grid-cols-[50px_90px_1fr] items-stretch transition-all ${idx < MODELS.length - 1 ? (isDark ? 'border-b border-white/5' : 'border-b border-[#d8d2bf]/40') : ''} ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-[#eee8d5]/30'}`}>
                      
                      {/* Enabled Checkbox */}
                      <div className={`flex items-center justify-center py-2 border-r ${isDark ? 'border-white/10' : 'border-[#d8d2bf]/40'}`}>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => toggleModelExclusion(model.id)}
                          className={`w-3.5 h-3.5 cursor-pointer rounded accent-blue-500`}
                        />
                      </div>
                      
                      {/* Model Info */}
                      <div className={`flex items-center gap-1.5 px-2 py-2 border-r ${isDark ? 'border-white/10' : 'border-[#d8d2bf]/40'}`}>
                        <img
                          src={getFaviconUrl(model.host)}
                          alt={model.name}
                          className="w-3.5 h-3.5 object-contain rounded-full shrink-0"
                        />
                        <span className={`text-[10px] font-semibold truncate ${isDark ? 'text-white/90' : 'text-[#073642]'}`}>
                          {model.name}
                        </span>
                      </div>
                      
                      {/* Link Input */}
                      <div className="flex items-center w-full px-2 py-1.5">
                        <input
                          id={`custom-link-input-${model.id}`}
                          value={state.modelUrls[model.id] ?? `https://${model.host}`}
                          onChange={e => state.setModelUrl(model.id, e.target.value)}
                          className={`w-full text-[10px] bg-transparent border rounded-md px-1.5 py-1 outline-none transition-colors ${isDark ? 'text-white/70 border-white/10 hover:border-white/20 focus:border-white/30 bg-black/20' : 'text-[#586e75] border-[#d8d2bf]/50 hover:border-[#d8d2bf] focus:border-[#b8a88e] bg-white/50'}`}
                          placeholder="Enter URL..."
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-50 mt-auto flex-shrink-0 border-t border-black/10 dark:border-white/10 bg-[var(--color-editorBg)] rounded-b-xl">
        <div className="relative flex items-center justify-between px-6 py-2 text-[10px] font-medium text-neutral-500 dark:text-neutral-400 flex-shrink-0">
          <button
            type="button"
            onClick={state.handleClose}
            disabled={state.isGenerating}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30">
            <span className="text-neutral-600 dark:text-neutral-300">Back</span>
            <span className="flex items-center rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-1 py-0 text-[9px] font-semibold text-neutral-500 dark:text-neutral-300">Esc</span>
          </button>
          {/* Keep the empty toolbar div here so TextEditor can mount its toolbar silently without disrupting layout, but hide it if not needed or just keep it invisible */}
          <div id={toolbarIdRef.current} className="hidden" />
        </div>
      </div>
    </EditorContainer>
  );
}
