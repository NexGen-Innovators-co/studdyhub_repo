import React, { useState, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  File,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  FolderPlus,
  Move,
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { DocumentFolder, FolderTreeNode } from '../../types/Folder';
import { cn } from '../../lib/utils';

export interface FolderTreeProps {
  folderTree: FolderTreeNode[];
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folder: DocumentFolder) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveFolder: (folderId: string) => void;
  expandedFolders: Set<string>;
  onToggleExpand: (folderId: string) => void;
  documentCounts?: Record<string, number>;
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  folderTree,
  selectedFolderId,
  onFolderSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
  expandedFolders,
  onToggleExpand,
  documentCounts = {},
}) => {
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);

  const renderFolderNode = useCallback((node: FolderTreeNode) => {
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = selectedFolderId === node.id;
    const isHovered = hoveredFolderId === node.id;
    const hasChildren = node.children.length > 0;
    const docCount = documentCounts[node.id] || 0;

    return (
      <div key={node.id} className="select-none">
        <div
          className={cn(
            'group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all duration-200',
            isSelected
              ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
          )}
          style={{ paddingLeft: `${node.level * 16 + 8}px` }}
          onMouseEnter={() => setHoveredFolderId(node.id)}
          onMouseLeave={() => setHoveredFolderId(null)}
        >
          {/* Expand/Collapse Icon */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(node.id);
              }}
              className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}

          {/* Folder Icon */}
          <div
            onClick={() => onFolderSelect(node.id)}
            className="flex items-center gap-2 flex-1 min-w-0"
          >
            {isExpanded ? (
              <FolderOpen className="h-5 w-5 flex-shrink-0" style={{ color: node.color }} />
            ) : (
              <Folder className="h-5 w-5 flex-shrink-0" style={{ color: node.color }} />
            )}

            {/* Folder Name */}
            <span className="text-sm font-medium truncate flex-1">
              {node.name}
            </span>

            {/* Document Count Badge */}
            {docCount > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                {docCount}
              </span>
            )}
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity',
                  isHovered && 'opacity-100'
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onCreateFolder(node.id)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                New Subfolder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRenameFolder(node)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMoveFolder(node.id)}>
                <Move className="h-4 w-4 mr-2" />
                Move
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDeleteFolder(node.id)}
                className="text-red-600 dark:text-red-400"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Render Children */}
        {isExpanded && hasChildren && (
          <div className="mt-1">
            {node.children.map((child) => renderFolderNode(child))}
          </div>
        )}
      </div>
    );
  }, [
    expandedFolders,
    selectedFolderId,
    hoveredFolderId,
    documentCounts,
    onToggleExpand,
    onFolderSelect,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder,
    onMoveFolder,
  ]);

  return (
    <div className="space-y-1">
      {/* All Documents (Root) */}
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all duration-200',
          selectedFolderId === null
            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
            : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
        )}
        onClick={() => onFolderSelect(null)}
      >
        <File className="h-5 w-5" />
        <span className="text-sm font-medium">All Documents</span>
      </div>

      {/* Folder Tree */}
      {folderTree.length > 0 ? (
        folderTree.map((node) => renderFolderNode(node))
      ) : (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No folders yet</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCreateFolder(null)}
            className="mt-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create First Folder
          </Button>
        </div>
      )}
    </div>
  );
};