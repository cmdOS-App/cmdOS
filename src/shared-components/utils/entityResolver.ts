import { db } from '../../storage/indexDB/dbConfig';
import { extractSnippetIdFromCompoundId } from './idGenerator';

/**
 * Resolves an entity across all Dexie IndexedDB tables by its ID (or compound ID).
 * This replaces the legacy `chrome.storage.local` search logic.
 */
export async function resolveEntityById(compoundId: string) {
  if (!compoundId) return null;
  const actualId = extractSnippetIdFromCompoundId(compoundId);
  if (!actualId) return null;

  try {
    const note = await db.notes.get(actualId);
    if (note) return { entity: note, type: 'note' };

    const link = await db.links.get(actualId);
    if (link) return { entity: link, type: 'link' };

    const snippet = await db.snippets.get(actualId);
    if (snippet) return { entity: snippet, type: 'snippet' };

    const session = await db.sessions.get(actualId);
    if (session) return { entity: session, type: 'session' };

    const automation = await db.automations.get(actualId);
    if (automation) return { entity: automation, type: 'automation' };

    const chatAgent = await db.chatAgents.get(actualId);
    if (chatAgent) return { entity: chatAgent, type: 'chatAgent' };

    const aiPrompt = await db.aiPrompts.get(actualId);
    if (aiPrompt) return { entity: aiPrompt, type: 'aiPrompt' };

    const todo = await db.todos.get(actualId);
    if (todo) return { entity: todo, type: 'todo' };

    const command = await db.commands.get(actualId);
    if (command) return { entity: command, type: 'command' };

  } catch (error) {
    console.error('[entityResolver] Error resolving entity:', error);
  }

  return null;
}
