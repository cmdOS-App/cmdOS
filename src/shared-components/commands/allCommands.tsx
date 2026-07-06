import { useUIStore } from '../uiStateManager';
// === IMPORTS ===
import React from 'react';
import { SiGooglecalendar } from 'react-icons/si';
import { FaLayerGroup, FaGoogleDrive, FaPlay, FaClock } from 'react-icons/fa';
import type { CommandModule, CommandContext } from './types';
import { EntitySelection } from './types';

// === CONSTANTS AND COMMAND DECLARATIONS ===
export const CreateNoteCommand: CommandModule = {
  id: 'createnotes',
  label: 'Create Notes',
  prefix: '/createnotes',
  keywords: ['create note', 'new note', 'note', 'notes', 'add note', 'save note'],
  behavior: 'instant',

  execute: context => {
    const { services } = context;



    // Navigate to note editor
    services.navigation({
      kind: 'noteEditor',
      noteProps: {
        category: 'note', // Corrected to 'note'
        onClose: () => services.navigation({ kind: 'home' }),
      },
    });
  },
};

export const CreateSnippetCommand: CommandModule = {
  id: 'createsnippet',
  label: 'Create Snippet',
  prefix: '/createsnippet',
  keywords: ['create snippet', 'new snippet', 'snippet', 'snippets', 'add snippet', 'save snippet'],
  behavior: 'instant',

  execute: context => {
    const { services } = context;



    // Navigate to note editor with category snippet
    services.navigation({
      kind: 'noteEditor',
      noteProps: {
        category: 'snippet', // Corrected to 'snippet'
        onClose: () => services.navigation({ kind: 'home' }),
      },
    });
  },
};

export const CreateLinkCommand: CommandModule = {
  id: 'createlinks',
  label: 'Create Smart Links',
  prefix: '/createlinks',
  keywords: ['create link', 'new link', 'link', 'links', 'save link', 'saved link'],
  behavior: 'instant',

  execute: context => {
    const { services } = context;



    // Navigate to link editor
    services.navigation({
      kind: 'linkEditor',
      linkProps: {
        onClose: () => services.navigation({ kind: 'home' }),
      },
    });
  },
};

export const CreateSessionCommand: CommandModule = {
  id: 'createsession',
  label: 'Create Tab group',
  prefix: '/createsession',
  keywords: ['create tab group', 'new tab group', 'tab group', 'tab groups', 'session', 'sessions'],
  behavior: 'instant',

  execute: context => {
    const { services } = context;
    services.navigation({
      kind: 'sessionEditor',
      sessionProps: {
        onClose: () => services.navigation({ kind: 'home' }),
      },
    });
  },
};

export const AgentCommand: CommandModule = {
  id: 'agent',
  label: 'Create an Automation Agent',
  prefix: '/agent',
  keywords: ['agent', 'ai agent', 'assistant', 'ai assistant', 'automation'],
  behavior: 'instant',

  execute: context => {
    const { services } = context;

    // Clear transient automation storage keys
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.remove(['automation_recording_state', 'automation_draft_steps_count']);
    }

    // Navigate to agent panel
    services.navigation({
      kind: 'agentPanel',
      agentProps: {
        onClose: () => services.navigation({ kind: 'home' }),
      },
    });
  },
};

const SYSTEM_PROMPT =
  'Act as a professional AI personal assistant and calendar manager. Access the Google Calendar. Optimize the schedule for productivity, allow for breaks, and manage conflicts. When scheduling, consider existing appointments.';

export const CalendarCommand: CommandModule = {
  id: 'calendar',
  // Use a colored icon component instance
  icon: <SiGooglecalendar className="text-[#4285F4]" />,
  label: 'Calendar Event AI Agent',
  prefix: '/calendar',
  keywords: ['calendar', 'schedule', 'meeting', 'event', 'agenda', 'ai', 'call'],
  behavior: 'instant',

  execute: async context => {
    const { services, prompt } = context;

    const fullPrompt = prompt ? `${SYSTEM_PROMPT} ${prompt}` : SYSTEM_PROMPT;

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(
        {
          action: 'open_tab_with_auto_submit',
          url: 'https://gemini.google.com/app',
          autoSubmit: {
            kind: 'gemini', // Use 'gemini' generic handler since we are providing the full prompt here
            prompt: fullPrompt,
          },
          forceNewTab: true,
        },
        response => {
          if (!response || !response.ok) {
            console.error('Failed to open calendar agent:', response?.error);
            if (services.toast) services.toast('Failed to open Calendar Agent', 'error');
          }
        },
      );
    } else {
      if (services.toast) services.toast('Chrome runtime not available', 'error');
    }
  },
};

