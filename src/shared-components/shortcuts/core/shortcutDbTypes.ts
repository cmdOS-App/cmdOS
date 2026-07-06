export type ShortcutReferenceType = 'note' | 'link' | 'snippet' | 'command' | 'automation' | 'module';

export interface UserShortcutRecord {
  id: string; // Unique generated ID
  userId: string; // User ID; defaults to 'local_user' if not signed in / available
  trigger: string; // e.g. "/note", "/spotify" (normalized string starting with "/")
  referenceId: string; // ID of the note, snippet, or command ID
  referenceType: ShortcutReferenceType;
  updatedAt: number;
}
