import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  FaUser,
  FaRegCalendarAlt,
  FaRegClock,
  FaPlus,
  FaRobot,
  FaBolt,
  FaLayerGroup,
  FaTimes,
  FaCheck,
} from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { FiClock, FiFileText, FiRepeat, FiSearch, FiLink, FiCode, FiZap, FiCheckSquare, FiFolder, FiChevronDown } from 'react-icons/fi';
import { format, formatDistanceToNow } from 'date-fns';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { resolveAutomationIconMeta } from '../../../../../shared-components/icons/automationDynamicIcon';
import { getFaviconUrl } from '../../../../../pages/AltS_search_newtab/src/components/searchSystemComponents/searchBarMain/utilityFunctions/utils';
import useNotification from '../../../../../shared-components/notifications/useNotification';
import { useAppearance } from '@extension/ui';

interface InlineTimeInputProps {
  value: string; // 'HH:mm' in 24h
  onChange: (val: string) => void;
  onExitRight: () => void;
  onExitLeft: () => void;
}

const InlineTimeInput: React.FC<InlineTimeInputProps> = ({ value, onChange, onExitRight, onExitLeft }) => {
  let [hh, mm] = (value || '09:00').split(':');
  let hr24 = parseInt(hh, 10);
  const isPM = hr24 >= 12;
  let hr12 = hr24 % 12 || 12;

  const hrRef = useRef<HTMLInputElement>(null);
  const minRef = useRef<HTMLInputElement>(null);
  const ampmRef = useRef<HTMLInputElement>(null);

  const updateTime = (newHr12: number, newMin: string, newIsPM: boolean) => {
    let finalHr24 = newHr12;
    if (newIsPM && newHr12 < 12) finalHr24 += 12;
    if (!newIsPM && newHr12 === 12) finalHr24 = 0;
    onChange(`${String(finalHr24).padStart(2, '0')}:${newMin}`);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, segment: 'hr' | 'min' | 'ampm') => {
    if (e.key === 'ArrowRight') {
      if (segment === 'hr' && hrRef.current?.selectionEnd === hrRef.current?.value.length) { e.preventDefault(); minRef.current?.focus(); }
      else if (segment === 'min' && minRef.current?.selectionEnd === minRef.current?.value.length) { e.preventDefault(); ampmRef.current?.focus(); }
      else if (segment === 'ampm' && ampmRef.current?.selectionEnd === ampmRef.current?.value.length) { e.preventDefault(); onExitRight(); }
    } else if (e.key === 'ArrowLeft') {
      if (segment === 'ampm' && ampmRef.current?.selectionStart === 0) { e.preventDefault(); minRef.current?.focus(); }
      else if (segment === 'min' && minRef.current?.selectionStart === 0) { e.preventDefault(); hrRef.current?.focus(); }
      else if (segment === 'hr' && hrRef.current?.selectionStart === 0) { e.preventDefault(); onExitLeft(); }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (segment === 'hr') updateTime(e.key === 'ArrowUp' ? (hr12 === 12 ? 1 : hr12 + 1) : (hr12 === 1 ? 12 : hr12 - 1), mm, isPM);
      else if (segment === 'min') {
        let m = parseInt(mm, 10);
        m = e.key === 'ArrowUp' ? (m + 1) % 60 : (m - 1 + 60) % 60;
        updateTime(hr12, String(m).padStart(2, '0'), isPM);
      }
      else if (segment === 'ampm' && ampmRef.current) updateTime(hr12, mm, !isPM);
    }
  };

  return (
    <div className="flex items-center text-white inline-time-input" onClick={e => e.stopPropagation()}>
      <input
        id="time-input-field"
        ref={hrRef}
        type="text"
        value={String(hr12).padStart(2, '0')}
        onChange={e => {
          const val = e.target.value.replace(/[^0-9]/g, '');
          if (val) {
            let num = parseInt(val, 10);
            if (num > 12) num = parseInt(val.slice(-1), 10);
            if (num === 0 && val.length > 1) num = 12;
            updateTime(num || 12, mm, isPM);
            if (val.length === 2 && num >= 1) minRef.current?.focus();
          }
        }}
        onFocus={handleFocus}
        onKeyDown={e => handleKeyDown(e, 'hr')}
        className="w-[18px] bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm"
      />
      <span className="opacity-50 pb-[2px]">:</span>
      <input
        ref={minRef}
        type="text"
        value={mm}
        onChange={e => {
          const val = e.target.value.replace(/[^0-9]/g, '');
          if (val) {
            let num = parseInt(val, 10);
            if (num > 59) num = parseInt(val.slice(-1), 10);
            updateTime(hr12, String(num).padStart(2, '0'), isPM);
            if (val.length === 2) ampmRef.current?.focus();
          }
        }}
        onFocus={handleFocus}
        onKeyDown={e => handleKeyDown(e, 'min')}
        className="w-[18px] bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm"
      />
      <input
        ref={ampmRef}
        type="text"
        value={isPM ? 'PM' : 'AM'}
        onChange={e => {
          const val = e.target.value.toUpperCase();
          if (val.includes('A')) updateTime(hr12, mm, false);
          if (val.includes('P')) updateTime(hr12, mm, true);
        }}
        onFocus={handleFocus}
        onKeyDown={e => handleKeyDown(e, 'ampm')}
        className="w-[22px] ml-1 bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm text-[11px] font-bold tracking-wider"
      />
    </div>
  );
};

interface CustomTimePickerProps {
  value: string; // 'HH:mm'
  onChange: (val: string) => void;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  focusedColumn?: number; // 0: hr, 1: min, 2: ampm
}

