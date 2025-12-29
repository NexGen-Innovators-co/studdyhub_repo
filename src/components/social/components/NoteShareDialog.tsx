// src/components/social/components/NoteShareDialog.tsx
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Search, StickyNote, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../../../integrations/supabase/client';
import { toast } from 'sonner';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

interface Document {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  created_at: string;
}

interface NoteShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (message: string, resourceId: string, resourceType: 'note' | 'document') => Promise<void>;
  currentUserId: string;
}

export const NoteShareDialog: React.FC<NoteShareDialogProps> = ({
  isOpen,
  onClose,
  onShare,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'documents'>('notes');
  const [notes, setNotes] = useState<Note[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResource, setSelectedResource] = useState<{
    id: string;
    type: 'note' | 'document';
    title: string;
  } | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Fetch notes and documents
  useEffect(() => {
    if (isOpen) {
      fetchResources();
    }
  }, [isOpen, currentUserId]);

  const fetchResources = async () => {
    setIsLoading(true);
    try {
      // Fetch notes
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('id, title, content, created_at')
        .eq('user_id', currentUserId)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (notesError) throw notesError;
      setNotes(notesData || []);

      // Fetch documents
      const { data: docsData, error: docsError } = await supabase
        .from('documents')
        .select('id, title, file_name, file_type, created_at')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (docsError) throw docsError;
      setDocuments(docsData || []);
    } catch (error) {
      //console.error('Error fetching resources:', error);
      toast.error('Failed to load resources');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredNotes = notes.filter((note) =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleShare = async () => {
    if (!selectedResource || !message.trim()) {
      toast.error('Please select a resource and add a message');
      return;
    }

    setIsSharing(true);
    try {
      await onShare(message, selectedResource.id, selectedResource.type);
      setMessage('');
      setSelectedResource(null);
      setSearchQuery('');
      onClose();
    } catch (error) {
      //console.error('Error sharing resource:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleClose = () => {
    setMessage('');
    setSelectedResource(null);
    setSearchQuery('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className=" max-w-2xl p-0 lg:p-2 ">
        <DialogHeader>
          <DialogTitle>Share Note or Document</DialogTitle>
          <DialogDescription>Select a note or document to share with others</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'notes' | 'documents')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="notes">
                <StickyNote className="h-4 w-4 mr-2" />
                Notes ({notes.length})
              </TabsTrigger>
              <TabsTrigger value="documents">
                <FileText className="h-4 w-4 mr-2" />
                Documents ({documents.length})
              </TabsTrigger>
            </TabsList>

            {/* Notes List */}
            <TabsContent value="notes" className="max-h-[300px] px-2 overflow-y-auto modern-scrollbar">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : filteredNotes.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No notes found
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredNotes.map((note) => (
                    <div
                      key={note.id}
                      onClick={() =>
                        setSelectedResource({
                          id: note.id,
                          type: 'note',
                          title: note.title,
                        })
                      }
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedResource?.id === note.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                          : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <StickyNote className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm">
                            {note.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {note.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Documents List */}
            <TabsContent value="documents" className="max-h-[300px] overflow-y-auto modern-scrollbar">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No documents found
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() =>
                        setSelectedResource({
                          id: doc.id,
                          type: 'document',
                          title: doc.title,
                        })
                      }
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedResource?.id === doc.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                          : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm">
                            {doc.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            {doc.file_name} • {doc.file_type}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Selected Resource */}
          {selectedResource && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Selected:</span>
                <span className="flex-1 truncate">{selectedResource.title}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedResource(null)}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              </div>
            </div>
          )}

          {/* Message */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Add a message
            </label>
            <Textarea
              placeholder="Say something about this resource..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isSharing}>
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              disabled={!selectedResource || !message.trim() || isSharing}
            >
              {isSharing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sharing...
                </>
              ) : (
                'Share'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};