export const DashboardCommand: CommandModule = {
  id: 'dashboard',
  label: 'Dashboard',
  prefix: '/dashboard',
  keywords: [],
  behavior: 'instant',
  execute: context => {
    window.open(context.services.urls.dashboard, '_blank');
  },
};

export const TutorialsCommand: CommandModule = {
  id: 'tutorials',
  label: 'Tutorials',
  prefix: '/tutorials',
  keywords: [],
  behavior: 'instant',
  execute: context => {
    window.open(context.services.urls.docs, '_blank');
  },
};

export const CreateOrganizationCommand: CommandModule = {
  id: 'createWorkspace',
  label: 'Create New Organization',
  prefix: '/createorganization',
  keywords: ['create', 'organization', 'new', 'team', 'org', 'add org', 'new org'],
  behavior: 'instant',
  description: 'Create a new organization',

  execute: context => {
    // Navigate to in-app create organization panel
    context.services.navigation({ kind: 'createWorkspace' });
  },
};

export const SwitchOrganizationCommand: CommandModule = {
  id: 'switchorganization',
  label: 'Switch Organization',
  prefix: '/switchorganization',
  keywords: ['switch', 'organization', 'change', 'team', 'org', 'switch org'],
  behavior: 'instant',
  description: 'Switch to a different organization',

  execute: context => {
    // Navigate to organizations list view
    context.services.navigation({ kind: 'allItems', itemType: 'organizations' });
  },
};

export const StoreCommand: CommandModule = {
  id: 'store',
  label: 'Automation Store',
  prefix: '/store',
  description: 'Browse and install automation modules by category.',
  keywords: [
    'store',
    'app store',
    'module store',
    'apps',
    'app',
    'connect app',
    'connect',
    'integration',
    'integrations',
    'marketplace',
  ],
  behavior: 'locked',
  icon: FaLayerGroup,

  execute: () => {
    // Logic moved to search-integrated store view
  },
};

export const ShortcutsCommand: CommandModule = {
  id: 'shortcuts',
  label: 'Command List',
  prefix: '/shortcuts',
  keywords: ['commands', 'list commands', 'shortcuts', 'hotkeys', 'help'],
  behavior: 'instant',

  execute: ({ services }) => {
    services.navigation({ kind: 'commandList' });
  },
};

export const SavedAutomationsCommand: CommandModule = {
  id: 'saved-automation',
  label: 'My Automations',
  prefix: '/saved',
  description: 'Manage and run your saved automation library.',
  keywords: ['saved automations', 'my automations', 'workflows'],
  behavior: 'locked',
  icon: FaPlay,

  execute: () => {
    // Logic handled in search-integrated view via 'locked' behavior.
    // When this command is activated, the Searchbar switches to SavedAutomationsPanel.
  },
};


export const DeleteSnippetCommand: CommandModule = {
  id: 'delete_snippet',
  label: 'Delete Note',
  prefix: '/deletenote',
  keywords: ['delete', 'remove', 'trash', 'dlt', 'del', 'discard', 'snippet', 'note', 'delete note', 'remove note'],
  behavior: 'entity',
  scope: 'snippet',
  action: 'delete',

  execute: (context, entity) => {
    if (!entity?.snippet || !entity?.workspace) {
      context.services.toast('No note selected', 'error');
      return;
    }

    // TODO: Delegate to central Workspace Manager / API
    console.warn('DeleteNoteCommand: Delegating to WorkspaceManager (Not implemented in UI yet)');
  },
};

export const DeleteLinkCommand: CommandModule = {
  id: 'delete_link',
  label: 'Delete Link',
  prefix: '/deletelink',
  keywords: ['delete', 'remove', 'trash', 'dlt', 'del', 'discard', 'link', 'links', 'delete link', 'remove link'],
  behavior: 'entity',
  scope: 'snippet',
  action: 'delete',

  execute: (context, entity) => {
    if (!entity?.snippet || !entity?.workspace) {
      context.services.toast('No link selected', 'error');
      return;
    }

    // TODO: Delegate to central Workspace Manager / API
    console.warn('DeleteLinkCommand: Delegating to WorkspaceManager (Not implemented in UI yet)');
  },
};

