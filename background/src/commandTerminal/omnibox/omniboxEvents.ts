/**
 * @file omniboxEvents.ts
 * @description Handles Chrome omnibox API events and interactions.
 */
import 'webextension-polyfill';
import { handleAiTabMessage } from '../../browserWindows/chatRuntimeEngine';
import { getAllUserShortcuts } from '../../../../src/shared-components/shortcuts/core/shortcutDbData';

// ─── Registry: short key → content type ──────────────────────────────────────
// Locked for now. Will be user-configurable in the future.
const OMNIBOX_REGISTRY: Record<string, 'note' | 'link' | 'command'> = {
  n: 'note',
  l: 'link',
  c: 'command',
};

export function setupOmnibox() {
  console.log('[Omnibox] Module loaded and event listeners attached.');
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

/**
 * Queries the 'cmdOS' IndexedDB database which is used in the offline version
 * of the extension.
 */
function queryIndexedDB<T>(storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open('cmdOS');
      request.onerror = () => {
        console.error(`[Omnibox] Failed to open cmdOS DB for ${storeName}`, request.error);
        resolve([]);
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          console.warn(`[Omnibox] Store ${storeName} not found in cmdOS`);
          resolve([]);
          return;
        }
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
        getAllRequest.onerror = () => {
          console.error(`[Omnibox] Error querying store ${storeName}`, getAllRequest.error);
          resolve([]);
        };
      };
    } catch (e) {
      console.error(`[Omnibox] Exception opening IndexedDB:`, e);
      resolve([]);
    }
  });
}

/** Fetches the local DB-backed data used by omnibox suggestions. */
async function getLocalData() {
  const [links, notes, commands, userShortcuts] = await Promise.all([
    queryIndexedDB<any>('links'),
    queryIndexedDB<any>('notes'),
    queryIndexedDB<any>('commands'),
    getAllUserShortcuts(),
  ]);
  
  // Format them to match the structure the rest of the code expects
  const formattedLinks = links.map(l => ({
    ...l,
    category: l.isSession ? 'tabgroup' : 'link',
    key: l.title,
    snippet_id: l.id,
    // Provide a JSON string so `extractUrls` can parse it just like cloud snippets
    value: JSON.stringify({ urls: (l.urls || []).map((u: any) => u.url) })
  }));

  const formattedNotes = notes.map(n => ({
    ...n,
    category: 'note',
    key: n.title,
    snippet_id: n.id,
    value: n.body
  }));

  console.log("[Omnibox] Raw Links", links);
  console.log("[Omnibox] Formatted Links", formattedLinks);

  console.log("[Omnibox] Raw Notes", notes);
  console.log("[Omnibox] Formatted Notes", formattedNotes);

  return { links: formattedLinks, notes: formattedNotes, commands, userShortcuts };
}

/** Walk all teams/workspaces/folders and collect snippets matching a filter */
function collectSnippets(teams: any[], filter: (s: any) => boolean): any[] {
  const results: any[] = [];
  
  const traverseFolder = (folder: any) => {
    for (const s of folder.snippets || []) {
      if (filter(s)) results.push(s);
    }
    for (const sub of folder.folders || []) {
      traverseFolder(sub);
    }
  };

  for (const team of teams) {
    for (const ws of team.workspaces || []) {
      for (const s of ws.workspace_snippets || []) {
        if (filter(s)) results.push(s);
      }
      for (const folder of ws.folders || []) {
        traverseFolder(folder);
      }
    }
  }
  return results;
}

/** Best-effort title for a snippet — covers all known field names */
function snippetTitle(snippet: any): string {
  return snippet.key || snippet.title || snippet.name || snippet.snippet_id || 'Untitled';
}

