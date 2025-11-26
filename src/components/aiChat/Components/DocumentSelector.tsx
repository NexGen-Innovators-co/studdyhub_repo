import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { ScrollArea } from '../../ui/scroll-area';
import { FileText, StickyNote, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Document } from '../../../types/Document';
import { Note } from '../../../types/Note';
import { supabase } from '../../../integrations/supabase/client';

interface DocumentSelectorProps {
  documents: Document[];
  notes: Note[];
  selectedDocumentIds: string[];
  onSelectionChange: (ids: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
  onDocumentUpdated: (updatedDocument: Document) => void;
  activeChatSessionId: string | null;
  onLoadMoreDocuments: () => void;
  hasMoreDocuments: boolean;
  isLoadingDocuments: boolean;
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
  onLoadMoreDocuments,
  hasMoreDocuments,
  isLoadingDocuments,
}) => {
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedDocumentIds);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Reset local state when dialog opens/closes or selectedDocumentIds changes
  useEffect(() => {
    setLocalSelectedIds(selectedDocumentIds);
  }, [selectedDocumentIds, isOpen]);

  // Set up Intersection Observer for infinite scroll
  useEffect(() => {
    if (!isOpen || !hasMoreDocuments || isLoadingDocuments) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          console.log('🔽 Loading more documents...');
          onLoadMoreDocuments();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '50px' // Load more when 50px from bottom
      }
    );

    if (loadMoreTriggerRef.current) {
      observer.observe(loadMoreTriggerRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isOpen, hasMoreDocuments, isLoadingDocuments, onLoadMoreDocuments]);
  useEffect(() => {
    console.log('DocumentSelector State:', {
      isOpen,
      hasMoreDocuments,
      isLoadingDocuments,
      documentsCount: documents.length,
      notesCount: notes.length,
      scrollViewport: scrollViewportRef.current,
      loadMoreTrigger: loadMoreTriggerRef.current
    });
  }, [isOpen, hasMoreDocuments, isLoadingDocuments, documents, notes]);
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
          .update({ 
            document_ids: localSelectedIds,
            updated_at: new Date().toISOString()
          })
          .eq('id', activeChatSessionId);
        
        if (error) {
          console.error('Error updating chat session:', error);
          toast.error(`Failed to update chat session documents: ${error.message}`);
          return;
        }
        toast.success('Chat session documents updated successfully!');
      }
      
      onSelectionChange(localSelectedIds);
      onClose();
    } catch (error: any) {
      console.error('Error confirming selection:', error);
      toast.error(`Error: ${error.message || 'Failed to update selections.'}`);
    }
  };

  const handleCancel = () => {
    setLocalSelectedIds(selectedDocumentIds);
    onClose();
  };

  // Enhanced select all functionality
  const handleSelectAllDocuments = () => {
    const allDocumentIds = documents.map(doc => doc.id);
    const currentDocumentIds = localSelectedIds.filter(id => 
      documents.some(doc => doc.id === id)
    );
    
    if (currentDocumentIds.length === allDocumentIds.length) {
      // Deselect all documents
      setLocalSelectedIds(prev => prev.filter(id => 
        !documents.some(doc => doc.id === id)
      ));
    } else {
      // Select all documents
      const newIds = [...new Set([...localSelectedIds, ...allDocumentIds])];
      setLocalSelectedIds(newIds);
    }
  };

  const handleSelectAllNotes = () => {
    const allNoteIds = notes.map(note => note.id);
    const currentNoteIds = localSelectedIds.filter(id => 
      notes.some(note => note.id === id)
    );
    
    if (currentNoteIds.length === allNoteIds.length) {
      // Deselect all notes
      setLocalSelectedIds(prev => prev.filter(id => 
        !notes.some(note => note.id === id)
      ));
    } else {
      // Select all notes
      const newIds = [...new Set([...localSelectedIds, ...allNoteIds])];
      setLocalSelectedIds(newIds);
    }
  };

  // Calculate selection counts for UI
  const selectedDocumentsCount = localSelectedIds.filter(id => 
    documents.some(doc => doc.id === id)
  ).length;

  const selectedNotesCount = localSelectedIds.filter(id => 
    notes.some(note => note.id === id)
  ).length;

  const totalItemsCount = documents.length + notes.length;
  const totalSelectedCount = selectedDocumentsCount + selectedNotesCount;

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center justify-between">
            <span>Select Documents and Notes</span>
             </DialogTitle>
          
          {/* Selection Summary */}
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span>Selected: {totalSelectedCount} of {totalItemsCount}</span>
            {totalSelectedCount > 0 && (
              <span className="text-blue-600 font-medium">
                ({selectedDocumentsCount} documents, {selectedNotesCount} notes)
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 px-6 overflow-y-auto modern-scrollbar">
          <div className="space-y-6 pb-4">
            {/* Documents Section */}
            {documents.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">
                    Documents ({documents.length})
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllDocuments}
                    className="text-xs h-7 px-2 text-blue-600 hover:text-blue-700"
                  >
                    {selectedDocumentsCount === documents.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                
                <div className="space-y-1">
                  {documents.map((doc, index) => (
                    <motion.div
                      key={`doc-${doc.id}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg border border-transparent hover:border-border transition-colors"
                    >
                      <Checkbox
                        id={`doc-${doc.id}`}
                        checked={localSelectedIds.includes(doc.id)}
                        onCheckedChange={(checked) => handleSelectionChange(doc.id, checked as boolean)}
                        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <label
                        htmlFor={`doc-${doc.id}`}
                        className="flex items-center gap-3 text-sm cursor-pointer flex-1 min-w-0"
                      >
                        <FileText className="h-4 w-4 flex-shrink-0 text-blue-600" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{doc.title || doc.file_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {doc.content_extracted ? 
                              `${doc.content_extracted.substring(0, 60)}...` : 
                              'No content extracted'
                            }
                          </p>
                        </div>
                      </label>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes Section */}
            {notes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">
                    Notes ({notes.length})
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllNotes}
                    className="text-xs h-7 px-2 text-green-600 hover:text-green-700"
                  >
                    {selectedNotesCount === notes.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                
                <div className="space-y-1">
                  {notes.map((note, index) => (
                    <motion.div
                      key={`note-${note.id}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg border border-transparent hover:border-border transition-colors"
                    >
                      <Checkbox
                        id={`note-${note.id}`}
                        checked={localSelectedIds.includes(note.id)}
                        onCheckedChange={(checked) => handleSelectionChange(note.id, checked as boolean)}
                        className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                      />
                      <label
                        htmlFor={`note-${note.id}`}
                        className="flex items-center gap-3 text-sm cursor-pointer flex-1 min-w-0"
                      >
                        <StickyNote className="h-4 w-4 flex-shrink-0 text-green-600" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{note.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {note.content ? 
                              `${note.content.substring(0, 60)}...` : 
                              'Empty note'
                            }
                          </p>
                        </div>
                      </label>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {isLoadingDocuments && (
              <div className="flex items-center justify-center py-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading more documents...</span>
                </div>
              </div>
            )}

            {/* Load More Trigger (for Intersection Observer) */}
            {hasMoreDocuments && !isLoadingDocuments && (
              <div 
                ref={loadMoreTriggerRef}
                className="h-4 flex items-center justify-center"
              >
                <div className="text-xs text-muted-foreground">
                  Scroll for more...
                </div>
              </div>
            )}

            {/* Empty State */}
            {!isLoadingDocuments && documents.length === 0 && notes.length === 0 && (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-base text-muted-foreground">
                  No documents or notes available.
                </p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Upload some documents or create notes to get started.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="flex-shrink-0 p-6 pt-4 border-t">
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            
            <div className="flex items-center gap-3">
              {totalSelectedCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  {totalSelectedCount} selected
                </span>
              )}
              <Button
                onClick={handleConfirmSelection}
                disabled={localSelectedIds.length === 0}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};