export const ProfileCommand: CommandModule = {
  id: 'profile',
  label: 'Profile',
  prefix: '/profile',
  keywords: ['profile', 'account', 'user', 'settings', 'me'],
  behavior: 'instant',
  execute: context => {
    window.open(context.services.urls.profile, '_blank');
  },
};

export const ShowAllNotesCommand: CommandModule = {
  id: 'show_all_notes',
  label: 'Show all notes',
  prefix: '/notes',
  keywords: ['notes', 'all notes', 'show notes', 'list notes', 'view notes', 'my notes'],
  behavior: 'instant',

  execute: context => {
    // Navigate to the all notes view
    context.services.navigation({ kind: 'allItems', itemType: 'notes' });
  },
};

export const ShowAllLinksCommand: CommandModule = {
  id: 'show_all_links',
  label: 'Show all links',
  prefix: '/links',
  keywords: ['links', 'all links', 'show links', 'list links', 'view links', 'tabgroups', 'tab groups', 'my links'],
  behavior: 'instant',

  execute: context => {
    // Navigate to the all links view
    context.services.navigation({ kind: 'allItems', itemType: 'links' });
  },
};


export const ToggleAutoExpandCommand: CommandModule = {
  id: 'toggle_auto_expand',
  label: 'Toggle Auto Expand Folders',
  prefix: '/autoexpand',
  keywords: ['toggle', 'expand', 'auto', 'folder'],
  behavior: 'instant',

  execute: context => {
    const current = useUIStore.getState().isAutoExpandMode;
    const newValue = !current;

    context.services.setIsAutoExpandMode(newValue);
    context.services.toast(`Auto Expand Folders is now ${newValue ? 'ON' : 'OFF'}.`, 'success');
  },
};

export const RefreshCommand: CommandModule = {
  id: 'refresh',
  label: 'Refresh',
  prefix: '/refresh',
  keywords: ['refresh', 'reload', 'Refresh', 'reload page'],
  behavior: 'instant',

  execute: async context => {
    // Relying on IndexedDB state, we only need to reload tabs.
    const chromeAny = (window as any)?.chrome;

    // Reload all open AltS_search_newtab instances and the active tab
    if (chromeAny?.tabs?.query && chromeAny?.tabs?.reload) {
      chromeAny.tabs.query({}, (tabs: chrome.tabs.Tab[]) => {
        if (chromeAny.runtime?.lastError) {
          console.warn('[RefreshCommand] Error querying tabs:', chromeAny.runtime.lastError);
          // Fallback to window.location.reload() if available
          if (typeof window !== 'undefined' && window.location) {
            window.location.reload();
          }
          return;
        }

        const extensionId = chromeAny.runtime?.id;
        const tabsToReload: { id: number; isActive: boolean }[] = [];

        tabs.forEach(tab => {
          if (!tab.id) return;

          const isNewTab =
            tab.url &&
            (tab.url.includes('chrome://newtab') ||
              (extensionId &&
                tab.url.includes(`chrome-extension://${extensionId}/pages/AltS_search_newtab/index.html`)) ||
              tab.url.includes('AltS_search_newtab/index.html'));

          if (isNewTab || tab.active) {
            tabsToReload.push({ id: tab.id, isActive: !!tab.active });
          }
        });

        // Sort so that we reload background tabs first, and reload the active tab last
        tabsToReload.sort((a, b) => (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0));

        let activeTabReloaded = false;
        tabsToReload.forEach(t => {
          chromeAny.tabs.reload(t.id);
          if (t.isActive) {
            activeTabReloaded = true;
          }
        });

        if (!activeTabReloaded && typeof window !== 'undefined' && window.location) {
          window.location.reload();
        }
      });
    } else {
      // chrome.tabs API not available, use window.location.reload() as fallback
      if (typeof window !== 'undefined' && window.location) {
        window.location.reload();
      }
    }
  },
};

