import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  Check,
  Search,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { FolderTreeNode } from '../../types/Folder';
import { cn } from '../../lib/utils';

interface FolderSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderTree: FolderTreeNode[];
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  title?: string;
  description?: string;
  allowRoot?: boolean;
}

export const FolderSelector: React.FC<FolderSelectorProps> = ({
  open,
  onOpenChange,
  folderTree,
  selectedFolderId,
  onSelect,
  title = 'Select Folder',
  description = 'Choose a folder for your document',
  allowRoot = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [tempSelectedId, setTempSelectedId] = useState<string | null>(selectedFolderId);

  // Flatten folder tree for search
  const flatFolders = useMemo(() => {
    const flatten = (nodes: FolderTreeNode[], result: FolderTreeNode[] = []): FolderTreeNode[] => {
      nodes.forEach(node => {
        result.push(node);
        if (node.children.length > 0) {
          flatten(node.children, result);
        }
      });
      return result;
    };
    return flatten(folderTree);
  }, [folderTree]);

  // Filter folders based on search
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folderTree;

    const matchingIds = new Set(
      flatFolders
        .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .map(f => f.id)
    );

    // Include parent folders of matches
    const withParents = new Set(matchingIds);
    matchingIds.forEach(id => {
      const folder = flatFolders.find(f => f.id === id);
      if (folder) {
        folder.path.forEach(parentId => withParents.add(parentId));
      }
    });

    const filterTree = (nodes: FolderTreeNode[]): FolderTreeNode[] => {
      return nodes
        .filter(node => withParents.has(node.id))
        .map(node => ({
          ...node,
          children: filterTree(node.children),
        }));
    };

    return filterTree(folderTree);
  }, [folderTree, flatFolders, searchQuery]);

  const toggleExpand = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    onSelect(tempSelectedId);
    onOpenChange(false);
  };

  const renderFolderNode = (node: FolderTreeNode) => {
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = tempSelectedId === node.id;
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id}>
        <div
          className={cn(
            'flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all',
            isSelected
              ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'
          )}
          style={{ paddingLeft: `${node.level * 20 + 8}px` }}
          onClick={() => setTempSelectedId(node.id)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="p-0.5"
            >
              <ChevronRight
                className={cn(
                  'h-4 w-4 transition-transform',
                  isExpanded && 'rotate-90'
                )}
              />
            </button>
          ) : (
            <div className="w-5" />
          )}

          {isExpanded ? (
            <FolderOpen className="h-5 w-5 flex-shrink-0" style={{ color: node.color }} />
          ) : (
            <Folder className="h-5 w-5 flex-shrink-0" style={{ color: node.color }} />
          )}

          <span className="text-sm flex-1 truncate">{node.name}</span>

          {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
        </div>

        {isExpanded && hasChildren && (
          <div className="mt-1">
            {node.children.map(child => renderFolderNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {description}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search folders..."
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Folder List */}
          <ScrollArea className="h-[300px] border rounded-lg p-2">
            <div className="space-y-1">
              {allowRoot && (
                <div
                  className={cn(
                    'flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all',
                    tempSelectedId === null
                      ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'
                  )}
                  onClick={() => setTempSelectedId(null)}
                >
                  <Folder className="h-5 w-5" />
                  <span className="text-sm flex-1">Root / No Folder</span>
                  {tempSelectedId === null && <Check className="h-4 w-4" />}
                </div>
              )}

              {filteredFolders.length > 0 ? (
                filteredFolders.map(node => renderFolderNode(node))
              ) : (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <p className="text-sm">
                    {searchQuery ? 'No folders found' : 'No folders available'}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Select Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};