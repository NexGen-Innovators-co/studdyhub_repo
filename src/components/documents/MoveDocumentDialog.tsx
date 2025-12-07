// Create new file: components/documentUpload/MoveDocumentDialog.tsx

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Folder, Home, ChevronRight } from 'lucide-react';
import { Document } from '../../types/Document';
import { FolderTreeNode } from '../../types/Folder';

interface MoveDocumentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    document: Document | null;
    folderTree: FolderTreeNode[];
    onMoveDocument: (documentId: string, targetFolderId: string | null) => Promise<void>;
}

export const MoveDocumentDialog: React.FC<MoveDocumentDialogProps> = ({
    open,
    onOpenChange,
    document,
    folderTree,
    onMoveDocument,
}) => {
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [isMoving, setIsMoving] = useState(false);

    const handleMove = async () => {
        if (!document) return;

        setIsMoving(true);
        try {
            await onMoveDocument(document.id, selectedFolderId);
            onOpenChange(false);
            setSelectedFolderId(null);
        } catch (error) {
            //console.error('Error moving document:', error);
        } finally {
            setIsMoving(false);
        }
    };

    const renderFolderTree = (nodes: FolderTreeNode[], depth = 0) => {
        return nodes.map((node) => (
            <div key={node.id}> {/* Use node.id here */}
                <button
                    onClick={() => setSelectedFolderId(node.id)}
                    className={`w-full text-left px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${selectedFolderId === node.id
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : ''
                        }`}
                    style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
                >
                    <div className="flex items-center gap-2">
                        <Folder
                            className="h-4 w-4 flex-shrink-0"
                            style={{ color: node.color }}
                        />
                        <span className="truncate">{node.name}</span> {/* Use node.name here */}
                    </div>
                </button>
                {node.children.length > 0 && renderFolderTree(node.children, depth + 1)}
            </div>
        ));
    };

    if (!document) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Move Document</DialogTitle>
                    <DialogDescription>
                        Choose a destination folder for "{document.title}"
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Root folder option */}
                    <button
                        onClick={() => setSelectedFolderId(null)}
                        className={`w-full text-left px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${selectedFolderId === null
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : ''
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <Home className="h-4 w-4" />
                            <span>Root / No folder</span>
                        </div>
                    </button>

                    {/* Folder tree */}
                    <div className="max-h-96 overflow-y-auto space-y-1 border-t pt-2">
                        {folderTree.length > 0 ? (
                            renderFolderTree(folderTree)
                        ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                                No folders available
                            </p>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button
                            variant="outline"
                            onClick={() => {
                                onOpenChange(false);
                                setSelectedFolderId(null);
                            }}
                            disabled={isMoving}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleMove}
                            disabled={isMoving}
                        >
                            {isMoving ? 'Moving...' : 'Move Here'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};