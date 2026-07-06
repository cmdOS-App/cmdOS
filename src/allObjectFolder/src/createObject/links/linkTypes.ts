/**
 * @file linkTypes.ts
 * @description Defines TypeScript types and interfaces for Link items and records.
 * Includes data models for browser tab representations and UI layouts.
 * 
 * @usage
 * ```ts
 * import type { LinkRecord, LinkItem } from './linkTypes';
 * ```
 */

export interface LinkItem {

  id: string;
  title?: string;
  name?: string;
  url: string;
  favIconUrl?: string;
  source?: 'tab' | 'custom' | 'note' | 'link' | 'history' | 'bookmark';
  originalData?: any;
}

export type SelectedLink = LinkItem;

export interface LinkRecord {
  id: string;
  workspaceId: string;
  folderId: string | null;

  title: string;
  urls: LinkItem[];
  tagIds: string[];

  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface CreateLinkInput {
  id?: string;
  workspaceId?: string;
  folderId?: string | null;
  title: string;
  urls: LinkItem[];
  tagIds?: string[];
}

export interface UpdateLinkInput {
  title?: string;
  urls?: LinkItem[];
  workspaceId?: string;
  folderId?: string | null;
  tagIds?: string[];
  expectedUpdatedAt?: number;
}

export type BrowserTab = {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
  windowId: number;
  active: boolean;
  highlighted?: boolean;
  index?: number;
};

// Content bar tab type
export type ContentTab = 'Current Tabs' | 'Selected tabs' | 'All saved files';