export const UploadDriveCommand: CommandModule = {
  id: 'upload_drive',
  label: 'Upload Drive',
  prefix: '/upload_drive',
  keywords: ['upload', 'drive', 'google', 'files', 'cloud'],
  behavior: 'locked',
  icon: FaGoogleDrive,

  execute: async context => {
    const { files } = context;
    const { toast } = context.services;

    if (!files || files.length === 0) {
      toast('Please attach files first (Ctrl+U or paste)', 'error');
      return;
    }

    toast(`Starting upload flow for ${files.length} file(s)...`, 'info');

    try {
      // Use the unified auto-submit flow
      chrome.runtime.sendMessage(
        {
          action: 'open_tab_with_auto_submit',
          url: 'https://drive.google.com/drive/my-drive',
          autoSubmit: {
            kind: 'drive',
            images: files,
          },
        },
        (response: any) => {
          if (chrome.runtime.lastError) {
            toast(`Upload failed: ${chrome.runtime.lastError.message}`, 'error');
          } else if (response?.ok) {
            // No need for "triggered" toast usually as the page is about to navigate
          } else {
            toast(response?.error || 'Failed to start upload flow', 'error');
          }
        },
      );
    } catch (err) {
      console.error('[UploadDriveCommand] Error sending files:', err);
      toast('Failed to start upload flow', 'error');
    }
  },
};

export const GitHubCreateIssueCommand: CommandModule = {
  id: 'github_create_issue',
  label: 'Create Issue',
  prefix: '/github-create-issue',
  keywords: ['github', 'issue', 'create issue', 'new issue'],
  behavior: 'instant',
  showInDashboard: false,
  category: 'thissite_action',

  isAvailable: webContext => {
    return (
      webContext?.site === 'github' &&
      webContext?.pageType === 'repository' &&
      !!webContext?.metadata?.owner &&
      !!webContext?.metadata?.repo
    );
  },

  execute: context => {
    // For direct link opening commands, execution is typically resolved via the tab context url in AltQ,
    // or by opening a tab. We provide an execute method that opens a tab.
    const url = GitHubCreateIssueCommand.url;
    if (url) {
      window.open(url, '_blank');
    }
  },

  getDynamicLabel: context => {
    // Label can be customized dynamically if we have context in the UI,
    // but the fallback label is 'Create Issue'.
    return 'Create Issue';
  },
};

export const GitHubCreatePRCommand: CommandModule = {
  id: 'github_create_pr',
  label: 'Create Pull Request',
  prefix: '/github-create-pr',
  keywords: ['github', 'pr', 'pull request', 'create pr', 'new pr', 'compare'],
  behavior: 'instant',
  showInDashboard: false,
  category: 'thissite_action',

  isAvailable: webContext => {
    return (
      webContext?.site === 'github' &&
      webContext?.pageType === 'repository' &&
      !!webContext?.metadata?.owner &&
      !!webContext?.metadata?.repo
    );
  },

  execute: context => {
    const url = GitHubCreatePRCommand.url;
    if (url) {
      window.open(url, '_blank');
    }
  },

  getDynamicLabel: context => {
    return 'Create Pull Request';
  },
};

export const GitHubOpenSettingsCommand: CommandModule = {
  id: 'github_open_settings',
  label: 'Open Repository Settings',
  prefix: '/github-open-settings',
  keywords: ['github', 'settings', 'repository settings', 'repo settings'],
  behavior: 'instant',
  showInDashboard: false,
  category: 'thissite_action',

  isAvailable: webContext => {
    return (
      webContext?.site === 'github' &&
      webContext?.pageType === 'repository' &&
      !!webContext?.metadata?.owner &&
      !!webContext?.metadata?.repo
    );
  },

  execute: context => {
    const url = GitHubOpenSettingsCommand.url;
    if (url) {
      window.open(url, '_blank');
    }
  },

  getDynamicLabel: context => {
    return 'Open Repository Settings';
  },
};

export const GitHubOrgCommand: CommandModule = {
  id: 'github_org_action',
  label: 'GitHub Org Action',
  prefix: '/github-org',
  keywords: ['github', 'organization', 'org', 'repository', 'open repository', 'create issue', 'settings'],
  behavior: 'instant',
  showInDashboard: false,
  category: 'thissite_action',

  isAvailable: webContext => {
    return (
      webContext?.site === 'github' && webContext?.pageType === 'organization' && !!webContext?.metadata?.organization
    );
  },

  execute: context => {
    // Resolved directly within AltQ UI dropdowns/palettes.
  },
};

