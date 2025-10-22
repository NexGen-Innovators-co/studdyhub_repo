import { Document } from './Document';

export interface DocumentFolder {
  id: string;
  user_id: string;
  name: string;
  parent_folder_id: string | null;
  color: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  documentCount?: number;
  subfolderCount?: number;
  isExpanded?: boolean;
}

export interface DocumentFolderItem {
  id: string;
  folder_id: string;
  document_id: string;
  added_at: string;
}

export interface FolderTreeNode extends DocumentFolder {
  children: FolderTreeNode[];
  documents: string[];
  path: string[];
  level: number;
}

export interface FolderWithDocuments extends DocumentFolder {
  documents: Document[];
}

export interface CreateFolderInput {
  name: string;
  parent_folder_id?: string | null;
  color?: string;
  description?: string;
}

export interface UpdateFolderInput {
  name?: string;
  parent_folder_id?: string | null;
  color?: string;
  description?: string;
}
