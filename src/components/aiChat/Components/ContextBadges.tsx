import { Badge } from '../../ui/badge';
import { XCircle, Paperclip, Image, BookOpen, StickyNote } from 'lucide-react';
import { Document } from '../../../types/Document';
import { AttachedFile } from '../AiChat';  // Adjust import if needed, or pass as prop
import { Note } from '@/types';

interface ContextBadgesProps {
  attachedFiles: AttachedFile[];
  selectedImageDocuments: Document[];
  selectedDocumentTitles: string[];
  selectedNoteTitles: string[];
  handleRemoveAllFiles: () => void;
  onSelectionChange: (ids: string[]) => void;
  selectedDocumentIds: string[];
  documents: Document[];
  notes: Note[];
}

export const ContextBadges = ({
  attachedFiles,
  selectedImageDocuments,
  selectedDocumentTitles,
  selectedNoteTitles,
  handleRemoveAllFiles,
  onSelectionChange,
  selectedDocumentIds,
  documents,
  notes,
}: ContextBadgesProps) => (
  <div className="mb-3 p-3 bg-slate-100 border border-slate-200 rounded-lg flex flex-wrap items-center gap-2 dark:bg-gray-800 dark:border-gray-700">
    <span className="text-base md:text-lg font-medium text-slate-700 dark:text-gray-200 font-claude">Context:</span>
    {attachedFiles.length > 0 && (
      <Badge
        variant="secondary"
        className="bg-orange-500/20 text-orange-800 border-orange-400 flex items-center gap-1 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700 text-sm md:text-base font-sans"
      >
        <Paperclip className="h-3 w-3" />
        {attachedFiles.length} File{attachedFiles.length > 1 ? 's' : ''}
        <XCircle
          className="h-3 w-3 ml-1 cursor-pointer text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-200"
          onClick={handleRemoveAllFiles}
        />
      </Badge>
    )}
    {selectedImageDocuments.length > 0 && (
      <Badge variant="secondary" className="bg-blue-500/20 text-blue-800 border-blue-400 flex items-center gap-1 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700 text-sm md:text-base font-sans">
        <Image className="h-3 w-3" /> {selectedImageDocuments.length} Image Doc{selectedImageDocuments.length > 1 ? 's' : ''}
        <XCircle className="h-3 w-3 ml-1 cursor-pointer text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200" onClick={() => onSelectionChange(selectedDocumentIds.filter(id => !selectedImageDocuments.map(imgDoc => imgDoc.id).includes(id)))} />
      </Badge>
    )}
    {selectedDocumentTitles.length > 0 && (
      <Badge variant="secondary" className="bg-blue-500/20 text-blue-800 border-blue-400 flex items-center gap-1 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700 text-sm md:text-base font-sans">
        <BookOpen className="h-3 w-3 mr-1" /> {selectedDocumentTitles.length} Text Doc{selectedDocumentTitles.length > 1 ? 's' : ''}
        <XCircle className="h-3 w-3 ml-1 cursor-pointer text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200" onClick={() => onSelectionChange(selectedDocumentIds.filter(id => !documents.filter(doc => doc.type === 'text').map(d => d.id).includes(id)))} />
      </Badge>
    )}
    {selectedNoteTitles.length > 0 && (
      <Badge variant="secondary" className="bg-green-500/20 text-green-800 border-green-400 flex items-center gap-1 dark:bg-green-950 dark:text-green-300 dark:border-green-700 text-sm md:text-base font-sans">
        <StickyNote className="h-3 w-3 mr-1" /> {selectedNoteTitles.length} Note{selectedNoteTitles.length > 1 ? 's' : ''}
        <XCircle className="h-3 w-3 ml-1 cursor-pointer text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200" onClick={() => onSelectionChange(selectedDocumentIds.filter(id => !notes.map(n => n.id).includes(id)))} />
      </Badge>
    )}
  </div>
);