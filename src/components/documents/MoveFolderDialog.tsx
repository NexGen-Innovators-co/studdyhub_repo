// src/components/MoveFolderDialog.tsx
import React, { useState, useCallback, Dispatch, SetStateAction } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FolderTree, FolderTreeProps } from './FolderTree';
import { DocumentFolder, FolderTreeNode } from '../../types/Folder';
import { on } from 'events';
import { D } from 'node_modules/framer-motion/dist/types.d-Cjd591yU';

interface MoveFolderDialogProps {
    // Existing props
    open: boolean;
    onOpenChange: (open: boolean) => void;
    folder: DocumentFolder | null;
    onMoveFolder: (folderId: string, targetParentId: string | null) => void;
    folderTree: any;
    onCreateFolder: (parentId: string | null) => void;
    onRenameFolder: (folde: DocumentFolder) => void;
    onDeleteFolder: (folderId: string) => void;
    expandedFolders: Set<string>;
    onToggleExpand: (folderId: string) => void;
}

export const MoveFolderDialog: React.FC<MoveFolderDialogProps> = ({
    open,
    onOpenChange,
    folder,
    onMoveFolder,
    folderTree,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder,
    expandedFolders,
    onToggleExpand,
}) => {
    const [targetFolderId, setTargetFolderId] = useState<string | null>(null);

    const handleMove = useCallback(() => {
        if (!folder) return;
        onMoveFolder(folder.id, targetFolderId);
        onOpenChange(false);
    }, [folder, targetFolderId, onMoveFolder, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Move Folder</DialogTitle>
                    <DialogDescription>
                        Select the new parent folder for <strong>{folder?.name}</strong>.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="newParentFolder" className="text-right">
                            New Parent Folder
                        </Label>
                        <div className="col-span-3">
                            {/* Render folder tree here */}
                            {folderTree && folder && (
                                <FolderTree
                                    folderTree={folderTree}
                                    selectedFolderId={targetFolderId}
                                    onFolderSelect={setTargetFolderId}
                                    onCreateFolder={onCreateFolder}
                                    onRenameFolder={onRenameFolder}
                                    onMoveFolder={() => { }} // Placeholder, as moving is handled by this dialog
                                    onDeleteFolder={onDeleteFolder}
                                    expandedFolders={expandedFolders}
                                    onToggleExpand={onToggleExpand}
                                />
                            )}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="submit" onClick={handleMove}>Move</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};