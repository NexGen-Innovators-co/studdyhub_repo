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
}

export const DocumentSelector: React.FC<DocumentSelectorProps> = ({
  documents,
  notes,
  selectedDocumentIds,
  onSelectionChange,
  isOpen,
  onClose
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 sm:p-6"> {/* Responsive padding */}
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-lg shadow-xl"> {/* Increased max-h, added rounded-lg, shadow-xl */}
        <CardContent className="p-4 sm:p-6 flex flex-col h-full"> {/* Responsive padding */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Select Documents & Notes</h3>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-500 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" /> {/* Changed to text-slate-400 */}
            <Input
              placeholder="Search documents and notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-slate-200 focus-visible:ring-blue-500" 
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-4 items-center"> {/* Added flex-wrap for buttons and badge */}
            <Button variant="outline" size="sm" onClick={selectAll} className="text-slate-600 border-slate-200 hover:bg-slate-50">
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll} className="text-slate-600 border-slate-200 hover:bg-slate-50">
              Clear All
            </Button>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full"> {/* Enhanced badge style */}
              {selectedDocumentIds.length} selected
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2"> {/* Added pr-2 for scrollbar spacing */}
            {filteredDocuments.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-slate-500 mb-2">Documents</h4> {/* Changed to text-slate-500 */}
                <div className="space-y-2">
                  {filteredDocuments.map((document) => (
                    <div
                      key={document.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors flex items-center gap-3 ${ /* Added flex items-center gap-3 */
                        selectedDocumentIds.includes(document.id)
                          ? 'bg-blue-50 border-blue-500' // Changed to blue-50 and blue-500
                          : 'hover:bg-slate-50 border-slate-200' // Changed to slate-50 and slate-200
                      }`}
                      onClick={() => toggleSelection(document.id)}
                    >
                      <div className="flex-shrink-0">
                        {selectedDocumentIds.includes(document.id) ? (
                          <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center"> {/* Changed to blue-600 */}
                            <Check className="h-3 w-3 text-white" /> {/* Changed to text-white */}
                          </div>
                        ) : (
                          <div className="w-5 h-5 border-2 border-slate-300 rounded-full" /> 
                        )}
                      </div>
                      <FileText className="h-4 w-4 text-slate-500 flex-shrink-0" /> {/* Changed to text-slate-500 */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-slate-800">{document.title}</p> {/* Added text-slate-800 */}
                        <p className="text-sm text-slate-500 truncate"> {/* Changed to text-slate-500 */}
                          {document.file_name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredNotes.length > 0 && (
              <div className={filteredDocuments.length > 0 ? "mt-6" : ""}> {/* Added margin-top if documents exist */}
                <h4 className="font-medium text-sm text-slate-500 mb-2">Notes</h4> {/* Changed to text-slate-500 */}
                <div className="space-y-2">
                  {filteredNotes.map((note) => (
                    <div
                      key={note.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors flex items-center gap-3 ${ /* Added flex items-center gap-3 */
                        selectedDocumentIds.includes(note.id)
                          ? 'bg-blue-50 border-blue-500' // Changed to blue-50 and blue-500
                          : 'hover:bg-slate-50 border-slate-200' // Changed to slate-50 and slate-200
                      }`}
                      onClick={() => toggleSelection(note.id)}
                    >
                      <div className="flex-shrink-0">
                        {selectedDocumentIds.includes(note.id) ? (
                          <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center"> {/* Changed to blue-600 */}
                            <Check className="h-3 w-3 text-white" /> {/* Changed to text-white */}
                          </div>
                        ) : (
                          <div className="w-5 h-5 border-2 border-slate-300 rounded-full" /> 
                        )}
                      </div>
                      {/* Note: FileText icon is used here for consistency, but could be a different icon for notes */}
                      <FileText className="h-4 w-4 text-slate-500 flex-shrink-0" /> {/* Changed to text-slate-500 */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-slate-800">{note.title}</p> {/* Added text-slate-800 */}
                        <p className="text-sm text-slate-500 line-clamp-2"> {/* Changed to text-slate-500 */}
                          {note.content || 'No content'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredDocuments.length === 0 && filteredNotes.length === 0 && (
              <div className="text-center py-8 text-slate-400"> {/* Changed to text-slate-400 */}
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No documents or notes found</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-200"> {/* Added border-slate-200 */}
            <Button variant="outline" onClick={onClose} className="text-slate-600 border-slate-200 hover:bg-slate-50">
              Cancel
            </Button>
            <Button onClick={onClose} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700"> {/* Added gradient and shadow */}
              Apply Selection
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
