import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaKeyboard,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaSearch,
  FaRobot,
  FaGlobe,
} from 'react-icons/fa';
import Branding from '../shared-components/Branding';
import { CMDOS_DOCS_URL } from '../storage/API/core/apiConfig';
import { StorageManager } from '../storage/localStorage/storageManager';

// ============================================================================
// 1. Storage & Utils
// ============================================================================

export interface TutorialProgress {
  search?: boolean;
  favorites?: boolean;
  agent?: boolean;
  sidebar?: boolean;
  touchpoints?: boolean;
}

const STORAGE_KEY = 'app_tutorial_progress';

export const getTutorialProgress = async (): Promise<TutorialProgress> => {
  try {
    const result = await StorageManager.getItem(STORAGE_KEY);
    return result || {};
  } catch (error) {
    console.error('Failed to get tutorial progress:', error);
    return {};
  }
};

export const setTutorialStepFinished = async (step: keyof TutorialProgress) => {
  if ((window as any).isReplayingTutorial) {
    return;
  }
  try {
    const progress = await getTutorialProgress();
    progress[step] = true;
    await StorageManager.setItem(STORAGE_KEY, progress);
  } catch (error) {
    console.error('Failed to save tutorial progress:', error);
  }
};

export const clearTutorialStep = async (step: keyof TutorialProgress) => {
  try {
    const progress = await getTutorialProgress();
    progress[step] = false;
    await StorageManager.setItem(STORAGE_KEY, progress);
  } catch (error) {
    console.error('Failed to clear tutorial step:', error);
  }
};

export const migrateTutorialProgress = async (): Promise<boolean> => {
  // Migration logic removed as per user request to solely rely on extension local storage.
  return false;
};

export const resetTutorialProgress = async () => {
  try {
    await StorageManager.removeItem([STORAGE_KEY, 'tutorial_watched']);
  } catch (error) {
    console.error('Failed to reset tutorial progress:', error);
  }
};

// ============================================================================
// 2. TutorialCard Component
// ============================================================================

interface TutorialCardProps {
  onClose: () => void;
  onNext?: () => void;
  isVisible: boolean;
  stepIndex?: number;
  totalSteps?: number;
  title?: string;
  features?: { title: string; desc: string; icon?: React.ReactNode }[];
  direction?: 'top' | 'right' | 'left' | 'bottom' | 'none';
  width?: string;
  className?: string;
  type?: 'search' | 'favorites' | 'agent' | 'sidebar' | 'touchpoints' | 'sheet_search' | 'sheet_add' | 'sheet_filter' | 'board_view' | 'list_view' | 'sheet_ui';
  demoText?: string;
  description?: string;
  featuresTitle?: string;
  features2?: { title: string; desc: string; icon?: React.ReactNode }[];
  featuresTitle2?: string;
  footer?: string;
  extraContent?: React.ReactNode;
  isLoggedIn?: boolean;
  hideNavigation?: boolean;
  arrowTopClass?: string;
}

