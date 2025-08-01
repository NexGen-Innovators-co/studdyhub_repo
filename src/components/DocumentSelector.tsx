import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { FileText, StickyNote, X } from 'lucide-react';
import { toast } from 'sonner';
import { Document } from '../types/Document';
import { Note } from '../types/Note';
import { supabase } from '@/integrations/supabase/client';

interface DocumentSelectorProps {
  documents: Document[];
  notes: Note[];
  selectedDocumentIds: string[];
  onSelectionChange: (ids: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
  onDocumentUpdated: (updatedDocument: Document) => void;
  activeChatSessionId: string | null;
}

export const DocumentSelector: React.FC<DocumentSelectorProps> = ({
  documents,
  notes,
  selectedDocumentIds,
  onSelectionChange,
  isOpen,
  onClose,
  onDocumentUpdated,
  activeChatSessionId,
}) => {
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedDocumentIds);

  useEffect(() => {
    // Sync localSelectedIds with selectedDocumentIds when the modal opens or selectedDocumentIds changes
    setLocalSelectedIds(selectedDocumentIds);
  }, [selectedDocumentIds, isOpen]);

  const handleSelectionChange = (id: string, isChecked: boolean) => {
    setLocalSelectedIds((prev) => {
      const newIds = isChecked ? [...prev, id] : prev.filter((itemId) => itemId !== id);
      return newIds;
    });
  };

  const handleConfirmSelection = async () => {
    try {
      if (activeChatSessionId) {
        const { error } = await supabase
          .from('chat_sessions')
          .update({ document_ids: localSelectedIds })
          .eq('id', activeChatSessionId);
        if (error) {
          toast.error(`Failed to update chat session documents: ${error.message}`);
          return;
        }
        toast.success('Chat session documents updated.');
      }
      // Only update parent state after successful Supabase update (or for new sessions)
      onSelectionChange(localSelectedIds);
      onClose();
    } catch (error: any) {
      toast.error(`Error: ${error.message || 'Failed to update selections.'}`);
    }
  };

  const handleCancel = () => {
    // Reset local selections to parent state
    setLocalSelectedIds(selectedDocumentIds);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[600px] font-sans">
        <DialogHeader>
          <DialogTitle className="text-xl md:text-2xl text-slate-800 dark:text-gray-200">Select Documents and Notes</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            className="absolute right-4 top-4 text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 mt-4">
            {documents.length > 0 && (
              <div>
                <h3 className="text-base md:text-lg font-semibold text-slate-700 dark:text-gray-200 mb-2">Documents</h3>
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-gray-700 rounded-md">
                    <Checkbox
                      id={`doc-${doc.id}`}
                      checked={localSelectedIds.includes(doc.id)}
                      onCheckedChange={(checked) => handleSelectionChange(doc.id, checked as boolean)}
                    />
                    <label
                      htmlFor={`doc-${doc.id}`}
                      className="flex items-center gap-2 text-base md:text-lg text-slate-600 dark:text-gray-300 cursor-pointer flex-1"
                    >
                      <FileText className="h-4 w-4" />
                      {doc.title || doc.file_name}
                    </label>
                  </div>
                ))}
              </div>
            )}
            {notes.length > 0 && (
              <div>
                <h3 className="text-base md:text-lg font-semibold text-slate-700 dark:text-gray-200 mb-2">Notes</h3>
                {notes.map((note) => (
                  <div key={note.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-gray-700 rounded-md">
                    <Checkbox
                      id={`note-${note.id}`}
                      checked={localSelectedIds.includes(note.id)}
                      onCheckedChange={(checked) => handleSelectionChange(note.id, checked as boolean)}
                    />
                    <label
                      htmlFor={`note-${note.id}`}
                      className="flex items-center gap-2 text-base md:text-lg text-slate-600 dark:text-gray-300 cursor-pointer flex-1"
                    >
                      <StickyNote className="h-4 w-4" />
                      {note.title}
                    </label>
                  </div>
                ))}
              </div>
            )}
            {documents.length === 0 && notes.length === 0 && (
              <p className="text-base md:text-lg text-slate-500 dark:text-gray-400 text-center py-4">
                No documents or notes available.
              </p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSelection}
            disabled={localSelectedIds.length === 0 && selectedDocumentIds.length === 0}
            className="bg-blue-600 text-white shadow-md hover:bg-blue-700"
          >
            Attach Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};