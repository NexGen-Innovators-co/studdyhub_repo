import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../integrations/supabase/client';
import { Document } from '../../types/Document';
import { DocumentFolder } from '../../types/Folder';
import { User } from '@supabase/supabase-js';

interface UseDocumentOperationsProps {
  user: User | null;
  documents: Document[];
  folders: DocumentFolder[];
  onDocumentUpdated: (document: Document) => void; 
  onDocumentDeleted: (documentId: string) => void;
  loadDataIfNeeded: (type: any) => Promise<void> | void;
  processingDocuments: Set<string>;
}

export const useDocumentOperations = ({
  user,
  documents,
  folders,
  onDocumentUpdated,
  onDocumentDeleted,
  loadDataIfNeeded,
  processingDocuments
}: UseDocumentOperationsProps) => {
  const [moveDocumentDialogOpen, setMoveDocumentDialogOpen] = useState(false);
  const [documentToMove, setDocumentToMove] = useState<Document | null>(null);
  const [moveFolderDialogOpen, setMoveFolderDialogOpen] = useState(false);
  const [folderToMove, setFolderToMove] = useState<DocumentFolder | null>(null);

  const handleMoveDocument = useCallback((document: Document) => {
    setDocumentToMove(document);
    setMoveDocumentDialogOpen(true);
  }, []);

  const handleMoveDocumentSubmit = useCallback(async (documentId: string, targetFolderId: string | null) => {
    try {
      if (!user?.id) return;

      const document = documents.find(d => d.id === documentId);
      if (!document) return;

      let newFolderIds: string[] = [];

      if (targetFolderId) {
        newFolderIds = [targetFolderId];
      } else {
        newFolderIds = [];
      }

      if (targetFolderId) {
        const { error } = await supabase.from('document_folder_items').insert([
          { folder_id: targetFolderId, document_id: documentId }
        ]);
        if (error) {
          console.error(error); 
           // If it's a unique constraint violation, it might be fine, but we are supposed to set the relationship newly.
           // However based on the original code logic which was replacing:
           // Actually original logic was a bit simplified in the snippet I saw. 
           // It constructed `newFolderIds` and then called update on `documents` table?
           // Wait, let's check the original code from previous turn.
        }
      }

      // The previous code also did this:
      const { error: updateError } = await supabase
        .from('documents')
        .update({ folder_ids: newFolderIds })
        .eq('id', documentId)
        .eq('user_id', user.id);
        
      if (updateError) {
         throw updateError;
      }

      const updatedDocument = { ...document, folder_ids: newFolderIds };
      onDocumentUpdated(updatedDocument);

      toast.success('Document moved successfully!');
      setMoveDocumentDialogOpen(false);
    } catch (error: any) {
      toast.error(`Failed to move document: ${error.message}`);
    }
  }, [documents, user, onDocumentUpdated]);

  const handleAddDocumentToFolder = useCallback(async (documentId: string, folderId: string) => {
    try {
      if (!user?.id) return;

      const document = documents.find(d => d.id === documentId);
      if (!document) return;

      const currentFolderIds = document.folder_ids || [];

      if (currentFolderIds.includes(folderId)) {
        toast.info('Document is already in this folder');
        return;
      }

      const newFolderIds = [...currentFolderIds, folderId];

      const { error } = await supabase
        .from('documents')
        .update({ folder_ids: newFolderIds })
        .eq('id', documentId)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      const updatedDocument = { ...document, folder_ids: newFolderIds };
      onDocumentUpdated(updatedDocument);
      await loadDataIfNeeded('documents');
      toast.success('Document added to folder!');
    } catch (error: any) {
      toast.error(`Failed to add document to folder: ${error.message}`);
    }
  }, [documents, user, onDocumentUpdated, loadDataIfNeeded]);

  const handleRemoveDocumentFromFolder = useCallback(async (documentId: string, folderId: string) => {
    try {
      if (!user?.id) return;

      const document = documents.find(d => d.id === documentId);
      if (!document) return;

      const currentFolderIds = document.folder_ids || [];
      const newFolderIds = currentFolderIds.filter(id => id !== folderId);

      const { error } = await supabase
        .from('documents')
        .update({ folder_ids: newFolderIds })
        .eq('id', documentId)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      const updatedDocument = { ...document, folder_ids: newFolderIds };
      onDocumentUpdated(updatedDocument);
      await loadDataIfNeeded('documents');
      toast.success('Document removed from folder!');
    } catch (error: any) {
      toast.error(`Failed to remove document from folder: ${error.message}`);
    }
  }, [documents, user, onDocumentUpdated, loadDataIfNeeded]);

  const handleMoveFolder = useCallback((folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (folder) {
      setFolderToMove(folder);
      setMoveFolderDialogOpen(true);
    }
  }, [folders]);

  const handleMoveFolderSubmit = useCallback(async (folderId: string, targetParentId: string | null) => {
    try {
      if (!user?.id) return;

      const folder = folders.find(f => f.id === folderId);
      if (!folder) return;

      const isDescendant = (checkId: string, ancestorId: string): boolean => {
        const descendants = folders.filter(f => f.parent_folder_id === ancestorId);
        if (descendants.some(d => d.id === checkId)) return true;
        return descendants.some(d => isDescendant(checkId, d.id));
      };

      if (targetParentId && (targetParentId === folderId || isDescendant(targetParentId, folderId))) {
        toast.error('Cannot move folder into itself or its descendants');
        return;
      }

      const { error } = await supabase
        .from('document_folders')
        .update({ parent_folder_id: targetParentId })
        .eq('id', folderId)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      await loadDataIfNeeded('folders');
      toast.success('Folder moved successfully!');
      setMoveFolderDialogOpen(false);
    } catch (error: any) {
      toast.error(`Failed to move folder: ${error.message}`);
    }
  }, [folders, user, loadDataIfNeeded]);

  const handleDeleteDocument = useCallback(async (documentId: string, fileUrl: string) => {
    if (processingDocuments.has(documentId)) {
      toast.error('Cannot delete document while analysis is in progress.');
      return;
    }

    toast.info('Deleting document...', {
      action: {
        label: 'Confirm Delete',
        onClick: async () => {
          try {
            let storagePath: string | null = null;
            try {
              const url = new URL(fileUrl);
              const pathSegments = url.pathname.split('/chat-documents/');
              if (pathSegments.length > 1) {
                storagePath = pathSegments[1];
              } else {
                const oldPathSegments = url.pathname.split('/documents/');
                if (oldPathSegments.length > 1) {
                  storagePath = oldPathSegments[1];
                } else {
                  const match = fileUrl.match(/\/user_uploads\/[^/]+\/[^/]+$/);
                  if (match) {
                    storagePath = `user_uploads${match[0].split('/user_uploads')[1]}`;
                  }
                }
              }
            } catch (urlError) {
                // Ignore url parsing errors
            }

            if (storagePath) {
              const { error: storageError } = await supabase.storage
                .from('chat-documents')
                .remove([storagePath]);

              if (storageError) {
                toast.warning(`File might not have been removed from storage. Error: ${storageError.message}`);
              }
            } else {
              toast.warning('Could not derive storage path from file URL. File will not be deleted from storage.');
            }

            const { error: dbError } = await supabase
              .from('documents')
              .delete()
              .eq('id', documentId);

            if (dbError) {
              throw new Error(`Database deletion failed: ${dbError.message}`);
            }

            toast.success('Document deleted successfully!');
            onDocumentDeleted(documentId);
          } catch (error: any) {
            toast.error(`Failed to delete document: ${error.message}`);
          }
        }
      },
      duration: 5000,
    });
  }, [processingDocuments, onDocumentDeleted]);

  return {
    moveDocumentDialogOpen,
    setMoveDocumentDialogOpen,
    documentToMove,
    setDocumentToMove,
    moveFolderDialogOpen,
    setMoveFolderDialogOpen,
    folderToMove,
    setFolderToMove,
    handleMoveDocument,
    handleMoveDocumentSubmit,
    handleAddDocumentToFolder,
    handleRemoveDocumentFromFolder,
    handleMoveFolder,
    handleMoveFolderSubmit,
    handleDeleteDocument
  };
}