/** Extracts URLs from a link or tabgroup snippet */
function extractUrls(snippet: any): string[] {
  try {
    if (!snippet.value) return [];
    
    // Value could be a JSON string like:
    // { "urls": ["http...", "http..."] }
    const parsed = typeof snippet.value === 'string' ? JSON.parse(snippet.value) : snippet.value;
    
    // 1. New TabGroup format: { urls: ["http...", "http..."] }
    if (parsed && Array.isArray(parsed.urls)) {
      return parsed.urls.filter((u: any) => typeof u === 'string');
    }
    
    // 2. Simple array of URLs: ["http...", "http..."]
    if (Array.isArray(parsed)) {
      return parsed.filter((u: any) => typeof u === 'string');
    }
    
    return [];
  } catch (err) {
    console.error('[Omnibox] Failed to parse snippet value for URLs:', snippet.value);
    return [];
  }
}

/** 
 * Reads the cached tree from local storage.
 * myCachedAllData is populated by the New Tab page on load/sync.
 */
async function getTeams(): Promise<any[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['myCachedAllData'], (res) => {
      resolve(Array.isArray(res.myCachedAllData) ? res.myCachedAllData : []);
    });
  });
}

// ─── Input parser ─────────────────────────────────────────────────────────────

/** Builds the dynamic registry from local commands */
function buildRegistry(commands: any[]): Record<string, 'note' | 'link' | 'command'> {
  const registry: Record<string, 'note' | 'link' | 'command'> = {
    c: 'command', // fallback default
    n: 'note',    // fallback default
    l: 'link',    // fallback default
  };
  
  for (const cmd of commands) {
    if (cmd.id === 'search_notes' && cmd.prefix) {
      registry[cmd.prefix.replace('/', '').toLowerCase()] = 'note';
    } else if (cmd.id === 'search_links' && cmd.prefix) {
      registry[cmd.prefix.replace('/', '').toLowerCase()] = 'link';
    } else if (cmd.id === 'search_commands' && cmd.prefix) {
      registry[cmd.prefix.replace('/', '').toLowerCase()] = 'command';
    }
  }
  return registry;
}

/** "l bvc" → { prefix: 'l', type: 'link', query: 'bvc' } */
function parseInput(text: string, registry: Record<string, 'note' | 'link' | 'command'>): { prefix: string; type: 'note' | 'link' | 'command' | null; query: string } {
  const trimmed = text.trim();
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx !== -1) {
    const prefix = trimmed.slice(0, spaceIdx).toLowerCase();
    if (registry[prefix]) {
      const query = trimmed.slice(spaceIdx + 1).trim();
      return { prefix, type: registry[prefix], query };
    }
  } else {
    const prefix = trimmed.toLowerCase();
    if (registry[prefix]) {
      return { prefix, type: registry[prefix], query: '' };
    }
  }
  
  // If no specific prefix is matched, default to treating the ENTIRE text as a command trigger
  return { prefix: '', type: 'command', query: trimmed };
}

// ─── Omnibox event listeners ──────────────────────────────────────────────────

// Show help text when user types 'c' + space
chrome.omnibox.onInputStarted.addListener(async () => {
  const localData = await getLocalData();
  const registry = buildRegistry(localData.commands || []);
  const keys = Object.entries(registry)
    .map(([k, v]) => `${k}=>${v}s`)
    .join(', ');
  console.log('[Omnibox] started, registry:', keys);
  chrome.omnibox.setDefaultSuggestion({
    description: `cmdOS: type prefix + name (${keys})`,
  });
});