export const TutorialCard: React.FC<TutorialCardProps> = ({
  onClose,
  onNext,
  isVisible,
  stepIndex = 0,
  totalSteps = 1,
  title = 'Tutorial',
  features = [],
  direction = 'top',
  className = '',
  type = 'search',
  demoText = 'youtube.com',
  description,
  featuresTitle,
  features2 = [],
  featuresTitle2,
  footer,
  width: customWidth,
  extraContent,
  isLoggedIn,
  hideNavigation = false,
  arrowTopClass,
}) => {
  const [displayText, setDisplayText] = useState('');
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    let timer: NodeJS.Timeout;
    if (step === 0) {
      if (displayText.length < demoText.length) {
        timer = setTimeout(() => {
          setDisplayText(demoText.slice(0, displayText.length + 1));
        }, 100);
      } else {
        timer = setTimeout(() => setStep(1), 1000);
      }
    } else if (step === 1) {
      timer = setTimeout(() => {
        setStep(2);
      }, 2500);
    } else {
      timer = setTimeout(() => {
        setDisplayText('');
        setStep(0);
      }, 1200);
    }

    return () => clearTimeout(timer);
  }, [displayText, step, isVisible, demoText]);

  const isLast = stepIndex === totalSteps - 1;

  const triangleStyles = {
    top: 'top-0 left-1/2 -translate-x-1/2 -translate-y-full pb-[1px]',
    right: `${arrowTopClass || 'top-6'} right-0 translate-x-full pl-[1px]`,
    left: `${arrowTopClass || 'top-6'} left-0 -translate-x-full pr-[1px]`,
    bottom: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full pt-[1px]',
    none: '',
  };

  const triangleCores = {
    top: 'border-b-[var(--color-borderDefault)] border-x-transparent border-t-transparent border-b-6 border-x-6',
    right: 'border-l-[var(--color-borderDefault)] border-y-transparent border-r-transparent border-l-6 border-y-6',
    left: 'border-r-[var(--color-borderDefault)] border-y-transparent border-l-transparent border-r-6 border-y-6',
    bottom: 'border-t-[var(--color-borderDefault)] border-x-transparent border-b-transparent border-t-6 border-x-6',
    none: '',
  };

  const widthClass = customWidth || 'w-[400px]';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`absolute z-[9999] ${widthClass} bg-[var(--color-tutorialCardBg)] border border-[var(--color-borderDefault)] rounded-xl flex flex-col overflow-visible select-none font-sans text-left ${className}`}
        >
          {/* Small clean border pointer triangle */}
          {direction !== 'none' && (
            <div className={`absolute ${triangleStyles[direction]} w-0 h-0 flex items-center justify-center`}>
              <div className={`w-0 h-0 ${triangleCores[direction]}`} />
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--color-borderDefault)]">
            <h3 className="text-white text-sm font-semibold tracking-tight leading-none">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              <FaTimes size={12} />
            </button>
          </div>

          {/* Scrollable Content Container */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 max-h-[350px] scrollbar-thin scrollbar-thumb-white/10">
            {description && (
              <p className="text-neutral-300 text-xs font-medium leading-relaxed">{description}</p>
            )}

            {/* Feature lists */}
            {features.length > 0 && (
              <div className="space-y-3">
                {featuresTitle && (
                  <h4 className="text-[10px] font-bold text-neutral-400 tracking-wider uppercase">{featuresTitle}</h4>
                )}
                <div className="space-y-2.5">
                  {features.map((f, i) => (
                    <div key={i} className="flex gap-3">
                      {f.icon && <div className="text-neutral-400 shrink-0 mt-0.5">{f.icon}</div>}
                      <div className="space-y-0.5">
                        <h5 className="text-white text-xs font-semibold leading-normal">{f.title}</h5>
                        <p className="text-neutral-400 text-[11px] font-medium leading-normal">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {features2.length > 0 && (
              <div className="space-y-3 pt-1">
                {featuresTitle2 && (
                  <h4 className="text-[10px] font-bold text-neutral-400 tracking-wider uppercase">{featuresTitle2}</h4>
                )}
                <div className="space-y-2.5">
                  {features2.map((f, i) => (
                    <div key={i} className="flex gap-3">
                      {f.icon && <div className="text-neutral-400 shrink-0 mt-0.5">{f.icon}</div>}
                      <div className="space-y-0.5">
                        <h5 className="text-white text-xs font-semibold leading-normal">{f.title}</h5>
                        <p className="text-neutral-400 text-[11px] font-medium leading-normal">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {extraContent && <div className="pt-1">{extraContent}</div>}

            {/* Interactive Demo View inside tutorial card */}
            {type === 'search' && (
              <div className="bg-black/50 border border-white/5 rounded-lg p-3 flex flex-col gap-2 shrink-0">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-neutral-900 border border-white/10">
                  <span className="text-[10px] font-semibold text-neutral-400">ALT + S</span>
                  <div className="w-[1px] h-3 bg-white/10" />
                  <span className="text-white text-xs font-mono font-medium truncate">{displayText}</span>
                </div>
                <div className="flex flex-col gap-1 px-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-neutral-400 font-medium">Search Suggestions:</span>
                    <span className="text-[9px] font-bold text-emerald-400">Result</span>
                  </div>
                  {step >= 1 && (
                    <div className="flex items-center justify-between px-2 py-1 bg-white/5 rounded text-[11px] font-medium animate-pulse text-white">
                      <span>YouTube — youtube.com</span>
                      <span className="text-[9px] font-bold text-emerald-400">Launch URL</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          {!hideNavigation && (
            <div className="px-5 py-3 border-t border-[var(--color-borderDefault)] flex items-center justify-between bg-white/[0.01]">
              <div className="text-[10px] font-bold text-neutral-400 tracking-wider">
                STEP {stepIndex + 1} OF {totalSteps}
              </div>
              <button
                onClick={onNext}
                className="cursor-pointer px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 hover:from-purple-500/30 hover:to-indigo-500/30 text-purple-300 hover:text-purple-200 text-xs font-medium transition-all duration-200 flex items-center gap-1.5 active:scale-[0.98]"
              >
                {isLast ? 'Finish' : 'Next'}
                <FaChevronRight size={8} />
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================================================
// 3. TutorialDashboard Component
// ============================================================================

interface TutorialDashboardProps {
  onClose: () => void;
  isLoggedIn?: boolean;
  isEmbedded?: boolean;
}

export const TutorialDashboard: React.FC<TutorialDashboardProps> = ({ onClose, isLoggedIn, isEmbedded }) => {
  const handleFinish = async () => {
    if (!(window as any).isReplayingTutorial) {
      await StorageManager.setItem('tutorial_watched', true);
      await StorageManager.setItem('app_tutorial_progress', {
        search: true,
        favorites: true,
        agent: true,
        sidebar: true,
        touchpoints: true,
      });
    }
    window.dispatchEvent(new CustomEvent('TutorialFinished'));
    onClose();
  };

  return (
    <div className={isEmbedded ? "relative flex flex-col justify-between p-4 md:p-6 font-sans select-none overflow-hidden h-full w-full z-50" : "fixed inset-0 z-[100000] bg-[var(--color-rootBg)] flex flex-col justify-between p-4 md:p-6 font-sans select-none overflow-hidden h-screen w-screen max-h-screen max-w-screen"}>
      {!isEmbedded && (
        <div className="absolute top-2.5 left-2.5 select-none z-50">
          <Branding showAvatar={false} textColor="text-white" />
        </div>
      )}

      {!isEmbedded && (
        <div className="absolute top-2.5 right-2.5 z-50 flex items-center gap-3">
          <button
            onClick={() => window.open(CMDOS_DOCS_URL, '_blank')}
            className="cursor-pointer px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-400/10 to-indigo-400/10 border border-purple-400/25 hover:from-purple-400/20 hover:to-indigo-400/20 text-purple-300 hover:text-purple-200 text-xs font-medium transition-all duration-200 active:scale-[0.98]">
            Docs
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-red-500/10 text-neutral-400 hover:text-red-400 transition-all cursor-pointer border border-white/5"
            title="Close">
            <FaTimes size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-col items-center text-center mt-3 w-full shrink-0">
        <h1 className="text-white text-2xl md:text-[34px] font-semibold tracking-tight leading-tight">
          Everything you need, in <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">one place.</span>
        </h1>
        <p className="text-neutral-400 text-xs md:text-sm mt-1 max-w-[600px] font-medium leading-normal">
          Powerful features to search, automate and streamline your workflow.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full max-w-[1240px] mx-auto flex-grow my-4 overflow-hidden items-stretch">
        {/* Card 1: Search & Commands */}
        <div className="bg-[var(--color-containerBg)] border border-white/5 rounded-2xl p-4 flex justify-between gap-4 shadow-xl overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col justify-between min-h-0">
            <div>
              <div className="flex items-start gap-3">
                <div className="text-neutral-400 shrink-0 mt-0.5">
                  <FaSearch size={20} />
                </div>
                <div>
                  <h3 className="text-white text-[16px] font-semibold tracking-tight">Search & Commands</h3>
                  <p className="text-neutral-400 text-[11px] font-medium mt-0.5 leading-snug">
                    Your shortcut to a digital second brain.
                  </p>
                </div>
              </div>

              <div className="mt-2.5">
                <span className="text-[9.5px] font-bold text-emerald-400 tracking-wider">
                  ALT + S
                </span>
              </div>

              <ul className="mt-3.5 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Search YouTube, notes, links, news and more instantly.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Type <span className="text-emerald-400 font-mono font-semibold">@</span> to trigger commands
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Type <span className="text-emerald-400 font-mono font-semibold">/</span> to find saved files & links
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="w-[240px] md:w-[260px] h-full min-h-[180px] max-h-[200px] bg-black/40 border border-white/10 rounded-xl overflow-hidden relative shrink-0 flex items-center justify-center shadow-inner">
            <img
              src="/AltS_search_newtab/images/Gif/searchbar-demo.gif"
              alt="Search demo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Card 2: Keyboard Shortcuts */}
        <div className="bg-[var(--color-containerBg)] border border-white/5 rounded-2xl p-4 flex justify-between gap-4 shadow-xl overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col justify-between min-h-0">
            <div>
              <div className="flex items-start gap-3">
                <div className="text-neutral-400 shrink-0 mt-0.5">
                  <FaKeyboard size={20} />
                </div>
                <div>
                  <h3 className="text-white text-[16px] font-semibold tracking-tight">Keyboard Shortcuts</h3>
                  <p className="text-neutral-400 text-[11px] font-medium mt-0.5 leading-snug">
                    Turn frequent actions into instant hotkeys.
                  </p>
                </div>
              </div>

              <div className="mt-2.5">
                <span className="text-[11px] font-semibold text-blue-400 leading-normal">
                  Assign a keyboard shortcut to any note or link collection for quick access.
                </span>
              </div>

              <ul className="mt-3.5 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Save favorites: Pin your top agents, links, or notes
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Assign hotkeys: Trigger workflows with Alt + 1
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Work faster: Skip the mouse entirely
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="w-[240px] md:w-[260px] h-full min-h-[180px] max-h-[200px] bg-black/40 border border-white/10 rounded-xl overflow-hidden relative shrink-0 flex items-center justify-center shadow-inner">
            <img
              src="/AltS_search_newtab/images/Gif/favorite-panel-demo.gif"
              alt="Favorites demo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Card 3: AI Chat Shortcuts */}
        <div className="bg-[var(--color-containerBg)] border border-white/5 rounded-2xl p-4 flex justify-between gap-4 shadow-xl overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col justify-between min-h-0">
            <div>
              <div className="flex items-start gap-3">
                <div className="text-neutral-400 shrink-0 mt-0.5">
                  <FaRobot size={20} />
                </div>
                <div>
                  <h3 className="text-white text-[16px] font-semibold tracking-tight">AI Chat Shortcuts</h3>
                  <p className="text-neutral-400 text-[11px] font-medium mt-0.5 leading-snug">
                    Turn AI workflows into reusable shortcuts.
                  </p>
                </div>
              </div>

              <div className="mt-2.5">
                <span className="text-[9.5px] font-bold text-purple-400 tracking-wider">
                  @ai
                </span>
              </div>

              <ul className="mt-3.5 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Save time: Automate repetitive tasks
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Multi-model: Chat with ChatGPT, Claude & Gemini
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Instant launch: Trigger agents anywhere
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="w-[240px] md:w-[260px] h-full min-h-[180px] max-h-[200px] bg-black/40 border border-white/10 rounded-xl overflow-hidden relative shrink-0 flex items-center justify-center shadow-inner">
            <img
              src="/AltS_search_newtab/images/Gif/agent-panel-demo.gif"
              alt="AI Chat demo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Card 4: cmdOS Anywhere */}
        <div className="bg-[var(--color-containerBg)] border border-white/5 rounded-2xl p-4 flex justify-between gap-4 shadow-xl overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col justify-between min-h-0">
            <div>
              <div className="flex items-start gap-3">
                <div className="text-neutral-400 shrink-0 mt-0.5">
                  <FaGlobe size={20} />
                </div>
                <div>
                  <h3 className="text-white text-[16px] font-semibold tracking-tight">cmdOS Anywhere</h3>
                  <p className="text-neutral-400 text-[11px] font-medium mt-0.5 leading-snug">
                    Use cmdOS across all browser touchpoints.
                  </p>
                </div>
              </div>

              <div className="mt-2.5 flex gap-1.5">
                <span className="text-[9.5px] font-bold text-teal-400 tracking-wider">
                  ALT + C
                </span>
                <span className="text-neutral-500 text-[9.5px] font-bold select-none">•</span>
                <span className="text-[9.5px] font-bold text-teal-400 tracking-wider">
                  ALT + S
                </span>
              </div>

              <ul className="mt-3.5 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Open create menu on new tab page.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Open side panel on any website.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
                  <span className="text-neutral-300 text-[12.5px] font-medium leading-normal">
                    Run automations & AI without switching tabs.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="w-[240px] md:w-[260px] h-full min-h-[180px] max-h-[200px] flex flex-col gap-1.5 shrink-0 bg-black p-2 rounded-xl border border-white/10 overflow-hidden text-[9px] leading-snug select-none">
            <div className="flex flex-col gap-1 p-1.5 rounded-lg bg-black border border-white/5">
              <div className="flex items-center gap-1 select-none">
                <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[8.5px] font-mono text-teal-300 font-bold uppercase shadow-sm">Alt</span>
                <span className="text-white/40 text-[8.5px]">+</span>
                <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[8.5px] font-mono text-teal-300 font-bold uppercase shadow-sm">C</span>
                <span className="text-neutral-400 text-[9px] font-semibold ml-1.5">(New Tab)</span>
              </div>
              <ul className="text-neutral-300 space-y-0.5 text-[9px] font-medium pl-0.5">
                <li className="flex items-start gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400/80 shrink-0 mt-1.5" />
                  <span>Create notes, links, agents</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400/80 shrink-0 mt-1.5" />
                  <span>Accessible anywhere on tab</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400/80 shrink-0 mt-1.5" />
                  <span>Save reusable workflows</span>
                </li>
              </ul>
              <div className="text-[8px] bg-teal-950/40 text-teal-400 px-1 py-0.5 rounded border border-teal-500/20 mt-0.5 inline-block w-fit">
                💡 <span className="font-bold">Pro Tip:</span> Press Alt + C on new tab
              </div>
            </div>

            <div className="flex flex-col gap-1 p-1.5 rounded-lg bg-black border border-white/5">
              <div className="flex items-center gap-1 select-none">
                <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[8.5px] font-mono text-teal-300 font-bold uppercase shadow-sm">Alt</span>
                <span className="text-white/40 text-[8.5px]">+</span>
                <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[8.5px] font-mono text-teal-300 font-bold uppercase shadow-sm">S</span>
                <span className="text-neutral-400 text-[9px] font-semibold ml-1.5">(Any Website)</span>
              </div>
              <ul className="text-neutral-300 space-y-0.5 text-[9px] font-medium pl-0.5">
                <li className="flex items-start gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400/80 shrink-0 mt-1.5" />
                  <span>Search workspace instantly</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400/80 shrink-0 mt-1.5" />
                  <span>Run automations without tabs</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400/80 shrink-0 mt-1.5" />
                  <span>Capture notes & page context</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full flex justify-end shrink-0 mb-2 mt-1 px-4 md:px-6">
        <button
          onClick={handleFinish}
          className="cursor-pointer bg-gradient-to-r from-purple-400/10 to-indigo-400/10 border border-purple-400/25 hover:from-purple-400/20 hover:to-indigo-400/20 text-purple-300 hover:text-purple-200 font-medium py-2 px-6 rounded-full active:scale-[0.98] transition-all duration-200 flex items-center gap-2 text-xs tracking-wide">
          Let's automate with cmdOS
          <FaChevronRight size={10} />
        </button>
      </div>
    </div>
  );
};

export default TutorialCard;