// === CATEGORIZED ARRAYS ===
export const INSTANT_COMMANDS: CommandModule[] = [
  CreateNoteCommand,
  CreateSnippetCommand,
  CreateLinkCommand,
  CreateSessionCommand,
  AgentCommand,
  CalendarCommand,
  DashboardCommand,
  TutorialsCommand,
  CreateOrganizationCommand,
  SwitchOrganizationCommand,
  ShortcutsCommand,
  ProfileCommand,
  ShowAllNotesCommand,
  ShowAllLinksCommand,
  ToggleAutoExpandCommand,
  RefreshCommand,
  GitHubCreateIssueCommand,
  GitHubCreatePRCommand,
  GitHubOpenSettingsCommand,
  GitHubOrgCommand,
];

export const ENTITY_COMMANDS: CommandModule[] = [DeleteSnippetCommand, DeleteLinkCommand];

export const LOCKED_COMMANDS: CommandModule[] = [StoreCommand, SavedAutomationsCommand, UploadDriveCommand];

// Helper to determine the browser scheme and icon host
const getBrowserInfo = (): { scheme: string; iconHost: string; name: string } => {
  const userAgent = navigator.userAgent.toLowerCase();

  // Edge and Brave have specific schemes
  if (userAgent.includes('edg/') || userAgent.includes('edge')) {
    return { scheme: 'edge://', iconHost: 'microsoft.com', name: 'Edge' };
  }

  if ((navigator as any).brave && (navigator as any).brave.isBrave) {
    return { scheme: 'brave://', iconHost: 'brave.com', name: 'Brave' };
  }

  // Default to Chrome (handles Comet, Atlas, and standard Chrome)
  return { scheme: 'chrome://', iconHost: 'google.com', name: 'Chrome' };
};

const BROWSER_INFO = getBrowserInfo();
export const BROWSER_NAME = BROWSER_INFO.name;