// Live suggestions from real storage data — only extension results shown
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  // Fetch both from Cloud cached tree and Local IndexedDB (offline)
  const [teams, localData] = await Promise.all([getTeams(), getLocalData()]);
  
  const registry = buildRegistry(localData.commands || []);
  const { type, query } = parseInput(text, registry);
  console.log('[Omnibox] changed:', { text, type, query });

  if (!type || !query) {
    const notePrefix = Object.keys(registry).find(k => registry[k] === 'note') || 'n';
    const linkPrefix = Object.keys(registry).find(k => registry[k] === 'link') || 'l';
    chrome.omnibox.setDefaultSuggestion({
      description: `cmdOS: type <match>${linkPrefix} &lt;link-name&gt;</match> or <match>${notePrefix} &lt;note-name&gt;</match>`,
    });
    suggest([]);
    return;
  }

  console.log('[Omnibox] Data loaded. Cloud Teams:', teams.length, 'Local Links:', localData.links.length, 'Local Notes:', localData.notes.length);
  
  console.log("[Omnibox] Cloud teams", teams);
  console.log("[Omnibox] Local links", localData.links);
  console.log("[Omnibox] Local notes", localData.notes);

  if (type === 'link' || type === 'note') {
    const userShortcuts = localData.userShortcuts || [];
    const shortcutMatches = userShortcuts.filter((s: any) => 
      s.referenceType === type && (s.trigger || '').toLowerCase().includes(query.toLowerCase())
    );

    if (shortcutMatches.length === 0) {
      chrome.omnibox.setDefaultSuggestion({
        description: `No ${type} shortcuts found matching <match>${query}</match>`,
      });
      suggest([]);
      return;
    }

    const extractSnippetId = (compoundId: string): string => {
      if (!compoundId || !compoundId.includes('-')) return compoundId;
      const parts = compoundId.split('-');
      return parts.slice(-1)[0].length > 8 ? parts.slice(-5).join('-') : compoundId;
    };

    const getTitle = (s: any) => {
      const rawId = extractSnippetId(s.referenceId);
      let target;
      if (type === 'link') {
        target = localData.links.find((l:any) => l.id === rawId || l.snippet_id === rawId);
      } else if (type === 'note') {
        target = localData.notes.find((n:any) => n.id === rawId || n.snippet_id === rawId);
      }
      
      // Fallback to cloud if not found locally
      if (!target && teams) {
        const cloudMatches = collectSnippets(teams, (cs) => cs.id === rawId || cs.snippet_id === rawId);
        target = cloudMatches[0];
      }
      
      return target ? snippetTitle(target) : 'Unknown ' + type;
    };

    const prefixChar = Object.keys(registry).find(k => registry[k] === type) || (type === 'link' ? 'l' : 'n');

    chrome.omnibox.setDefaultSuggestion({
      description: `Run shortcut: <match>${shortcutMatches[0].trigger}</match> (Opens ${type}: ${getTitle(shortcutMatches[0])})`,
    });

    const suggestions = shortcutMatches.map((s: any) => ({
      content: `${prefixChar} ${s.trigger.replace('/', '')}`,
      description: `Run shortcut: <match>${s.trigger}</match> (Opens ${type}: ${getTitle(s)})`,
    }));
    
    suggest(suggestions);
  } else if (type === 'command') {
    const spaceIdx = query.indexOf(' ');
    const commandKey = spaceIdx !== -1 ? query.slice(0, spaceIdx).toLowerCase() : query.toLowerCase();
    const prompt = spaceIdx !== -1 ? query.slice(spaceIdx + 1) : '';

    const matches = (localData.commands || []).filter(c => {
      const matchLabel = (c.label || '').toLowerCase().includes(commandKey);
      const matchPrefix = (c.prefix || '').toLowerCase().includes(commandKey);
      const matchId = (c.id || '').toLowerCase().includes(commandKey);
      const matchKeyword = (c.keywords || []).some((k: string) => k.toLowerCase().includes(commandKey));
      return matchLabel || matchPrefix || matchId || matchKeyword;
    });

    const shortcutMatches = (localData.userShortcuts || []).filter((s: any) => 
      (s.trigger || '').toLowerCase().includes(commandKey)
    );

    if (matches.length === 0 && shortcutMatches.length === 0) {
      chrome.omnibox.setDefaultSuggestion({
        description: `No commands or shortcuts found matching <match>${commandKey}</match>`,
      });
      suggest([]);
      return;
    }

    if (shortcutMatches.length > 0) {
      chrome.omnibox.setDefaultSuggestion({
        description: `Run shortcut: <match>${shortcutMatches[0].trigger}</match>`,
      });
    } else if (matches.length > 0) {
      chrome.omnibox.setDefaultSuggestion({
        description: `Run command: <match>${matches[0].label || matches[0].id}</match> ${prompt ? `with prompt: <match>${prompt}</match>` : ''}`,
      });
    }

    const commandSuggestions = matches.map((c) => ({
      content: `c ${c.id} ${prompt}`,
      description: `Run command: <match>${c.label || c.id}</match> ${prompt ? `with prompt: <match>${prompt}</match>` : ''}`,
    }));
    
    const shortcutSuggestions = shortcutMatches.map((s: any) => ({
      content: `c ${s.trigger.replace('/', '')}`, // if they type c test, it will execute it!
      description: `Run shortcut: <match>${s.trigger}</match> (Opens ${s.referenceType})`,
    }));

    suggest([...shortcutSuggestions, ...commandSuggestions]);
  }
});

