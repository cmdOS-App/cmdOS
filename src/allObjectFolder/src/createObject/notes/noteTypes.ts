/**
 * @file noteTypes.ts
 * @description Defines TypeScript interfaces for the Note entity, 
 * including representations for stored notes and input validation models.
 * 
 * @usage
 * ```ts
 * import type { NoteRecord, CreateNoteInput } from './noteTypes';
 * ```
 */

export interface NoteRecord {

  id: string;
  workspaceId: string;
  folderId: string | null;

  title: string;
  body: string;
  tagIds: string[];

  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface CreateNoteInput {
  workspaceId?: string;
  folderId?: string | null;
  title: string;
  body: string;
  tagIds?: string[];
}

export interface UpdateNoteInput {
  title?: string;
  body?: string;
  workspaceId?: string;
  folderId?: string | null;
  tagIds?: string[];
  expectedUpdatedAt?: number;
}
