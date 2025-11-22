// src/components/social/components/ResourceSharingModal.tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { 
  FileText, 
  File, 
  Search, 
  Loader2, 
  CheckCircle2,
  Calendar,
  FolderOpen
} from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { ScrollArea } from '../../ui/scroll-area';
import { Note } from '@/types/Note';
import { Document } from '@/types/Document';
import { formatDistanceToNow } from 'date-fns';

interface ResourceSharingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShareResource: (resourceId: string, resourceType: 'note' | 'document') => Promise<boolean>;
  notes: Note[];
  documents: Document[];
  isSharing: boolean;
}

export const ResourceSharingModal: React.FC<ResourceSharingModalProps> = ({
  isOpen,
  onClose,
  onShareResource,
  notes,
  documents,
  isSharing,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedResourceType, setSelectedResourceType] = useState<'note' | 'document' | null>(null);

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleShare = async () => {
    if (!selectedResourceId || !selectedResourceType) return;

    const success = await onShareResource(selectedResourceId, selectedResourceType);
    if (success) {
      setSelectedResourceId(null);
      setSelectedResourceType(null);
      setSearchQuery('');
      onClose();
    }
  };

  const handleSelectResource = (id: string, type: 'note' | 'document') => {
    setSelectedResourceId(id);
    setSelectedResourceType(type);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Share Resource</DialogTitle>
          <DialogDescription>
            Select a note or document to share in this conversation
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs defaultValue="notes" className="flex-1">
          <TabsList className="w-full px-6">
            <TabsTrigger value="notes" className="flex-1">
              <FileText className="h-4 w-4 mr-2" />
              Notes ({filteredNotes.length})
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex-1">
              <File className="h-4 w-4 mr-2" />
              Documents ({filteredDocuments.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] px-6 py-4">
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
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        isSelected ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onClick={() => handleSelectResource(note.id, 'note')}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 rounded-lg p-2 ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
                          }`}>
                            <FileText className="h-5 w-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-semibold text-slate-900 dark:text-white truncate">
                                {note.title}
                              </h4>
                              {isSelected && (
                                <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                              )}
                            </div>
                            
                            {note.content && (
                              <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                                {note.content}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              {note.category && (
                                <Badge variant="secondary" className="text-xs">
                                  {note.category}
                                </Badge>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDistanceToNow(new Date(note.createdAt || ''), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
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
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        isSelected ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onClick={() => handleSelectResource(doc.id, 'document')}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 rounded-lg p-2 ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
                          }`}>
                            <File className="h-5 w-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div>
                                <h4 className="font-semibold text-slate-900 dark:text-white truncate">
                                  {doc.title}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {doc.file_name}
                                </p>
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                {doc.file_type}
                              </Badge>
                              <span>{fileSize}</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                              </span>
                            </div>

                            {doc.processing_status && (
                              <div className="mt-2">
                                <Badge 
                                  variant={doc.processing_status === 'completed' ? 'default' : 'secondary'}
                                  className="text-xs"
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
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex items-center justify-end gap-2 p-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button variant="outline" onClick={onClose} disabled={isSharing}>
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            disabled={!selectedResourceId || !selectedResourceType || isSharing}
          >
            {isSharing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sharing...
              </>
            ) : (
              'Share Resource'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};