// Execute on Enter — links open directly from background (no React page needed)
chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const [teams, localData] = await Promise.all([getTeams(), getLocalData()]);
  const registry = buildRegistry(localData.commands || []);
  const { type, query } = parseInput(text, registry);
  
  console.log('[Omnibox] entered:', { text, type, query, disposition });
  if (!type || !query) return;

  const extUrl = chrome.runtime.getURL('AltS_search_newtab/index.html');
  const userShortcuts = localData.userShortcuts || [];

  // Helper to execute a user shortcut
  const executeShortcut = (shortcut: any) => {
    console.log('[Omnibox] Executing user shortcut:', shortcut);
    
    // Extract raw snippet ID from compound ID (e.g. folderId-UUID)
    const extractSnippetId = (compoundId: string): string => {
      if (!compoundId || !compoundId.includes('-')) return compoundId;
      const parts = compoundId.split('-');
      // UUIDs have 5 parts separated by dashes
      return parts.slice(-1)[0].length > 8 ? parts.slice(-5).join('-') : compoundId;
    };
    
    const rawSnippetId = extractSnippetId(shortcut.referenceId);

    if (shortcut.referenceType === 'note') {
      const targetUrl = `${extUrl}?open_note=true&noteid=${rawSnippetId}`;
      if (disposition === 'currentTab') {
        chrome.tabs.update({ url: targetUrl });
      } else {
        chrome.tabs.create({ url: targetUrl, active: disposition !== 'newBackgroundTab' });
      }
      return true;
    }
    if (shortcut.referenceType === 'link') {
      // Find the link to get its URL using rawSnippetId
      let link = localData.links.find((l: any) => l.id === rawSnippetId || l.snippet_id === rawSnippetId);
      
      // Fallback to cloud if not found locally
      if (!link && teams) {
        const cloudMatches = collectSnippets(teams, (cs) => cs.id === rawSnippetId || cs.snippet_id === rawSnippetId);
        link = cloudMatches[0];
      }

      if (link) {
        const urls = extractUrls(link);
        if (urls && urls.length > 0) {
          urls.forEach((url: string, index: number) => {
            if (index === 0 && disposition === 'currentTab') {
              chrome.tabs.update({ url });
            } else {
              chrome.tabs.create({ url, active: false });
            }
          });
          return true;
        }
      }
      
      console.warn('[Omnibox] Link not found or has no URLs for shortcut:', shortcut);
    }
    return false;
  };

  // 1. Try User Shortcuts First (if typing a command, or if typing specifically for a note/link)
  let shortcutMatch = null;
  if (type === 'command') {
    // If command, search all shortcuts
    shortcutMatch = userShortcuts.find((s: any) => s.trigger === `/${query}` || s.trigger === query);
  } else if (type === 'note') {
    // If note, search note shortcuts
    shortcutMatch = userShortcuts.find((s: any) => s.referenceType === 'note' && (s.trigger === `/${query}` || s.trigger === query));
  } else if (type === 'link') {
    // If link, search link shortcuts
    shortcutMatch = userShortcuts.find((s: any) => s.referenceType === 'link' && (s.trigger === `/${query}` || s.trigger === query));
  }

  if (shortcutMatch && executeShortcut(shortcutMatch)) {
    return;
  }

  // If no shortcut matched for 'link' or 'note', do a generic search fallback in new tab
  if (type === 'link' || type === 'note') {
    console.warn(`[Omnibox] No ${type} shortcut found for query:`, query);
    chrome.tabs.create({
      url: `chrome://newtab?search=${encodeURIComponent(query)}`,
    });
    return;
  } else if (type === 'command') {
    const spaceIdx = query.indexOf(' ');
    const commandKey = spaceIdx !== -1 ? query.slice(0, spaceIdx).toLowerCase() : query.toLowerCase();
    const prompt = spaceIdx !== -1 ? query.slice(spaceIdx + 1) : '';

    const matches = (localData.commands || []).filter(c => {
      const matchLabel = (c.label || '').toLowerCase().includes(commandKey);
      const matchPrefix = (c.prefix || '').toLowerCase().includes(commandKey);
      const matchId = (c.id || '').toLowerCase().includes(commandKey);
      const matchKeyword = (c.keywords || []).some((k: string) => k.toLowerCase().includes(commandKey));
      return matchLabel || matchPrefix || matchId || matchKeyword;
    });
    
    const found = matches[0];
    if (!found) {
      console.warn('[Omnibox] No command found for query:', commandKey);
      chrome.tabs.create({ url: `chrome://newtab?search=${encodeURIComponent(query)}` });
      return;
    }

    console.log('[Omnibox] Selected command', found);

    // Hardcoded maps because IndexedDB strips these properties from CommandRecord
    const AI_COMMANDS: Record<string, string> = {
      gpt: 'chatgpt',
      chatgpt: 'chatgpt',
      gemini: 'gemini',
      claude: 'claude',
      perplexity: 'perplexity'
    };

    const URL_COMMANDS: Record<string, string> = {
      google: 'https://google.com/search?q={query}',
      youtube: 'https://www.youtube.com/results?search_query={query}',
      history: 'chrome://history',
      downloads: 'chrome://downloads',
      extensions: 'chrome://extensions',
      settings: 'chrome://settings'
    };
    
    // 1. AI Command detection
    const aiKind = AI_COMMANDS[found.id];
    if (aiKind) {
      console.log(`[Omnibox] AI command detected (${aiKind}), routing to chatRuntimeEngine.`);
      let url = 'https://chatgpt.com';
      if (aiKind === 'gemini') url = 'https://gemini.google.com/app';
      if (aiKind === 'claude') url = 'https://claude.ai/new';
      if (aiKind === 'perplexity') url = 'https://www.perplexity.ai/';

      handleAiTabMessage(
        {
          action: 'open_tab_with_auto_submit',
          url: url,
          autoSubmit: { kind: aiKind, prompt: prompt },
          forceNewTab: disposition !== 'currentTab',
        },
        {} as any,
        () => {},
      );
      return;
    }

    // 2. URL Command detection
    const urlTemplate = URL_COMMANDS[found.id];
    if (urlTemplate) {
      let finalUrl = urlTemplate;
      if (prompt && finalUrl.includes('{query}')) {
        finalUrl = finalUrl.replace('{query}', encodeURIComponent(prompt));
      }
      
      console.log('[Omnibox] URL Command detected, navigating to:', finalUrl);
      if (disposition === 'currentTab') {
        chrome.tabs.update({ url: finalUrl });
      } else {
        chrome.tabs.create({ url: finalUrl, active: disposition !== 'newBackgroundTab' });
      }
      return;
    }

    // 3. Local UI Commands (createnote, deletelink, etc.)
    // Note: chrome://newtab strips query parameters sometimes! Let's use the actual extension URL!
    const extUrl = chrome.runtime.getURL('AltS_search_newtab/index.html');
    const targetUrl = `${extUrl}?omnibox=true&type=command&id=${found.id}${prompt ? `&query=${encodeURIComponent(prompt)}` : ''}`;
    
    if (disposition === 'currentTab') {
      chrome.tabs.update({ url: targetUrl });
    } else {
      chrome.tabs.create({ url: targetUrl, active: disposition !== 'newBackgroundTab' });
    }
  }
});