export const QUERY_COMMANDS: CommandModule[] = [
  // --- Core Search Commands (Used for Omnibox Prefix Routing) ---
  {
    id: 'search_notes',
    label: 'Search Notes',
    prefix: '/n',
    behavior: 'query',
    keywords: ['notes', 'search notes', 'find notes'],
    category: 'core',
  },
  {
    id: 'search_links',
    label: 'Search Links',
    prefix: '/l',
    behavior: 'query',
    keywords: ['links', 'search links', 'find links'],
    category: 'core',
  },
  {
    id: 'search_commands',
    label: 'Search Commands',
    prefix: '/c',
    behavior: 'query',
    keywords: ['commands', 'search commands', 'find commands', 'run command'],
    category: 'core',
  },

  // --- Internal Browser Pages ---
  {
    id: 'history',
    //   behavior: \'query\',
    label: 'History',
    prefix: '/history',
    urlTemplate: `${BROWSER_INFO.scheme}history`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['history', 'recent', 'past', 'visited', 'core'],
    category: 'browser',
  },
  {
    id: 'extensions',
    //   behavior: \'query\',
    label: 'Extensions',
    prefix: '/extensions',
    urlTemplate: `${BROWSER_INFO.scheme}extensions`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['extensions', 'plugins', 'addons', 'browser extensions', 'core'],
    category: 'browser',
  },

  {
    id: 'downloads',
    //   behavior: \'query\',
    label: 'Downloads',
    prefix: '/downloads',
    urlTemplate: `${BROWSER_INFO.scheme}downloads`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['downloads', 'files', 'downloaded', 'core'],
    category: 'browser',
  },

  {
    id: 'passwords',
    //   behavior: \'query\',
    label: 'Passwords',
    prefix: '/passwords',
    urlTemplate: `${BROWSER_INFO.scheme}password-manager`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['passwords', 'credentials', 'login', 'manager', 'core'],
    category: 'browser',
  },
  {
    id: 'flags',
    //   behavior: \'query\',
    label: 'Flags',
    prefix: '/flags',
    urlTemplate: `${BROWSER_INFO.scheme}flags`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['flags', 'experimental', 'features', 'dev'],
    category: 'browser',
  },
  {
    id: 'inspect',
    //   behavior: \'query\',
    label: 'Inspect',
    prefix: '/inspect',
    urlTemplate: `${BROWSER_INFO.scheme}inspect`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['inspect', 'developer', 'tools', 'debug', 'dev'],
    category: 'browser',
  },
  {
    id: 'version',
    //   behavior: \'query\',
    label: 'Version',
    prefix: '/version',
    urlTemplate: `${BROWSER_INFO.scheme}version`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['version', 'build', 'about', 'info', 'dev'],
    category: 'browser',
  },
  {
    id: 'tasks',
    //   behavior: \'query\',
    label: 'Tasks',
    prefix: '/tasks',
    urlTemplate: `${BROWSER_INFO.scheme}tasks`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['tasks', 'manager', 'processes', 'perf', 'performance'],
    category: 'browser',
  },
  {
    id: 'gpu',
    //   behavior: \'query\',
    label: 'GPU',
    prefix: '/gpu',
    urlTemplate: `${BROWSER_INFO.scheme}gpu`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['gpu', 'graphics', 'acceleration', 'perf', 'performance'],
    category: 'browser',
  },
  {
    id: 'dino',
    //   behavior: \'query\',
    label: 'Dino Game',
    prefix: '/dino',
    urlTemplate: `${BROWSER_INFO.scheme}dino`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['dino', 'game', 't-rex', 'offline', 'fun'],
    category: 'browser',
  },
  {
    id: 'about',
    //   behavior: \'query\',
    label: 'About Browser',
    prefix: '/about',
    urlTemplate: `${BROWSER_INFO.scheme}about`,
    iconHost: BROWSER_INFO.iconHost,
    keywords: ['about', 'list', 'urls', 'chrome urls', 'all'],
    category: 'browser',
  },

  // --- Existing Commands ---
  {
    id: 'ai',
    //   behavior: \'query\',
    label: 'All AI Chat Agents',
    prefix: '/ai',
    urlTemplate: 'about:blank#ai:{query}',
    iconHost: 'chatgpt.com',
    keywords: ['ai', 'assistants', 'all ai', 'meta'],
    category: 'ai',
  },
  {
    id: 'gpt',
    //   behavior: \'query\',
    label: 'ChatGPT',
    prefix: '/gpt',
    urlTemplate: 'https://chatgpt.com/?q={query}',
    iconHost: 'chatgpt.com',
    autoSubmit: 'chatgpt',
    keywords: ['chatgpt', 'gpt', 'openai', 'ai', 'chat', 'assistant'],
    category: 'ai',
  },
  {
    id: 'claude',
    //   behavior: \'query\',
    label: 'Claude',
    prefix: '/claude',
    urlTemplate: 'https://claude.ai/new?q={query}',
    iconHost: 'claude.ai',
    autoSubmit: 'claude',
    keywords: ['claude', 'anthropic', 'ai', 'assistant', 'chat'],
    category: 'ai',
  },
  {
    id: 'gemini',
    //   behavior: \'query\',
    label: 'Gemini',
    prefix: '/gemini',
    // Gemini does not accept prompt params; we open the app and auto-inject via background
    urlTemplate: 'https://gemini.google.com/app',
    iconHost: 'gemini.google.com',
    autoSubmit: 'gemini',
    keywords: ['gemini', 'google ai', 'bard', 'chat', 'assistant', 'ai'],
    category: 'ai',
  },
  {
    id: 'perplexity',
    //   behavior: \'query\',
    label: 'Perplexity',
    prefix: '/p',
    urlTemplate: 'https://www.perplexity.ai/search?q={query}',
    iconHost: 'perplexity.ai',
    autoSubmit: 'perplexity',
    keywords: ['perplexity', 'ai', 'answers', 'search assistant', 'ask'],
    category: 'ai',
  },

].filter((cmd: any) => {
  // Filter out Chrome-specific commands for non-Chrome browsers (Edge, Brave)
  const chromeSpecificIds = ['passwords', 'tasks', 'inspect', 'dino'];
  if (BROWSER_INFO.scheme !== 'chrome://' && chromeSpecificIds.includes(cmd.id)) {
    return false;
  }
  return true;
}) as CommandModule[];

export const ALL_COMMANDS: CommandModule[] = [
  ...INSTANT_COMMANDS,
  ...ENTITY_COMMANDS,
  ...LOCKED_COMMANDS,
  ...QUERY_COMMANDS,
];