const CustomTimePicker: React.FC<CustomTimePickerProps> = ({ value, onChange, isOpen, setIsOpen, focusedColumn = -1 }) => {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  let [hh, mm] = (value || '09:00').split(':');
  if (!hh) hh = '09';
  if (!mm) mm = '00';

  let hrNum = parseInt(hh, 10);
  const isPM = hrNum >= 12;
  let hr12 = hrNum % 12;
  if (hr12 === 0) hr12 = 12;

  const updateTime = (newHr12: number, newMin: string, newIsPM: boolean) => {
    let finalHr24 = newHr12;
    if (newIsPM && newHr12 < 12) finalHr24 += 12;
    if (!newIsPM && newHr12 === 12) finalHr24 = 0;

    onChange(`${String(finalHr24).padStart(2, '0')}:${newMin}`);
  };

  const handleHourChange = (newHr: number) => updateTime(newHr, mm, isPM);
  const handleMinChange = (newMin: string) => updateTime(hr12, newMin, isPM);
  const handleMeridiemChange = (newIsPM: boolean) => updateTime(hr12, mm, newIsPM);

  return (
    <div ref={popupRef} className="absolute left-0 bottom-full mb-2 bg-[var(--color-innerPopupBg)] border border-[#2f3142] rounded-xl p-2 shadow-2xl z-[150] flex gap-2 text-white font-sans" onClick={e => e.stopPropagation()}>
      {/* Hours */}
      <div className="flex flex-col gap-1 w-12 h-40 overflow-y-auto custom-scrollbar pr-1 rounded-xl transition-all">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
          <button
            key={h}
            type="button"
            onClick={() => handleHourChange(h)}
            className={`w-full text-center py-1.5 rounded-lg text-sm transition-colors ${hr12 === h ? 'bg-white/20 text-white font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
          >
            {String(h).padStart(2, '0')}
          </button>
        ))}
      </div>

      <div className="flex flex-col justify-center text-neutral-500 font-bold">:</div>

      {/* Minutes */}
      <div className="flex flex-col gap-1 w-12 h-40 overflow-y-auto custom-scrollbar pr-1 rounded-xl transition-all">
        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
          <button
            key={m}
            type="button"
            onClick={() => handleMinChange(m)}
            className={`w-full text-center py-1.5 rounded-lg text-sm transition-colors ${mm === m ? 'bg-white/20 text-white font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="w-px bg-white/10 mx-1"></div>

      {/* AM/PM */}
      <div className="flex flex-col gap-1 w-12 justify-center rounded-xl transition-all p-1">
        <button
          type="button"
          onClick={() => { handleMeridiemChange(false); setIsOpen(false); }}
          className={`w-full text-center py-2 rounded-lg text-sm transition-colors ${!isPM ? 'bg-white/20 text-white font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
        >
          AM
        </button>
        <button
          type="button"
          onClick={() => { handleMeridiemChange(true); setIsOpen(false); }}
          className={`w-full text-center py-2 rounded-lg text-sm transition-colors ${isPM ? 'bg-white/20 text-white font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
        >
          PM
        </button>
      </div>
    </div>
  );
};

interface ConvertibleItem {
  id: string;
  name: string;
  category: string;
  data: any;
  event_deadline?: string;
  is_done?: boolean;
  iconHost?: string;
  iconHosts?: string[];
}

const getSingleItemName = (item: ConvertibleItem | undefined): string => {
  if (!item) return '';
  const rawName = item.name;
  if (typeof rawName === 'string') return rawName;
  if (rawName && typeof rawName === 'object') {
    const obj = rawName as any;
    if (typeof obj.name === 'string') return obj.name;
    if (Array.isArray(obj.names) && obj.names.length > 0) return String(obj.names[0]);
    try { return JSON.stringify(obj); } catch { return ''; }
  }
  return String(rawName ?? '');
};

const getSecondaryText = (item: ConvertibleItem): string => {
  const data = item.data || {};
  const cat = (item.category || '').toLowerCase();

  if (cat === 'note') {
    if (data.description) return data.description;
    if (data.updated_at) {
      try {
        return `Last edited ${formatDistanceToNow(new Date(data.updated_at))} ago`;
      } catch (e) { }
    }
    if (data.value && typeof data.value === 'string') {
      return data.value.replace(/<[^>]+>/g, '').slice(0, 40) + '...';
    }
    return 'Note';
  }

  if (['link'].includes(cat)) {
    let urls: string[] = [];
    const v = data.value;
    if (v && typeof v === 'object' && Array.isArray((v as any).urls)) {
      urls = (v as any).urls.filter((u: any) => typeof u === 'string');
    } else if (typeof v === 'string' && (v.trim().startsWith('{') || v.trim().startsWith('['))) {
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed.urls)) urls = parsed.urls.filter((u: any) => typeof u === 'string');
      } catch (e) { }
    }

    if (urls.length > 1) {
      const hostnames = urls.slice(0, 4).map(u => {
        try { return new URL(u.startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./, ''); }
        catch (e) { return u; }
      });
      return `${urls.length} links · ${hostnames.join(', ')}${urls.length > 4 ? '…' : ''}`;
    }

    let rawUrl = data.url || data.link || (urls.length === 1 ? urls[0] : '');
    if (!rawUrl && typeof v === 'string' && !v.startsWith('{') && !v.startsWith('[')) rawUrl = v;
    if (!rawUrl && typeof item.name === 'string' && item.name.startsWith('http')) rawUrl = item.name;
    if (rawUrl && typeof rawUrl === 'string') {
      try {
        const urlObj = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
        return urlObj.hostname.replace(/^www\./, '');
      } catch (e) {
        return rawUrl;
      }
    }
    return 'Link';
  }

  if (['automation'].includes(cat)) {
    if (data.schedule_type === 'recurring' && data.recurring_cycle) return `Every ${data.recurring_cycle}`;
    if (data.is_recurring && data.recurring_cycle) return `Every ${data.recurring_cycle}`;
    if (data.event_deadline) {
      try {
        return `Scheduled for ${format(new Date(data.event_deadline), 'MMM d, h:mm a')}`;
      } catch (e) { }
    }
    if (data.description) return data.description;
    return 'Automation';
  }

  if (['agent', 'chat_agent', 'ai', 'assistant', 'chat'].includes(cat) || data.type === 'agent') {
    return data.description || 'Chat Agent';
  }

  return cat.charAt(0).toUpperCase() + cat.slice(1);
};

const getItemIcon = (item: ConvertibleItem) => {
  const cat = (item.category || '').toLowerCase();
  const data = item.data || {};

  if (['agent', 'chat_agent', 'ai', 'assistant', 'chat'].includes(cat) || data.type === 'agent') {
    const meta = resolveAutomationIconMeta(data.automation || data);

    if (meta.mode === 'all_ai' || meta.mode === 'multi_link' || (meta.mode === 'single_link' && meta.hosts.length > 0)) {
      const visibleHosts = meta.hosts.slice(0, 4);
      const size = 14;
      const count = visibleHosts.length;
      const offsetRatio = 0.55;
      const dotSize = Math.floor(size / (1 + offsetRatio * (count - 1)));
      const offset = dotSize * offsetRatio;
      const totalWidth = dotSize + (count - 1) * offset;

      return (
        <div className="shrink-0 flex items-center justify-center" style={{ position: 'relative', width: totalWidth, height: Math.max(dotSize, 14) }}>
          {visibleHosts.map((host: string, index: number) => (
            <div
              key={`${host}-${index}`}
              style={{
                position: 'absolute',
                left: index * offset,
                top: (Math.max(dotSize, 14) - dotSize) / 2,
                width: dotSize,
                height: dotSize,
                borderRadius: '50%',
                overflow: 'hidden',
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.15)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                zIndex: 10 - index,
              }}>
              <img
                src={getFaviconUrl(host)}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ))}
        </div>
      );
    }

    if (data.avatar) return <img src={data.avatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />;
    if (data.icon && typeof data.icon === 'string') return <img src={data.icon} alt="" className="w-3.5 h-3.5 rounded-[4px] object-cover shrink-0 bg-white/10" />;
    return <LuSparkles size={11} className="text-[var(--color-iconDefault)] shrink-0" />;
  }

  if (['link'].includes(cat)) {
    let rawUrl = data.url || data.value || data.link || '';
    if (!rawUrl && typeof item.name === 'string' && item.name.startsWith('http')) rawUrl = item.name;
    if (rawUrl && typeof rawUrl === 'string') {
      try {
        const urlObj = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
        return <img src={`https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`} alt="" className="w-3.5 h-3.5 rounded-[4px] shrink-0 bg-white/10" />;
      } catch (e) { }
    }
    return <FiLink size={11} className="text-[var(--color-iconDefault)] shrink-0" />;
  }

  if (['automation'].includes(cat)) {
    return <FiZap size={11} className="text-[var(--color-iconDefault)] shrink-0" />;
  }

  return <FiFileText size={11} className="text-[var(--color-iconDefault)] shrink-0" />;
};

const validCategories = ['note', 'snippet', 'link', 'automation', 'agent', 'chat_agent', 'ai', 'assistant', 'chat', 'prompt'];
const isValidCategory = (item: ConvertibleItem) => {
  const cat = (item.category || '').toLowerCase();
  return validCategories.includes(cat) || item.data?.type === 'agent';
};

interface CreateTodoViewProps {
  items: ConvertibleItem[];
  onCreateTodo: (data: any) => void;
  isDarkMode?: boolean;
  initialItem?: any;
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  scrollableRef?: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  isEditMode?: boolean;
}

const CreateTodoView: React.FC<CreateTodoViewProps> = ({
  items,
  onCreateTodo,
  isDarkMode: propIsDarkMode,
  initialItem,
  selectedIndex,
  onSelectedIndexChange,
  searchQuery: externalSearchQuery,
  onSearchQueryChange: setExternalSearchQuery,
  scrollableRef,
  onClose,
  isEditMode = false,
}) => {
  const { theme } = useAppearance();
  const isDarkMode = propIsDarkMode ?? (theme.isDark || document.documentElement.classList.contains('dark'));
  const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';

  const triggerNotification = useNotification();
  const [selectedType, setSelectedType] = useState('custom');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'note' | 'snippet' | 'link' | 'prompt' | 'automation' | 'agent'>('all');
  const [hasSelectedTypeInitially, setHasSelectedTypeInitially] = useState(() => {
    return isEditMode;
  });
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(() => !isEditMode);
  const typeDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isTypeDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTypeDropdownOpen]);

  const isMac = navigator.userAgent.includes('Mac');
  const [selectedItem, setSelectedItem] = useState<ConvertibleItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<ConvertibleItem[]>([]);
  const [showSelectedTooltip, setShowSelectedTooltip] = useState(false);

  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = setExternalSearchQuery || setInternalSearchQuery;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [scheduleType, setScheduleType] = useState<'one-time' | 'recurring' | ''>('one-time');
  const [isAnytime, setIsAnytime] = React.useState(false);
  const [activeSlot, setActiveSlot] = useState<'title' | 'description' | 'mode' | 'date' | 'time' | 'resource' | 'submit' | null>('title');
  const [isEditing, setIsEditing] = useState(!initialItem);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionCaretPos, setMentionCaretPos] = useState({ start: 0, end: 0 });

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return items.filter(item => {
      if (!isValidCategory(item)) return false;
      return (item.name || '').toLowerCase().includes(q);
    }).slice(0, 5);
  }, [items, mentionQuery]);

  const handleSelectMention = (item: ConvertibleItem) => {
    setSelectedItems(prev => {
      const exists = prev.some(i => i.id === item.id);
      if (exists) return prev;
      return [...prev, item];
    });

    const beforeText = description.substring(0, mentionCaretPos.start);
    const afterText = description.substring(mentionCaretPos.end);
    const mentionText = `@${getSingleItemName(item)} `;
    const newText = beforeText + mentionText + afterText;
    
    setDescription(newText);
    setMentionQuery(null);

    setTimeout(() => {
      const textarea = descriptionRef.current as unknown as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.focus();
        const cursorPosition = mentionCaretPos.start + mentionText.length;
        textarea.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 10);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDescription(val);

    const selectionEnd = e.target.selectionEnd;
    const textBeforeCursor = val.substring(0, selectionEnd);
    const lastWordMatch = textBeforeCursor.match(/@(\S*)$/);

    if (lastWordMatch) {
      setMentionQuery(lastWordMatch[1]);
      setMentionIndex(0);
      setMentionCaretPos({
        start: selectionEnd - lastWordMatch[0].length,
        end: selectionEnd
      });
    } else {
      setMentionQuery(null);
    }
  };

  const [recurringCycle, setRecurringCycle] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isPickerActive, setIsPickerActive] = useState(false);

  const [time, setTime] = useState(() => format(new Date(), 'HH:mm'));
  const [isTimeEditing, setIsTimeEditing] = useState(false);
  const [amPm, setAmPm] = useState<'AM' | 'PM'>('AM');
  const [rawTimeText, setRawTimeText] = useState('');
  const [hourText, setHourText] = useState(() => {
    let h = new Date().getHours();
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return h.toString().padStart(2, '0');
  });
  const [minText, setMinText] = useState(() => new Date().getMinutes().toString().padStart(2, '0'));
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const [showRepeatDropdown, setShowRepeatDropdown] = useState(false);
  const [openAutomatically, setOpenAutomatically] = useState(false);
  const [createMore, setCreateMore] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  const [focusedIndex, setFocusedIndex] = useState(0);
  const prevActiveSlotRef = useRef<string | null>(null);
  const shouldAutoOpenDateRef = useRef(false);
  const isSavingRef = useRef(false);
  const lastInitialItemRef = useRef<any>(undefined);
  const lastItemsSignatureRef = useRef<string>('');
  const hasUnsavedChanges = useRef(false);
  const itemsSignature = useMemo(
    () => JSON.stringify((items || []).map(item => [String(item.id), String(item.category || ''), String(item.name || '')])),
    [items]
  );

  // Set global modal open state
  useEffect(() => {
    // setIsFullScreenModalOpen is removed
    return () => {
      // setIsFullScreenModalOpen is removed
    };
  }, []);

  const formatTime12Hour = (timeStr: string) => {
    if (!timeStr) return 'Select Time';
    try {
      const [h, m] = timeStr.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return timeStr;
      const dateObj = new Date();
      dateObj.setHours(h, m, 0, 0);
      return format(dateObj, 'h:mm a');
    } catch (e) {
      return timeStr;
    }
  };

  const types = [
    { id: 'custom', label: 'To-do', description: 'Assign a To-do to saved', icon: <FiCheckSquare size={12} />, color: '' },
    { id: 'saved_files', label: 'Automated To-do', description: 'Attach a saved file', icon: <FiFolder size={12} />, color: '' },
  ];

  const repeatOptions = [
    { id: 'daily', label: 'Daily', icon: <FiRepeat size={12} /> },
    { id: 'weekly', label: 'Weekly', icon: <FiRepeat size={12} /> },
    { id: 'monthly', label: 'Monthly', icon: <FiRepeat size={12} /> },
  ] as const;

  const modeOptions = [
    { id: 'one-time', label: 'One-time', description: 'Schedule for a single occurrence', icon: <FaRegClock size={12} /> },
    { id: 'recurring', label: 'Recurring', description: 'Set up a repeating schedule', icon: <FiRepeat size={12} /> },
  ] as const;

  const timeOptions = useMemo(() => {
    const opts = [{ id: 'specific', label: 'Specific Time', icon: <FiClock size={12} /> }];
    if (scheduleType === 'recurring') {
      opts.unshift({ id: 'anytime', label: 'Anytime of the day', icon: <FaRegClock size={12} /> });
    }
    return opts;
  }, [scheduleType]);

  const slots: ('title' | 'description' | 'mode' | 'date' | 'time' | 'resource' | 'submit')[] = useMemo(() => {
    return ['title', 'description', 'mode', 'date', 'time', 'resource', 'submit'];
  }, []);

  const hideNativeIconsStyle = `
    .hide-native-picker::-webkit-calendar-picker-indicator,
    .hide-native-picker::-webkit-inner-spin-button,
    .hide-native-picker::-webkit-clear-button {
      display: none !important;
      -webkit-appearance: none;
    }
    input[type="date"]::-webkit-datetime-edit-fields-wrapper {
      background: transparent !important;
    }
    input[type="time"]::-webkit-calendar-picker-indicator {
      display: none !important;
    }
    input[type="time"]::-webkit-datetime-edit-hour-field:focus,
    input[type="time"]::-webkit-datetime-edit-minute-field:focus,
    input[type="time"]::-webkit-datetime-edit-ampm-field:focus {
      background-color: #a855f7 !important;
      color: #ffffff !important;
    }
  `;

  useEffect(() => {
    if (scheduleType === 'one-time' && isAnytime) {
      setIsAnytime(false);
    }
  }, [scheduleType, isAnytime]);

  const manualHourRef = React.useRef<HTMLInputElement>(null);
  const manualMinRef = React.useRef<HTMLInputElement>(null);
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const descriptionRef = React.useRef<HTMLInputElement>(null);
  const internalSearchInputRef = React.useRef<HTMLInputElement>(null);
  const workspaceRef = React.useRef<HTMLDivElement>(null);
  const resultsContainerRef = React.useRef<HTMLDivElement>(null);
  const amPmBtnRef = React.useRef<HTMLButtonElement>(null);
  const lastEnterTime = React.useRef(0);

  const getAmPmFrom24h = (timeStr: string | null): 'AM' | 'PM' => {
    if (!timeStr || !timeStr.includes(':')) return 'AM';
    const h = parseInt(timeStr.split(':')[0], 10);
    return isNaN(h) ? 'AM' : (h >= 12 ? 'PM' : 'AM');
  };

  const get24hTimeStr = (h12Text: string, mText: string, ampmVal: 'AM' | 'PM'): string => {
    let h = parseInt(h12Text, 10);
    const m = parseInt(mText, 10);
    if (isNaN(h)) h = 12;
    const mins = isNaN(m) ? 0 : m;

    if (ampmVal === 'PM') {
      if (h < 12) h += 12;
    } else {
      if (h === 12) h = 0;
    }

    return `${h.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  React.useEffect(() => {
    if (time) {
      setAmPm(getAmPmFrom24h(time));
    }
  }, [time]);

  React.useEffect(() => {
    setFocusedIndex(0);
  }, [searchQuery]);

  React.useEffect(() => {
    if (activeSlot === 'resource' && resultsContainerRef.current) {
      const focusedEl = resultsContainerRef.current.querySelector(`[data-idx="${focusedIndex}"]`);
      if (focusedEl) {
        focusedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex, activeSlot]);

  React.useEffect(() => {
    if (initialItem === lastInitialItemRef.current && itemsSignature === lastItemsSignatureRef.current) {
      return;
    }
    lastInitialItemRef.current = initialItem;
    lastItemsSignatureRef.current = itemsSignature;

    let item = initialItem;
    if (item && item.snippet && typeof item.snippet === 'object') {
      item = {
        ...item.snippet,
        todo_id: item.todo_id || item.snippet.todo_id || item.snippet.id || item.snippet.snippet_id,
        config: item.config || item.snippet.config
      };
    }

    const isActualResource = item && (
      item.id ||
      item.snippet_id ||
      item.todo_id ||
      item.key ||
      item.title ||
      item.name ||
      item.label ||
      item.category
    ) && !item.isCreateModalOnly;

    if (isActualResource) {
      let parsedConfig = item.config;
      if (typeof parsedConfig === 'string' && (parsedConfig as string).trim().startsWith('{')) {
        try {
          parsedConfig = JSON.parse(parsedConfig);
        } catch (e) { }
      }
      const configIds = parsedConfig?.id;
      const hasAttachedFiles = (Array.isArray(configIds) && configIds.length > 0) || (Array.isArray(item.references) && item.references.length > 0);
      const isCustom = !hasAttachedFiles;

      let cat = (item.category || item.snippet_category || 'note').toLowerCase();

      if (item.key || item.title || item.name || item.label) {
        const rawTitle = item.key || item.title || item.name || item.label;
        setTitle(typeof rawTitle === 'object' && rawTitle !== null ? ((rawTitle as any).name || (Array.isArray((rawTitle as any).names) ? (rawTitle as any).names.join(', ') : JSON.stringify(rawTitle))) : String(rawTitle));
      }
      if (item.description || item.value) {
        const rawDesc = item.description || item.value;
        setDescription(cleanDescription(rawDesc));
      }

      if (item.is_anytime || (item.event_deadline && String(item.event_deadline).substring(0, 4) >= '2035')) {
        setIsAnytime(true);
      } else if (item.event_deadline) {
        const d = new Date(item.event_deadline);
        setDate(format(d, 'yyyy-MM-dd'));
        setTime(format(d, 'HH:mm'));
        setIsAnytime(false);
      } else {
        setIsAnytime(true);
      }

      if (item.is_recurring || (item as any).recurring || item.recurring_cycle) {
        setScheduleType('recurring');
        if (item.recurring_cycle) setRecurringCycle(String(item.recurring_cycle).toLowerCase() as any);
      } else {
        setScheduleType('one-time');
      }

      let matchedItems: ConvertibleItem[] = [];

      if (isCustom) {
        setSelectedType('custom');
        setSelectedItem(null);
        setSelectedItems([]);
      } else {
        let parsedConfig = item.config;
        if (typeof parsedConfig === 'string' && (parsedConfig as string).trim().startsWith('{')) {
          try {
            parsedConfig = JSON.parse(parsedConfig);
          } catch (e) {
            console.error('[CreateTodoView] Failed to parse config JSON string:', parsedConfig, e);
          }
        }
        const configIds = parsedConfig?.id || [];
        const referenceIds = Array.isArray(item.references) ? item.references.map((r: any) => r.id) : [];
        const allReferenceIds = [...configIds, ...referenceIds];

        if (allReferenceIds.length > 0) {
          matchedItems = (items || []).filter(availableItem =>
            allReferenceIds.some(cid => {
              const availIdStr = String(availableItem.id);
              const cidStr = String(cid);
              return availIdStr === cidStr;
            })
          );
        }

        if (matchedItems.length === 0) {
          const singleId = item.id || item.snippet_id || item.todo_id || item.snippet_todo_id;
          if (singleId) {
            const singleIdStr = String(singleId);
            const matched = (items || []).find(availableItem => {
              const availIdStr = String(availableItem.id);
              return availIdStr === singleIdStr;
            });
            if (matched) {
              matchedItems = [matched];
            }
          }
        }

        if (matchedItems.length === 0 && (item.id || item.snippet_id || item.todo_id || (cat === 'command' && item.value))) {
          if (cat !== 'snippet') {
            const possibleIds = [item.todo_id, item.id, item.snippet_todo_id];
            const numericId = possibleIds.find(id => typeof id === 'number' || (typeof id === 'string' && id.length > 0 && !isNaN(Number(id)) && !id.includes('-')));

            const fallbackItem = {
              id: numericId || item.id || item.snippet_id || item.value,
              name: item.key || item.title || item.name || item.label || 'Untitled',
              category: cat,
              data: item,
            };
            matchedItems = [fallbackItem];
          }
        }

        if (matchedItems.length > 0) {
          setSelectedItem(matchedItems[0]);
          setSelectedItems(matchedItems);
        }
        setSelectedType('saved_files');
      }

      useUIStore.getState().setTodoDraft({
        title: (item as any).key || (item as any).title || (item as any).name || (item as any).label || '',
        scheduleType: ((item as any).is_recurring || (item as any).recurring || (item as any).recurring_cycle) ? 'recurring' : 'one-time',
        recurringCycle: (item as any).recurring_cycle ? String((item as any).recurring_cycle).toLowerCase() : 'daily',
        time: (item as any).event_deadline ? format(new Date(String((item as any).event_deadline)), 'HH:mm') : format(new Date(), 'HH:mm'),
        date: (item as any).event_deadline ? format(new Date(String((item as any).event_deadline)), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        isAnytime: !!((item as any).is_anytime || ((item as any).event_deadline && String((item as any).event_deadline).substring(0, 4) >= '2035')),
        selectedItem: isCustom ? null : (matchedItems[0] || item),
        selectedType: isCustom ? 'custom' : 'note',
      });

      setOpenAutomatically(!!(item.openAutomatically || item.open_automatically || item.auto_open));
      setActiveSlot('date');
      setIsEditing(false);
    } else {
      setTitle('');
      setDescription('');
      setSelectedType('custom');
      setSelectedItem(null);
      setSelectedItems([]);
      setScheduleType('one-time');
      setIsAnytime(false);
      setRecurringCycle('daily');
      const now = new Date();
      setTime(format(now, 'HH:mm'));
      setDate(format(now, 'yyyy-MM-dd'));
      let h = now.getHours();
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
      setHourText(h.toString().padStart(2, '0'));
      setMinText(now.getMinutes().toString().padStart(2, '0'));
      setInternalSearchQuery('');
      if (setExternalSearchQuery) setExternalSearchQuery('');
      setOpenAutomatically(false);
      setActiveSlot('title');
    }
  }, [initialItem, setExternalSearchQuery, items, itemsSignature]);

  React.useEffect(() => {
    if (activeSlot === 'date' && !date) {
      setDate(format(new Date(), 'yyyy-MM-dd'));
    }
    if (activeSlot === 'time' && !time && !isAnytime) {
      setTime(format(new Date(), 'HH:mm'));
    }
  }, [activeSlot, date, time, isAnytime]);

  React.useEffect(() => {
    prevActiveSlotRef.current = activeSlot;
  }, [activeSlot]);

  React.useEffect(() => {
    useUIStore.getState().setTodoDraft({
      title,
      scheduleType,
      recurringCycle,
      time,
      date,
      isAnytime,
      selectedItem,
      selectedType,
      description,
    });
  }, [title, scheduleType, recurringCycle, time, date, isAnytime, selectedItem, selectedType, description]);

  useEffect(() => {
    const textarea = descriptionRef.current as unknown as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [description]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      workspaceRef.current?.focus();
      if (activeSlot && ['title', 'time'].includes(activeSlot) && !initialItem) {
        setIsEditing(true);
      }
    }, 50);
    return () => clearTimeout(timeout);
  }, []);

  React.useEffect(() => {
    if (!isEditing && !isPickerActive) {
      workspaceRef.current?.focus();
      return;
    }

    switch (activeSlot) {
      case 'title':
        titleInputRef.current?.focus();
        break;
      case 'description':
        descriptionRef.current?.focus();
        break;
      case 'mode':
        document.getElementById('mode-button')?.focus();
        break;
      case 'resource':
        if (isEditing) {
          setTimeout(() => {
            const input = document.getElementById('resource-search-input');
            if (input) {
              input.focus();
            } else {
              document.getElementById('resource-button')?.focus();
            }
          }, 50);
        } else {
          document.getElementById('resource-button')?.focus();
        }
        break;
      case 'date':
        workspaceRef.current?.focus();
        try {
          dateInputRef.current?.showPicker();
        } catch (e) {
          dateInputRef.current?.click();
        }
        break;
      case 'time':
        setIsTimeEditing(true);
        setTimeout(() => {
          document.getElementById('time-input-field')?.focus();
        }, 30);
        break;
      case 'submit':
        document.getElementById('final-save-button')?.focus();
        break;
    }
  }, [activeSlot, isEditing, selectedType, isAnytime, isPickerActive]);

  React.useEffect(() => {
    if (activeSlot === 'resource' && isEditing && resultsContainerRef.current) {
      const container = resultsContainerRef.current;
      const focusedEl = container.querySelector(`[data-idx="${focusedIndex}"]`);
      if (focusedEl) {
        focusedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex, activeSlot, isEditing]);

  const handleTypeSelect = (newType: string) => {
    if (!hasSelectedTypeInitially) setHasSelectedTypeInitially(true);
    setIsTypeDropdownOpen(false);
    if (newType !== selectedType) {
      setSelectedType(newType);
      setSelectedItem(null);
      setSelectedItems([]);
      setTitle('');
      setDescription('');
      setInternalSearchQuery('');
      if (setExternalSearchQuery) setExternalSearchQuery('');
    }
  };

  const filteredItems = useMemo(() => {
    if (selectedType === 'custom') return [];
    const q = searchQuery.toLowerCase();

    return items.filter(item => {
      if (!isValidCategory(item)) return false;
      if (q.length < 1) return true;
      return (item.name || '').toLowerCase().includes(q);
    });
  }, [items, selectedType, searchQuery]);

  const categoriesData = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const categories = {
      all: [] as ConvertibleItem[],
      note: [] as ConvertibleItem[],
      snippet: [] as ConvertibleItem[],
      link: [] as ConvertibleItem[],
      prompt: [] as ConvertibleItem[],
      automation: [] as ConvertibleItem[],
      agent: [] as ConvertibleItem[],
    };

    items.forEach(item => {
      if (!isValidCategory(item)) return;
      if (q.length > 0 && !(item.name || '').toLowerCase().includes(q)) return;
      const cat = (item.category || '').toLowerCase();
      
      categories.all.push(item);
      if (cat === 'note') categories.note.push(item);
      else if (cat === 'snippet') categories.snippet.push(item);
      else if (cat === 'prompt') categories.prompt.push(item);
      else if (['link'].includes(cat)) categories.link.push(item);
      else if (['agent', 'chat_agent', 'ai', 'assistant', 'chat'].includes(cat) || item.data?.type === 'agent') categories.agent.push(item);
      else if (['automation'].includes(cat)) categories.automation.push(item);
    });

    return categories;
  }, [items, searchQuery]);

  const toggleSelection = (item: ConvertibleItem) => {
    setSelectedItems(prev => {
      const exists = prev.some(i => i.id === item.id);
      if (exists) return prev.filter(i => i.id !== item.id);
      return [...prev, item];
    });
  };

  const handleCreate = React.useCallback(async (opts?: { overrideCreateMore?: boolean } | React.MouseEvent<HTMLButtonElement>) => {
    const shouldCreateMore = (opts && typeof opts === 'object' && 'overrideCreateMore' in opts) ? (opts as any).overrideCreateMore : createMore;
    const isSavedFiles = selectedItems.length > 0;
    if (!isSavedFiles && !title.trim()) return;
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setSaveStatus('saving');

    try {
      const promises: Promise<any>[] = [];
      if (isSavedFiles) {
        promises.push(
          Promise.resolve(onCreateTodo({
            type: selectedItems[0]?.category || 'note',
            item: selectedItems[0]?.data || selectedItems[0],
            selectedItems,
            title: title.trim() || getSingleItemName(selectedItems[0]) || 'Untitled Task',
            description: '',
            scheduleType: scheduleType,
            recurringCycle,
            time: isAnytime ? null : time,
            date,
            openAutomatically,
            isAnytime: isAnytime,
            createMore: shouldCreateMore,
          }))
        );
      } else {
        promises.push(
          Promise.resolve(onCreateTodo({
            type: 'custom',
            item: null,
            title: title.trim() || 'Untitled Task',
            description: description,
            scheduleType: scheduleType,
            recurringCycle,
            time: isAnytime ? null : time,
            date,
            openAutomatically,
            isAnytime: isAnytime,
            createMore: shouldCreateMore,
          }))
        );
      }
      if (!shouldCreateMore) {
        promises.push(new Promise(res => setTimeout(res, 600)));
      }
      await Promise.all(promises);

      if (shouldCreateMore) {
        setTitle('');
        setDescription('');
        setSelectedItem(null);
        setSelectedItems([]);
        setActiveSlot('title');
        titleInputRef.current?.focus();
        setSaveStatus('idle');
        isSavingRef.current = false;
      } else {
        setSaveStatus('saved');
        setTimeout(() => {
          setSaveStatus('idle');
          isSavingRef.current = false;
          onClose();
        }, 1500);
      }
    } catch (error) {
      setSaveStatus('error');
      isSavingRef.current = false;
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [selectedItems, title, description, scheduleType, recurringCycle, isAnytime, time, date, openAutomatically, createMore, onCreateTodo, onClose]);

  React.useEffect(() => {
    const handleSaveTrigger = () => {
      const saveBtn = document.getElementById('final-save-button');
      if (saveBtn) (saveBtn as HTMLButtonElement).click();
      else handleCreate();
    };
    window.addEventListener('trigger-todo-save', handleSaveTrigger);
    return () => window.removeEventListener('trigger-todo-save', handleSaveTrigger);
  }, [handleCreate]);

  React.useEffect(() => {
    let timer: any;
    if (activeSlot === 'date') {
      timer = setTimeout(() => {
        try {
          dateInputRef.current?.showPicker();
        } catch (e) {
          dateInputRef.current?.click();
        }
      }, 30);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeSlot]);

  const cleanDescription = (rawDesc: any): string => {
    if (!rawDesc) return '';
    const text = typeof rawDesc === 'object' && rawDesc !== null ? JSON.stringify(rawDesc) : String(rawDesc);
    return text.replace(/<\/?[^>]+(>|$)/g, '');
  };

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent | KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (activeSlot === 'resource' && isEditing) {
        e.preventDefault();
        e.stopPropagation();
        setIsEditing(false);
        return;
      }
    }
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setMentionIndex(prev => (prev + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setMentionIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        handleSelectMention(mentionSuggestions[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (activeSlot === 'resource' && isEditing) {
        return;
      }
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isInput && (activeSlot === 'resource' || activeSlot === 'description' || activeSlot === 'time')) {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        const isAtStart = target.selectionStart === 0 && target.selectionEnd === 0;
        const isAtEnd = target.selectionStart === target.value.length && target.selectionEnd === target.value.length;
        if (e.key === 'ArrowLeft' && !isAtStart) return;
        if (e.key === 'ArrowRight' && !isAtEnd) return;
      }

      const currentIndex = activeSlot ? slots.indexOf(activeSlot) : -1;
      let targetSlot: typeof slots[number] | null = null;
      if (e.key === 'ArrowRight' && currentIndex < slots.length - 1) targetSlot = slots[currentIndex + 1];
      else if (e.key === 'ArrowLeft' && currentIndex > 0) targetSlot = slots[currentIndex - 1];

      if (targetSlot) {
        e.preventDefault(); e.stopPropagation();
        setIsPickerActive(false);
        if (activeSlot === 'time') setIsTimeEditing(false);
        setActiveSlot(targetSlot);
        setFocusedIndex(0); setIsEditing(true);
        return;
      }
    }
    if (e.key === 'Tab') {
      const isInlineTimeInput = e.target instanceof Element && e.target.closest('.inline-time-input');
      if (isInlineTimeInput) return;

      if (activeSlot === 'time' && isTimeEditing) {
        return;
      }

      e.preventDefault(); e.stopPropagation();
      const currentIndex = activeSlot ? slots.indexOf(activeSlot) : -1;
      let nextIndex = e.shiftKey ? (currentIndex - 1 + slots.length) % slots.length : (currentIndex + 1) % slots.length;
      setActiveSlot(slots[nextIndex]);
      setFocusedIndex(0); setIsEditing(true);
      return;
    }
    if (!isEditing && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (activeSlot && ['type', 'mode', 'cycle', 'time'].includes(activeSlot)) {
        setIsEditing(true);
        e.preventDefault();
        return;
      }
    }

    if (isEditing) {
      const handleVerticalNav = (options: readonly any[], currentIdx: number, setter: (idx: number) => void, liveUpdate?: (id: any) => void) => {
        const nextIndex = e.key === 'ArrowDown' ? (currentIdx + 1) % options.length : (currentIdx - 1 + options.length) % options.length;
        setter(nextIndex);
        if (liveUpdate) liveUpdate(options[nextIndex].id);
        e.stopPropagation(); e.preventDefault();
      };

        if (activeSlot === 'resource' && isEditing) {
          const itemsList = categoriesData[selectedCategory] || [];
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedIndex(prev => (itemsList.length > 0 ? (prev + 1) % itemsList.length : 0));
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex(prev => (itemsList.length > 0 ? (prev - 1 + itemsList.length) % itemsList.length : 0));
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            const targetItem = itemsList[focusedIndex];
            if (targetItem) {
              toggleSelection(targetItem);
            }
            return;
          }
        }
        if (activeSlot === 'title') {
          if (e.key === 'ArrowDown') {
            const target = e.target as HTMLInputElement;
            const isAtEnd = target.selectionStart === target.value.length;
            if (isAtEnd) {
              e.preventDefault();
              setActiveSlot('description');
              setIsEditing(true);
              return;
            }
          }
        }
        if (activeSlot === 'description') {
          const target = e.target as HTMLTextAreaElement;
          const textBeforeCursor = target.value.substring(0, target.selectionStart);
          const textAfterCursor = target.value.substring(target.selectionEnd);
          const isOnFirstLine = !textBeforeCursor.includes('\n');
          const isOnLastLine = !textAfterCursor.includes('\n');

          if (e.key === 'ArrowUp' && isOnFirstLine) {
            e.preventDefault();
            setActiveSlot('title');
            setIsEditing(true);
            return;
          }
          if (e.key === 'ArrowDown' && isOnLastLine) {
            e.preventDefault();
            setActiveSlot('mode');
            setIsEditing(true);
            return;
          }
          return;
        }
        if (activeSlot === 'mode') {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveSlot('description');
            setIsEditing(true);
            return;
          }
        }
        if (activeSlot === 'date') {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveSlot('mode');
            setIsEditing(true);
            return;
          }
        }
        if (activeSlot === 'time' && !isTimeEditing) { handleVerticalNav(timeOptions, focusedIndex, setFocusedIndex); return; }
    }
    if (e.key === 'Enter') {
      const now = Date.now();
      if (now - lastEnterTime.current < 150) { e.preventDefault(); return; }
      lastEnterTime.current = now;
      const isSaveAndCreateNewShortcut = (isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key === 'Enter';
      const isSaveShortcut = (isMac ? e.metaKey : e.ctrlKey) && !e.shiftKey && e.key === 'Enter';
      const canSave = !((selectedType === 'custom' && !title.trim()) || (selectedType !== 'custom' && !(selectedItem || selectedItems.length > 0)));

      if (isSaveAndCreateNewShortcut) {
        if (canSave) {
          e.preventDefault();
          handleCreate({ overrideCreateMore: true });
          return;
        }
      } else if (isSaveShortcut) {
        if (canSave) {
          e.preventDefault();
          handleCreate({ overrideCreateMore: false });
          return;
        }
      }
      if (isEditing) {
        if (activeSlot === 'description') {
          return;
        }
        e.preventDefault();
        if (activeSlot === 'title') {
          setActiveSlot('description');
          setIsEditing(true);
        } else if (activeSlot === 'resource') {
          const targetItem = filteredItems[focusedIndex];
          if (targetItem) {
            toggleSelection(targetItem);
          }
        } else if (activeSlot === 'date') {
          dateInputRef.current?.focus();
          try { dateInputRef.current?.showPicker(); } catch (e) { }
          setFocusedIndex(0);
        }
        else if (activeSlot === 'time') {
          if (isTimeEditing) {
            setIsTimeEditing(false);
            setActiveSlot('submit');
            setIsEditing(true);
          } else {
            const targetTimeOpt = timeOptions[focusedIndex].id;
            if (targetTimeOpt === 'anytime') {
              setIsAnytime(true);
              setActiveSlot('submit');
              setIsEditing(true);
            } else {
              setIsAnytime(false);
              setIsTimeEditing(true);
            }
          }
        }
        else if (activeSlot === 'submit') {
          handleCreate();
        }
        setFocusedIndex(0);
      } else { setIsEditing(true); e.preventDefault(); }
    }
  }, [activeSlot, slots, types, selectedType, selectedItem, filteredItems, title, time, scheduleType, isEditing, focusedIndex, onClose, handleCreate, modeOptions, timeOptions, repeatOptions, isMac, isPickerActive, isAnytime, isTimeEditing, hourText, minText, amPm]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  useEffect(() => {
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      if (isTimeEditing) { setIsTimeEditing(false); return true; }
      if (isEditing) { setIsEditing(false); return true; }
      onClose();
      return true;
    });
    return unregister;
  }, [isTimeEditing, isEditing, onClose]);

  return (
    <div
      className="fixed inset-0 z-[999999] flex justify-center items-start pt-[10vh] sm:pt-[12vh] px-4 pb-4 sm:px-6 sm:pb-6 backdrop-blur-[2px] bg-black/10"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          const hasUnsavedData = title.trim() !== '' || description.trim() !== '' || selectedItems.length > 0;
          if (!hasUnsavedData) {
            onClose();
          }
        }
      }}
    >
      <style>{hideNativeIconsStyle}</style>

      <div className={`relative flex justify-center w-full pointer-events-none ${isEmbedded ? '' : 'sm:translate-x-[60px]'}`}>
        <div
          ref={workspaceRef}
          tabIndex={-1}
          className={`w-full pointer-events-auto flex flex-col relative outline-none rounded-2xl border bg-[var(--color-modalBg)] border-[#2f3142] shadow-[0_30px_80px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] text-white`}
          style={{ maxWidth: '940px', maxHeight: 'calc(100vh - 10vh - 48px)' }}
        >
          {/* ── STICKY HEADER ── */}
          <div className="flex flex-col w-full px-5 pt-5 pb-3 shrink-0 border-b border-white/[0.04] bg-white/[0.01] rounded-t-2xl">
            <div className="flex items-center justify-between w-full">
              <h2 className="text-base font-semibold text-neutral-100">Create a task</h2>
              <button onClick={onClose} className="p-2 text-neutral-500 hover:text-neutral-300 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                <FaTimes size={16} />
              </button>
            </div>
          </div>
 
          {/* ── SCROLLABLE CONTENT AREA ── */}
          <div 
            className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4 shrink-0 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* Title Field */}
            <div className="flex flex-col gap-1.5 w-full">
              <div className="flex items-center gap-1">
                <span className="text-[13px] font-semibold text-neutral-400">Title</span>
                {!title && <span className="text-red-500/50 text-[13px] font-bold select-none shrink-0">*</span>}
              </div>
              <input
                ref={titleInputRef}
                type="text"
                placeholder="Task title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={() => { setActiveSlot('title'); setIsEditing(true); }}
                className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-neutral-500 transition-colors rounded-xl px-3 py-2 text-[14px] text-neutral-200 placeholder:text-neutral-500 focus:outline-none"
              />
            </div>

            {/* Description Field */}
            <div className="flex flex-col gap-1.5 w-full relative">
              <span className="text-[13px] font-semibold text-neutral-400">Description</span>
              <textarea
                ref={descriptionRef as any}
                placeholder="Add description..."
                value={description}
                onChange={handleDescriptionChange}
                onFocus={() => { setActiveSlot('description'); setIsEditing(true); }}
                className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-neutral-500 transition-colors rounded-xl px-3 py-2.5 text-[14px] text-neutral-300 placeholder:text-neutral-600 focus:outline-none min-h-[120px] resize-none custom-scrollbar"
              />
              
              {mentionQuery !== null && mentionSuggestions.length > 0 && (
                <div className="absolute left-3 bottom-full mb-2 w-[260px] bg-[var(--color-innerPopupBg)] border border-[#2f3142] rounded-xl shadow-2xl z-[99999] overflow-hidden p-1 flex flex-col gap-0.5">
                  {mentionSuggestions.map((item, idx) => {
                    const isSelected = idx === mentionIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectMention(item)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                          isSelected ? 'bg-white/10 text-white font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="shrink-0">{getItemIcon(item)}</div>
                        <span className="text-[12.5px] truncate flex-1">{getSingleItemName(item)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedItems.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 px-1">
                  {selectedItems.map(item => (
                    <div key={item.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[12px] text-neutral-300">
                      {getItemIcon(item)}
                      <span className="truncate max-w-[150px]">{getSingleItemName(item)}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleSelection(item); }}
                        className="text-neutral-500 hover:text-neutral-300 ml-1 focus:outline-none cursor-pointer"
                      >
                        <FaTimes size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── STICKY FOOTER ── */}
          <div className={`shrink-0 px-4 sm:px-5 py-3 bg-[var(--color-modalBg)] flex flex-col gap-2.5 relative ${activeSlot && ['time', 'resource'].includes(activeSlot) ? 'z-[300]' : 'z-30'} rounded-b-2xl`}>
            <div className="flex flex-wrap items-center gap-3 w-full">
              <div className="relative shrink-0">
                <button
                  id="mode-button"
                  type="button"
                  onClick={() => {
                    setActiveSlot('mode');
                    setIsEditing(false);
                  }}
                  className={`px-3 py-1.5 flex items-center gap-1.5 rounded-xl border transition-all text-[13px] font-medium cursor-pointer ${
                    activeSlot === 'mode'
                      ? 'bg-white/[0.04] border-white text-white shadow-md ring-1 ring-white/20'
                      : 'bg-white/[0.03] border-white/[0.05] text-neutral-300 hover:brightness-110'
                  }`}
                >
                  <FiRepeat size={14} className="text-[var(--color-iconDefault)]" />
                  <span>Once</span>
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="ml-1 text-[var(--color-iconDefault)]"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>

              <div className="relative shrink-0">
                <button
                  onClick={() => { setActiveSlot('date'); setIsEditing(false); setTimeout(() => { try { dateInputRef.current?.showPicker(); } catch (e) { dateInputRef.current?.focus(); } }, 50); }}
                  className={`px-3 py-1.5 flex items-center gap-1.5 rounded-xl border transition-all text-[13px] font-medium ${
                    activeSlot === 'date'
                      ? 'bg-white/[0.04] border-white text-white shadow-md ring-1 ring-white/20'
                      : 'bg-white/[0.03] border-white/[0.05] hover:brightness-110 text-neutral-200'
                  }`}
                >
                  <FaRegCalendarAlt size={14} className="text-[var(--color-iconDefault)]" />
                  <span>{date ? format(new Date(date), 'do MMM yyyy') : 'Date'}</span>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={date}
                    onChange={(e) => { setDate(e.target.value); if (dateInputRef.current) { dateInputRef.current.blur(); } setActiveSlot('time'); setIsEditing(true); setIsTimeEditing(true); setFocusedIndex(0); }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                        e.preventDefault();
                        e.stopPropagation();
                        const currentIndex = slots.indexOf('date');
                        const targetSlot = e.key === 'ArrowRight' ? slots[currentIndex + 1] : slots[currentIndex - 1];
                        if (targetSlot) {
                          if (dateInputRef.current) dateInputRef.current.blur();
                          setActiveSlot(targetSlot);
                          setFocusedIndex(0);
                          setIsEditing(true);
                          if (targetSlot === 'time') {
                            setIsTimeEditing(true);
                          }
                        }
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none w-full h-full"
                  />
                </button>
              </div>

              <div className="relative shrink-0">
                <div
                  onClick={() => {
                    if (activeSlot !== 'time') {
                      setActiveSlot('time');
                      setIsEditing(true);
                      setFocusedIndex(0);
                      if (timeOptions.length === 1) setIsTimeEditing(true);
                    } else {
                      setIsTimeEditing(!isTimeEditing);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 font-medium text-[13px] cursor-pointer ${
                    activeSlot === 'time'
                      ? 'bg-white/[0.04] border-white text-white shadow-md ring-1 ring-white/20'
                      : 'bg-white/[0.03] border-white/[0.05] text-neutral-300 hover:brightness-110'
                  }`}
                >
                  <FiClock className={activeSlot === 'time' ? 'text-blue-400' : 'text-[var(--color-iconDefault)]'} size={14} />
                  {isAnytime ? (
                    <span>Anytime</span>
                  ) : (
                    activeSlot === 'time' ? (
                      <InlineTimeInput
                        value={time}
                        onChange={setTime}
                        onExitRight={() => {
                          setActiveSlot('resource');
                          setIsEditing(true);
                        }}
                        onExitLeft={() => {
                          setActiveSlot('date');
                          workspaceRef.current?.focus();
                        }}
                      />
                    ) : (
                      <span>{formatTime12Hour(time)}</span>
                    )
                  )}
                </div>

                {activeSlot === 'time' && isEditing && !isTimeEditing && timeOptions.length > 1 && (
                  <div className="absolute bottom-full mb-2 left-0 w-[180px] rounded-xl shadow-2xl z-[150] bg-[var(--color-editorBg)] border border-[#2f3142] overflow-hidden">
                    {timeOptions.map((opt, idx) => {
                      const isFocused = idx === focusedIndex;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => {
                            if (opt.id === 'anytime') {
                              setIsAnytime(true);
                              setActiveSlot('submit');
                              setIsEditing(true);
                              setTimeout(() => {
                                document.getElementById('final-save-button')?.focus();
                              }, 50);
                            } else {
                              setIsAnytime(false);
                              setIsTimeEditing(true);
                            }
                          }}
                          onMouseEnter={() => setFocusedIndex(idx)}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors text-left ${isFocused ? 'bg-white/10 text-white font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
                        >
                          <div className="shrink-0 mt-0.5">{opt.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{opt.label}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <CustomTimePicker
                  value={time}
                  onChange={(val) => { setTime(val); }}
                  isOpen={activeSlot === 'time' && isTimeEditing}
                  setIsOpen={(open) => { setIsTimeEditing(open); if (!open) { setActiveSlot('resource'); setIsEditing(true); } }}
                  focusedColumn={isTimeEditing && activeSlot === 'time' ? focusedIndex : -1}
                />
              </div>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (activeSlot !== 'resource') {
                      setActiveSlot('resource');
                      setIsEditing(true);
                      setFocusedIndex(0);
                    } else {
                      setIsEditing(!isEditing);
                    }
                  }}
                  className={`px-3 py-1.5 flex items-center gap-1.5 rounded-xl border transition-all text-[13px] font-medium cursor-pointer ${
                    activeSlot === 'resource'
                      ? 'bg-white/[0.04] border-white text-white shadow-md ring-1 ring-white/20'
                      : 'bg-white/[0.03] border-white/[0.05] text-neutral-300 hover:brightness-110'
                  }`}
                >
                  <FiLink size={14} className={selectedItems.length > 0 ? 'text-purple-400' : 'text-[var(--color-iconDefault)]'} />
                  <span>
                    {selectedItems.length > 0
                      ? `${selectedItems.length} File${selectedItems.length > 1 ? 's' : ''} Attached`
                      : 'Attach saved'}
                  </span>
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="ml-1 text-[var(--color-iconDefault)]">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {activeSlot === 'resource' && isEditing && (
                  <div
                    className="absolute bottom-full mb-2 left-[120px] w-[600px] max-w-[80vw] rounded-2xl shadow-2xl z-[99999] bg-[var(--color-innerPopupBg)] border border-[#2f3142] overflow-hidden flex flex-col font-sans"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Search and Header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] bg-white/[0.01]">
                      <div className="flex items-center gap-2 flex-1">
                        <FiSearch size={14} className="text-neutral-400 shrink-0" />
                        <input
                          id="resource-search-input"
                          type="text"
                          placeholder="Search and select files..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="flex-1 bg-transparent border-none text-neutral-200 placeholder:text-neutral-500 focus:outline-none text-[13px] font-medium min-w-0 pl-1"
                        />
                        {searchQuery && (
                          <button onClick={() => setSearchQuery('')} className="text-neutral-500 hover:text-neutral-300 transition-colors shrink-0">
                            <FaTimes size={10} />
                          </button>
                        )}
                      </div>

                      {selectedItems.length > 0 && (
                        <div className="flex items-center gap-2 px-2.5 py-1 bg-white/[0.03] border border-white/[0.08] rounded-lg text-[11px] text-neutral-400 font-normal">
                          <span className="shrink-0">{selectedItems.length} selected</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setActiveSlot(null);
                        }}
                        className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer ml-1"
                      >
                        <FaTimes size={12} />
                      </button>
                    </div>

                    {/* Columns Layout */}
                    <div className="flex h-[320px]">
                      {/* Sidebar Categories */}
                      <div className="w-[150px] shrink-0 flex flex-col gap-0.5 py-2 px-1.5 border-r border-white/[0.04] bg-white/[0.01]">
                        {[
                          { key: 'all' as const, label: 'All', items: categoriesData.all, icon: (
                            <svg className="w-3.5 h-3.5 shrink-0 text-[var(--color-iconDefault)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="7" height="7" rx="1" />
                              <rect x="14" y="3" width="7" height="7" rx="1" />
                              <rect x="14" y="14" width="7" height="7" rx="1" />
                              <rect x="3" y="14" width="7" height="7" rx="1" />
                            </svg>
                          ) },
                          { key: 'note' as const, label: 'Notes', items: categoriesData.note, icon: <FiFileText size={14} className="text-[var(--color-iconDefault)] shrink-0" /> },
                          { key: 'snippet' as const, label: 'Snippets', items: categoriesData.snippet, icon: <FiCode size={14} className="text-[var(--color-iconDefault)] shrink-0" /> },
                          { key: 'link' as const, label: 'Links', items: categoriesData.link, icon: <FiLink size={14} className="text-[var(--color-iconDefault)] shrink-0" /> },
                          { key: 'prompt' as const, label: 'Prompts', items: categoriesData.prompt, icon: <LuSparkles size={14} className="text-[var(--color-iconDefault)] shrink-0" /> },
                          { key: 'automation' as const, label: 'Automations', items: categoriesData.automation, icon: <FiZap size={14} className="text-[var(--color-iconDefault)] shrink-0" /> },
                          { key: 'agent' as const, label: 'Chat Agents', items: categoriesData.agent, icon: <FaRobot size={14} className="text-[var(--color-iconDefault)] shrink-0" /> },
                        ].map(col => {
                          const isActive = selectedCategory === col.key;
                          return (
                            <button
                              key={col.key}
                              type="button"
                              onClick={() => setSelectedCategory(col.key)}
                              className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all ${
                                isActive
                                  ? 'bg-white/[0.06] text-white font-medium border border-white/10'
                                  : 'text-neutral-400 hover:bg-white/[0.03] hover:text-white border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {col.icon}
                                <span className="text-[12px] truncate font-normal">{col.label}</span>
                              </div>
                              <span className="text-[9.5px] text-neutral-500 tabular-nums font-normal">{col.items.length}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Items List */}
                      <div className="flex-1 flex flex-col bg-transparent overflow-hidden">
                        {(() => {
                          const activeCol = [
                            { key: 'all' as const, label: 'All', items: categoriesData.all },
                            { key: 'note' as const, label: 'Notes', items: categoriesData.note },
                            { key: 'snippet' as const, label: 'Snippets', items: categoriesData.snippet },
                            { key: 'link' as const, label: 'Links', items: categoriesData.link },
                            { key: 'prompt' as const, label: 'Prompts', items: categoriesData.prompt },
                            { key: 'automation' as const, label: 'Automations', items: categoriesData.automation },
                            { key: 'agent' as const, label: 'Chat Agents', items: categoriesData.agent },
                          ].find(c => c.key === selectedCategory)!;

                          return (
                            <>
                              <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/[0.04] bg-white/[0.01] shrink-0">
                                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">{activeCol.label}</span>
                                <span className="text-neutral-700 font-normal">·</span>
                                <span className="text-[10px] text-neutral-500 tabular-nums font-normal">{activeCol.items.length} items</span>
                              </div>
                              <div ref={resultsContainerRef} className="overflow-y-auto custom-scrollbar flex flex-col flex-1">
                                {activeCol.items.length === 0 ? (
                                  <div className="h-full flex items-center justify-center">
                                    <span className="text-[12px] text-neutral-600 font-normal">Nothing here</span>
                                  </div>
                                ) : (
                                  activeCol.items.map((item: ConvertibleItem, idx: number) => {
                                    const isSelected = selectedItems.some(i => i.id === item.id);
                                    const isFocused = idx === focusedIndex;
                                    return (
                                      <div
                                        key={item.id}
                                        data-idx={idx}
                                        onClick={() => toggleSelection(item)}
                                        className={`flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] cursor-pointer transition-all ${
                                          isSelected
                                            ? 'bg-white/[0.04] text-neutral-100'
                                            : isFocused
                                              ? 'bg-white/[0.08] text-white font-medium'
                                              : 'text-neutral-300 hover:bg-white/[0.02] hover:text-white'
                                        }`}
                                      >
                                        <div className={`w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center shrink-0 transition-all ${
                                          isSelected
                                            ? 'bg-neutral-300 border-neutral-400 text-neutral-900'
                                            : 'border-neutral-600 bg-transparent'
                                        }`}>
                                          {isSelected && <FaCheck size={7} />}
                                        </div>
                                        <div className="flex-1 flex items-center min-w-0 gap-2">
                                          {getItemIcon(item)}
                                          <span className="text-[12.5px] font-normal leading-snug truncate">
                                            {getSingleItemName(item)}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative ml-auto shrink-0">
                <style>{`
                  @keyframes todoSuccessFadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                `}</style>
                <button
                  id="final-save-button"
                  type="button"
                  onClick={handleCreate}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltipPos({
                      top: rect.top + window.scrollY - 76,
                      left: rect.right - 320,
                    });
                    setShowTooltip(true);
                  }}
                  onMouseLeave={() => setShowTooltip(false)}
                  disabled={saveStatus === 'saving'}
                  className={`px-5 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 font-semibold text-[13px] ${saveStatus === 'saved'
                    ? 'bg-white/[0.03] border-emerald-500/40 text-emerald-400 ring-1 ring-emerald-500/30 cursor-default'
                    : saveStatus === 'saving'
                      ? 'bg-white/[0.03] border-white/[0.05] text-white/60 opacity-70 cursor-not-allowed'
                      : activeSlot === 'submit' || document.activeElement?.id === 'final-save-button'
                        ? 'bg-[#5e6ad2] border-[#5e6ad2]/80 shadow-md ring-2 ring-[#5e6ad2]/40 text-white brightness-110'
                        : 'bg-[#5e6ad2] border-[#5e6ad2]/50 text-white shadow-sm hover:brightness-110'
                    }`}
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <svg className="animate-spin" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      <span>{isEditMode && !createMore ? 'Updating…' : 'Creating…'}</span>
                    </>
                  ) : saveStatus === 'saved' ? (
                    <>
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-emerald-400">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{isEditMode && !createMore ? 'Updated successfully!' : 'Created successfully!'}</span>
                    </>
                  ) : (
                    <span>{isEditMode && !createMore ? 'Update' : 'Create Task'}</span>
                  )}
                </button>

                {showTooltip && ReactDOM.createPortal(
                  <div
                    style={{
                      position: 'absolute',
                      top: `${tooltipPos.top}px`,
                      left: `${tooltipPos.left}px`,
                    }}
                    className="bg-[#1c1d27] border border-[#2f3142] rounded-xl p-3 shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-[999999] flex flex-col gap-2.5 min-w-[320px] text-[12px] font-sans text-white pointer-events-none"
                  >
                    <div className="flex items-center gap-3 text-neutral-300">
                      <div className="flex gap-1 min-w-[125px] shrink-0">
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">{isMac ? 'Cmd' : 'Ctrl'}</kbd>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Enter</kbd>
                      </div>
                      <span className="text-neutral-400 text-left whitespace-nowrap">to save task</span>
                    </div>
                    <div className="flex items-center gap-3 text-neutral-300">
                      <div className="flex gap-1 min-w-[125px] shrink-0">
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">{isMac ? 'Cmd' : 'Ctrl'}</kbd>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Shift</kbd>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Enter</kbd>
                      </div>
                      <span className="text-neutral-400 text-left whitespace-nowrap">to save and create new</span>
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
      <button id="trigger-save-internal" type="button" onClick={handleCreate} className="hidden" />
    </div >
  );
};

export default CreateTodoView;
