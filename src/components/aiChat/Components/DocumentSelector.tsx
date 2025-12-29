import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Input } from '../../ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { ScrollArea } from '../../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import {
  FileText, StickyNote, Loader2, Layers, Search, Filter, XCircle
} from 'lucide-react';
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
  activeChatSessionId: string | null;
  onLoadMoreDocuments: () => void;
  hasMoreDocuments: boolean;
  isLoadingDocuments: boolean;
}

type FilterMode = 'all' | 'selected' | 'unselected';

export const DocumentSelector: React.FC<DocumentSelectorProps> = ({
  documents,
  notes,
  selectedDocumentIds,
  onSelectionChange,
  isOpen,
  onClose,
  activeChatSessionId,
  onLoadMoreDocuments,
  hasMoreDocuments,
  isLoadingDocuments,
}) => {
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedDocumentIds);
  const [activeTab, setActiveTab] = useState<string>('documents');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Refs
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    setLocalSelectedIds(selectedDocumentIds);
    setSearchQuery('');
    setFilterMode('all');
  }, [selectedDocumentIds, isOpen]);

  // --- FILTERING LOGIC ---
  const filterItems = <T extends { id: string }>(items: T[], getText: (item: T) => string) => {
    return items.filter(item => {
      // 1. Search Query Check
      const matchesSearch = searchQuery === '' ||
        getText(item).toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Filter Mode Check
      const isSelected = localSelectedIds.includes(item.id);
      const matchesFilter =
        filterMode === 'all' ? true :
          filterMode === 'selected' ? isSelected :
            !isSelected; // 'unselected'

      return matchesSearch && matchesFilter;
    });
  };

  const filteredDocuments = useMemo(() =>
    filterItems(documents, (d) => (d.title || d.file_name || '')),
    [documents, searchQuery, filterMode, localSelectedIds]);

  const filteredNotes = useMemo(() =>
    filterItems(notes, (n) => (n.title || '') + (n.content || '')),
    [notes, searchQuery, filterMode, localSelectedIds]);

  // --- INFINITE SCROLL (Only active if not searching) ---
  useEffect(() => {
    // Disable infinite scroll while searching to avoid confusion
    if (!isOpen || activeTab !== 'documents' || !hasMoreDocuments || isLoadingDocuments || searchQuery) return;

    const timeoutId = setTimeout(() => {
      if (!scrollViewportRef.current) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            onLoadMoreDocuments();
          }
        },
        {
          root: scrollViewportRef.current,
          threshold: 0.1,
          rootMargin: '100px'
        }
      );

      if (loadMoreTriggerRef.current) observer.observe(loadMoreTriggerRef.current);
      observerRef.current = observer;
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [isOpen, activeTab, hasMoreDocuments, isLoadingDocuments, onLoadMoreDocuments, searchQuery]);

  // --- HANDLERS ---
  const handleSelectionChange = (id: string, isChecked: boolean) => {
    setLocalSelectedIds((prev) =>
      isChecked ? [...prev, id] : prev.filter((itemId) => itemId !== id)
    );
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

        if (error) throw error;
        toast.success('Context updated successfully');
      }
      onSelectionChange(localSelectedIds);
      onClose();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleSelectAllVisible = () => {
    const items = activeTab === 'documents' ? filteredDocuments : filteredNotes;
    const ids = items.map(i => i.id);
    const allSelected = ids.every(id => localSelectedIds.includes(id));

    setLocalSelectedIds(prev =>
      allSelected
        ? prev.filter(id => !ids.includes(id))
        : [...new Set([...prev, ...ids])]
    );
  };

  const totalSelected = localSelectedIds.length; // Simplified for header

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* HEADER AREA */}
        <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur z-10">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Select Context
              </span>
              {totalSelected > 0 && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                  {totalSelected} Selected
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Choose notes, documents, or recordings to add as context for your chat
            </DialogDescription>
          </DialogHeader>

          {/* SEARCH & FILTER BAR */}
          <div className="px-6 pb-4 flex gap-2">
            <div className="relative flex-1">
              <Search className={`absolute left-2.5 top-2.5 h-4 w-4 transition-colors ${isSearchFocused ? 'text-primary' : 'text-muted-foreground'}`} />
              <Input
                placeholder="Search titles or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className="pl-9 bg-muted/30 border-muted-foreground/20 dark:bg-slate-600 dark:text-white focus-visible:ring-1"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Toggle */}
            <div className="flex bg-muted/30 p-1 rounded-md border border-muted-foreground/20">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${filterMode === 'all' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterMode('selected')}
                className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${filterMode === 'selected' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Selected
              </button>
            </div>
          </div>

          {/* TABS LIST */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="px-6">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="documents" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documents <span className="opacity-50 text-xs">({filteredDocuments.length})</span>
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex items-center gap-2">
                  <StickyNote className="w-4 h-4" />
                  Notes <span className="opacity-50 text-xs">({filteredNotes.length})</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 min-h-0 bg-muted/5">
          <Tabs value={activeTab} className="h-full">

            {/* DOCUMENTS TAB */}
            <TabsContent value="documents" className="h-full m-0 data-[state=inactive]:hidden">
              <ScrollArea ref={scrollViewportRef} className="h-full px-6">
                <div className="space-y-1 py-4">
                  <div className="flex justify-end mb-2">
                    <Button variant="ghost" size="sm" onClick={handleSelectAllVisible} className="text-xs h-6 px-2 text-primary/80">
                      {filteredDocuments.every(d => localSelectedIds.includes(d.id)) && filteredDocuments.length > 0 ? 'Deselect All' : 'Select All Visible'}
                    </Button>
                  </div>

                  <AnimatePresence mode='popLayout'>
                    {filteredDocuments.map((doc, index) => (
                      <motion.div
                        key={`doc-${doc.id}`}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer group
                          ${localSelectedIds.includes(doc.id)
                            ? 'bg-primary/5 border-primary/20'
                            : 'bg-card border-transparent hover:border-border hover:bg-accent/50'
                          }`}
                        onClick={() => handleSelectionChange(doc.id, !localSelectedIds.includes(doc.id))}
                      >
                        <Checkbox
                          checked={localSelectedIds.includes(doc.id)}
                          onCheckedChange={(c) => handleSelectionChange(doc.id, c as boolean)}
                          className="data-[state=checked]:bg-primary border-muted-foreground/30"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`font-medium text-sm truncate ${localSelectedIds.includes(doc.id) ? 'text-primary' : 'text-foreground'}`}>
                            {doc.title || doc.file_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate opacity-70">
                            {doc.content_extracted ? doc.content_extracted.substring(0, 60) : 'PDF Document'}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Empty States */}
                  {filteredDocuments.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Filter className="h-8 w-8 mb-2 opacity-20" />
                      <p>No documents found matching filters.</p>
                    </div>
                  )}

                  {/* Infinite Scroll Trigger (Only if not searching) */}
                  {!searchQuery && hasMoreDocuments && !isLoadingDocuments && (
                    <div ref={loadMoreTriggerRef} className="h-12 flex items-center justify-center opacity-50">
                      <span className="text-xs">Scroll for more...</span>
                    </div>
                  )}
                  {isLoadingDocuments && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* NOTES TAB */}
            <TabsContent value="notes" className="h-full m-0 data-[state=inactive]:hidden">
              <ScrollArea className="h-full px-6">
                <div className="space-y-1 py-4">
                  <div className="flex justify-end mb-2">
                    <Button variant="ghost" size="sm" onClick={handleSelectAllVisible} className="text-xs h-6 px-2 text-primary/80">
                      {filteredNotes.every(n => localSelectedIds.includes(n.id)) && filteredNotes.length > 0 ? 'Deselect All' : 'Select All Visible'}
                    </Button>
                  </div>

                  <AnimatePresence mode='popLayout'>
                    {filteredNotes.map((note) => (
                      <motion.div
                        key={`note-${note.id}`}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer group
                          ${localSelectedIds.includes(note.id)
                            ? 'bg-green-500/10 border-green-500/20'
                            : 'bg-card border-transparent hover:border-border hover:bg-accent/50'
                          }`}
                        onClick={() => handleSelectionChange(note.id, !localSelectedIds.includes(note.id))}
                      >
                        <Checkbox
                          checked={localSelectedIds.includes(note.id)}
                          onCheckedChange={(c) => handleSelectionChange(note.id, c as boolean)}
                          className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 border-muted-foreground/30"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`font-medium text-sm truncate ${localSelectedIds.includes(note.id) ? 'text-green-700 dark:text-green-400' : 'text-foreground'}`}>
                            {note.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate opacity-70">
                            {note.content ? note.content.substring(0, 60) : 'Text Note'}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {filteredNotes.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Filter className="h-8 w-8 mb-2 opacity-20" />
                      <p>No notes found matching filters.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

          </Tabs>
        </div>

        {/* FOOTER */}
        <DialogFooter className="flex-shrink-0 p-6 pt-4 border-t bg-background z-10">
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleConfirmSelection} disabled={localSelectedIds.length === 0}>
              Attach {totalSelected} Items
            </Button>
          </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};