/**
 * @file aiPromptTypes.ts
 * @description Defines the typescript interfaces and types for AI Prompts.
 * These types include fields for workspaces, folders, tags, associated model URLs, and metadata.
 * 
 * @usage
 * ```ts
 * import type { AiPromptRecord, CreateAiPromptInput } from './aiPromptTypes';
 * ```
 */

export interface AiPromptRecord {

  id: string;
  workspaceId: string;
  folderId: string | null;
  title: string;
  prompt: string;
  rules?: string;
  modelUrls: Record<string, string>;
  favIconUrl?: string;
  tagIds: string[];
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface CreateAiPromptInput {
  workspaceId?: string;
  folderId?: string | null;
  title: string;
  prompt: string;
  rules?: string;
  modelUrls: Record<string, string>;
  favIconUrl?: string;
  tagIds?: string[];
}

export interface UpdateAiPromptInput {
  title?: string;
  prompt?: string;
  rules?: string;
  modelUrls?: Record<string, string>;
  favIconUrl?: string;
  workspaceId?: string;
  folderId?: string | null;
  tagIds?: string[];
}
