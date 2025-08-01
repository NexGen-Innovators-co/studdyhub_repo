// DocumentSelector.tsx
import React, { useState } from 'react';
import { FileText, Check, X, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Document } from '../types/Document';
import { Note } from '../types/Note';

interface DocumentSelectorProps {
  documents: Document[];
  notes: Note[];
  selectedDocumentIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
  onDocumentUpdated: (updatedDoc: Document) => void; // Added to match AIChat.tsx
}

export const DocumentSelector: React.FC<DocumentSelectorProps> = ({
  documents,
  notes,
  selectedDocumentIds,
  onSelectionChange,
  isOpen,
  onClose,
  onDocumentUpdated,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelection = (id: string) => {
    if (selectedDocumentIds.includes(id)) {
      onSelectionChange(selectedDocumentIds.filter(docId => docId !== id));
    } else {
      onSelectionChange([...selectedDocumentIds, id]);
    }
  };

  const selectAll = () => {
    const allIds = [...documents.map(d => d.id), ...notes.map(n => n.id)];
    onSelectionChange(allIds);
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  // Function to handle attaching selected documents/notes
  const handleAttachSelected = () => {
    onClose(); // Close the modal, changes are already applied via onSelectionChange
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center overflow-y-auto justify-center p-4 sm:p-6" onClick={onClose}>
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-lg shadow-xl bg-white dark:bg-gray-800 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-4 sm:p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-100">Select Documents & Notes</h3>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-700">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-gray-500 h-4 w-4" />
            <Input
              placeholder="Search documents and notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-slate-200 focus-visible:ring-blue-500 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <Button variant="outline" size="sm" onClick={selectAll} className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll} className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">
              Clear All
            </Button>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-200">
              {selectedDocumentIds.length} selected
            </Badge>
          </div>

          <div className="flex-1 max-h-[calc(90vh-200px)] overflow-y-scroll space-y-4 pr-2 modern-scrollbar">
            {filteredDocuments.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-slate-500 mb-2 dark:text-gray-400">Documents</h4>
                <div className="space-y-2">
                  {filteredDocuments.map((document) => (
                    <div
                      key={document.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors flex items-center gap-3 ${selectedDocumentIds.includes(document.id)
                          ? 'bg-blue-50 border-blue-500 dark:bg-blue-950 dark:border-blue-700'
                          : 'hover:bg-slate-50 border-slate-200 dark:hover:bg-gray-700 dark:border-gray-600 dark:bg-gray-800'
                        }`}
                      onClick={() => toggleSelection(document.id)}
                    >
                      <div className="flex-shrink-0">
                        {selectedDocumentIds.includes(document.id) ? (
                          <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center dark:bg-blue-500">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 border-2 border-slate-300 rounded-full dark:border-gray-500" />
                        )}
                      </div>
                      <FileText className="h-4 w-4 text-slate-500 flex-shrink-0 dark:text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-slate-800 dark:text-gray-100">{document.title}</p>
                        <p className="text-sm text-slate-500 truncate dark:text-gray-400">
                          {document.file_name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredNotes.length > 0 && (
              <div className={filteredDocuments.length > 0 ? "mt-6" : ""}>
                <h4 className="font-medium text-sm text-slate-500 mb-2 dark:text-gray-400">Notes</h4>
                <div className="space-y-2">
                  {filteredNotes.map((note) => (
                    <div
                      key={note.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors flex items-center gap-3 ${selectedDocumentIds.includes(note.id)
                          ? 'bg-blue-50 border-blue-500 dark:bg-blue-950 dark:border-blue-700'
                          : 'hover:bg-slate-50 border-slate-200 dark:hover:bg-gray-700 dark:border-gray-600 dark:bg-gray-800'
                        }`}
                      onClick={() => toggleSelection(note.id)}
                    >
                      <div className="flex-shrink-0">
                        {selectedDocumentIds.includes(note.id) ? (
                          <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center dark:bg-blue-500">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 border-2 border-slate-300 rounded-full dark:border-gray-500" />
                        )}
                      </div>
                      <FileText className="h-4 w-4 text-slate-500 flex-shrink-0 dark:text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-slate-800 dark:text-gray-100">{note.title}</p>
                        <p className="text-sm text-slate-500 line-clamp-2 dark:text-gray-400">
                          {note.content || 'No content'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredDocuments.length === 0 && filteredNotes.length === 0 && (
              <div className="text-center py-8 text-slate-400 dark:text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No documents or notes found</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={onClose}
              className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAttachSelected}
              disabled={selectedDocumentIds.length === 0}
              className="bg-blue-600 text-white hover:bg-blue-700 shadow-md disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-800"
            >
              Attach Selected ({selectedDocumentIds.length})
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
