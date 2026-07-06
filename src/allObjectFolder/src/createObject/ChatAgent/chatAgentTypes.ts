/**
 * @file chatAgentTypes.ts
 * @description Defines the TypeScript types and interfaces for the ChatAgent entity,
 * representing saved AI conversation setups and multi-model configurations.
 * 
 * @usage
 * ```ts
 * import type { ChatAgentRecord, CreateChatAgentInput } from './chatAgentTypes';
 * ```
 */

export interface ChatAgentRecord {

  id: string;
  workspaceId: string;
  folderId: string | null;

  title: string;
  urls: string[]; // URLs contain the cmd_select_status=true param to infer models
  tagIds: string[];

  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface CreateChatAgentInput {
  workspaceId?: string;
  folderId?: string | null;
  title: string;
  urls: string[];
  tagIds?: string[];
}

export interface UpdateChatAgentInput {
  title?: string;
  urls?: string[];
  workspaceId?: string;
  folderId?: string | null;
  tagIds?: string[];
}
