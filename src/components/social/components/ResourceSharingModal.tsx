// src/components/social/components/ResourceSharingModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import {
  FileText,
  File,
  Search,
  Loader2,
  CheckCircle2,
  Calendar,
  FolderOpen,
  Video,
  Clock
} from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { ScrollArea } from '../../ui/scroll-area';
import { Note } from '@/types/Note';
import { Document } from '@/types/Document';
import { ClassRecording } from '@/types/Class';
import { formatDistanceToNow } from 'date-fns';

interface ResourceSharingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShareResource: (resourceId: string, resourceType: 'note' | 'document' | 'class_recording', message?: string) => Promise<boolean>;
  notes: Note[];
  documents: Document[];
  classRecordings: ClassRecording[];
  isSharing: boolean;
  isLoading?: boolean;
  onLoadMoreNotes?: () => void;
  onLoadMoreDocuments?: () => void;
  onLoadMoreRecordings?: () => void;
  hasMoreNotes?: boolean;
  hasMoreDocuments?: boolean;
  hasMoreRecordings?: boolean;
  isLoadingMore?: boolean;
}

export const ResourceSharingModal: React.FC<ResourceSharingModalProps> = ({
  isOpen,
  onClose,
  onShareResource,
  notes,
  documents,
  classRecordings,
  isSharing,
  isLoading = false,
  onLoadMoreNotes,
  onLoadMoreDocuments,
  onLoadMoreRecordings,
  hasMoreNotes = false,
  hasMoreDocuments = false,
  hasMoreRecordings = false,
  isLoadingMore = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedResourceType, setSelectedResourceType] = useState<'note' | 'document' | 'class_recording' | null>(null);
  const [message, setMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'documents' | 'recordings'>('notes');

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredClassRecordings = classRecordings.filter(recording =>
    recording.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recording.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recording.summary?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleShare = async () => {
    if (!selectedResourceId || !selectedResourceType) return;

    const success = await onShareResource(selectedResourceId, selectedResourceType, message.trim() || undefined);
    if (success) {
      setSelectedResourceId(null);
      setSelectedResourceType(null);
      setSearchQuery('');
      setMessage('');
      onClose();
    }
  };

  const handleSelectResource = (id: string, type: 'note' | 'document' | 'class_recording') => {
    setSelectedResourceId(id);
    setSelectedResourceType(type);
  };

  // Infinite scroll handler
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea || isLoadingMore) return;

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLDivElement;
      const scrollHeight = target.scrollHeight;
      const scrollTop = target.scrollTop;
      const clientHeight = target.clientHeight;

      // Trigger load more when user scrolls to within 200px of bottom
      if (scrollHeight - scrollTop - clientHeight < 200) {
        if (activeTab === 'notes' && hasMoreNotes && onLoadMoreNotes) {
          onLoadMoreNotes();
        } else if (activeTab === 'documents' && hasMoreDocuments && onLoadMoreDocuments) {
          onLoadMoreDocuments();
        } else if (activeTab === 'recordings' && hasMoreRecordings && onLoadMoreRecordings) {
          onLoadMoreRecordings();
        }
      }
    };

    const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]');
    viewport?.addEventListener('scroll', handleScroll);

    return () => {
      viewport?.removeEventListener('scroll', handleScroll);
    };
  }, [activeTab, hasMoreNotes, hasMoreDocuments, hasMoreRecordings, onLoadMoreNotes, onLoadMoreDocuments, onLoadMoreRecordings, isLoadingMore]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-2xl h-[90vh] max-h-[700px] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl text-slate-900 dark:text-white">Share Resources</DialogTitle>
          <DialogDescription className="text-sm text-slate-600 dark:text-slate-400">
            Select a note, document, or class recording to share in this conversation
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <Input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <Tabs defaultValue="notes" className="flex-1 flex flex-col overflow-hidden" onValueChange={(value) => setActiveTab(value as 'notes' | 'documents' | 'recordings')}>
          <TabsList className="w-full px-4 sm:px-6 grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 flex-shrink-0">
            <TabsTrigger value="notes" className="flex items-center justify-center gap-1 sm:gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 text-xs sm:text-sm">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Notes</span>
              <span className="sm:hidden">N</span>
              <span className="text-xs">({filteredNotes.length})</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center justify-center gap-1 sm:gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 text-xs sm:text-sm">
              <File className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Documents</span>
              <span className="sm:hidden">D</span>
              <span className="text-xs">({filteredDocuments.length})</span>
            </TabsTrigger>
            <TabsTrigger value="recordings" className="flex items-center justify-center gap-1 sm:gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 text-xs sm:text-sm">
              <Video className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Recordings</span>
              <span className="sm:hidden">R</span>
              <span className="text-xs">({filteredClassRecordings.length})</span>
            </TabsTrigger>
          </TabsList>

          <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-12 w-12 text-blue-600 dark:text-blue-400 animate-spin mb-4" />
                <p className="text-sm text-slate-600 dark:text-slate-400">Loading your resources...</p>
              </div>
            ) : (
              <>
            <TabsContent value="notes" className="mt-0 space-y-2">
              {filteredNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">
                    {searchQuery ? 'No notes found' : 'No notes available'}
                  </p>
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isSelected = selectedResourceId === note.id && selectedResourceType === 'note';

                  return (
                    <Card
                      key={note.id}
                      className={`cursor-pointer transition-all hover:shadow-md border-2 ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                      onClick={() => handleSelectResource(note.id, 'note')}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className={`mt-1 rounded-lg p-2 flex-shrink-0 ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
                          }`}>
                            <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                                {note.title}
                              </h4>
                              {isSelected && (
                                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                              )}
                            </div>

                            {note.content && (
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                                {note.content}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-slate-500 dark:text-slate-400">
                              {note.category && (
                                <Badge variant="secondary" className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  {note.category}
                                </Badge>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span className="hidden sm:inline">{formatDistanceToNow(new Date(note.created_at || ''), { addSuffix: true })}</span>
                                <span className="sm:hidden">{formatDistanceToNow(new Date(note.created_at || ''))}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
              {isLoadingMore && hasMoreNotes && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
              )}
            </TabsContent>

            <TabsContent value="documents" className="mt-0 space-y-2">
              {filteredDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <File className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">
                    {searchQuery ? 'No documents found' : 'No documents available'}
                  </p>
                </div>
              ) : (
                filteredDocuments.map((doc) => {
                  const isSelected = selectedResourceId === doc.id && selectedResourceType === 'document';
                  const fileSize = doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size';

                  return (
                    <Card
                      key={doc.id}
                      className={`cursor-pointer transition-all hover:shadow-md border-2 ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                      onClick={() => handleSelectResource(doc.id, 'document')}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className={`mt-1 rounded-lg p-2 flex-shrink-0 ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
                          }`}>
                            <File className="h-4 w-4 sm:h-5 sm:w-5" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                                  {doc.title}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {doc.file_name}
                                </p>
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2">
                              <Badge variant="secondary" className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                {doc.file_type}
                              </Badge>
                              <span className="hidden sm:inline">{fileSize}</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span className="hidden sm:inline">{formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}</span>
                                <span className="sm:hidden">{formatDistanceToNow(new Date(doc.created_at))}</span>
                              </span>
                            </div>

                            {doc.processing_status && (
                              <div className="mt-2">
                                <Badge
                                  variant={doc.processing_status === 'completed' ? 'default' : 'secondary'}
                                  className="text-xs bg-slate-200 dark:bg-slate-700"
                                >
                                  {doc.processing_status}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
              {isLoadingMore && hasMoreDocuments && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
              )}
            </TabsContent>

            <TabsContent value="recordings" className="mt-0 space-y-2">
              {filteredClassRecordings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Video className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">
                    {searchQuery ? 'No recordings found' : 'No recordings available'}
                  </p>
                </div>
              ) : (
                filteredClassRecordings.map((recording) => {
                  const isSelected = selectedResourceId === recording.id && selectedResourceType === 'class_recording';
                  const formatDuration = (seconds?: number) => {
                    if (!seconds) return 'Unknown';
                    const mins = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    return `${mins}:${secs.toString().padStart(2, '0')}`;
                  };

                  return (
                    <Card
                      key={recording.id}
                      className={`cursor-pointer transition-all hover:shadow-md border-2 ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                      onClick={() => handleSelectResource(recording.id, 'class_recording')}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div
                            className={`mt-1 rounded-lg p-2 flex-shrink-0 ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-purple-100 dark:bg-purple-900/30'
                            }`}
                          >
                            <Video className="h-4 w-4 sm:h-5 sm:w-5" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                                {recording.title}
                              </h4>
                              {isSelected && (
                                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                              )}
                            </div>

                            {recording.summary && (
                              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                                {recording.summary}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-slate-500 dark:text-slate-400">
                              {recording.subject && (
                                <Badge variant="secondary" className="text-xs bg-purple-200 dark:bg-purple-900/50">
                                  {recording.subject}
                                </Badge>
                              )}
                              {recording.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDuration(recording.duration)}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span className="hidden sm:inline">{formatDistanceToNow(new Date(recording.date || recording.created_at), { addSuffix: true })}</span>
                                <span className="sm:hidden">{formatDistanceToNow(new Date(recording.date || recording.created_at))}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
              {isLoadingMore && hasMoreRecordings && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
              )}
            </TabsContent>
            </>
            )}
          </ScrollArea>
        </Tabs>

        {selectedResourceId && selectedResourceType && (
          <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              Add a message (optional)
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message to send with this resource..."
              className="min-h-[80px] resize-none bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"
              disabled={isSharing}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0 bg-slate-50 dark:bg-slate-800/50">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={isSharing}
            className="border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            disabled={!selectedResourceId || !selectedResourceType || isSharing || isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSharing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span className="hidden sm:inline">Sharing...</span>
                <span className="sm:hidden">...</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Share Resource</span>
                <span className="sm:hidden">Share</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};