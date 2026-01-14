import { Badge } from '../../ui/badge';
import { X, Paperclip, Image as ImageIcon, BookOpen, StickyNote, FileText } from 'lucide-react';
import { Document } from '../../../types/Document';
import { AttachedFile } from '../AiChat';
import { Note } from '@/types';
import { cn } from '@/lib/utils';

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
  handleRemoveFile: (fileId: string) => void;
  onViewContent: (type: 'image' | 'text' | 'document-text', content: string | null, language?: string, imageUrl?: string) => void;
}

export const ContextBadges = ({
  attachedFiles,
  onSelectionChange,
  selectedDocumentIds,
  documents,
  notes,
  handleRemoveFile,
  onViewContent
}: ContextBadgesProps) => {

  const handleRemoveDocOrNote = (id: string) => {
    onSelectionChange(selectedDocumentIds.filter(existingId => existingId !== id));
  };

  const getDocOrNote = (id: string) => {
    // Check notes first to preserve Note identification (Icon, etc.)
    const note = notes.find(n => n.id === id);
    if (note) return { type: 'note', item: note };

    // Then check documents (which might include merged docs/notes if passed that way, but we caught notes above)
    const doc = documents.find(d => d.id === id);
    if (doc) return { type: 'document', item: doc };
    
    return null;
  };

  return (
    <div className="flex flex-wrap gap-2 mb-2 max-h-[100px] overflow-y-auto modern-scrollbar">
      {/* Attached Files */}
      {attachedFiles.map((file) => (
        <Badge
          key={file.id}
          variant="secondary"
          className="bg-orange-100 text-orange-800 border-orange-200 flex items-center gap-1.5 py-1 pl-2 pr-1.5 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800 cursor-pointer hover:bg-orange-200 dark:hover:bg-orange-950/60 transition-colors"
          onClick={() => {
             if (file.type === 'image' && file.preview) {
                onViewContent('image', null, undefined, file.preview);
             }
          }}
        >
          {file.type === 'image' ? <ImageIcon className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
          <span className="max-w-[150px] truncate" title={file.file.name}>{file.file.name}</span>
          <div
            role="button"
            className="rounded-full p-0.5 hover:bg-orange-300/50 dark:hover:bg-orange-800/50 ml-1"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveFile(file.id);
            }}
          >
            <X className="h-3 w-3" />
          </div>
        </Badge>
      ))}

      {/* Selected Documents & Notes */}
      {selectedDocumentIds.map(id => {
         const result = getDocOrNote(id);
         if (!result) return null;
         
         const { type, item } = result;

         let Icon = FileText;
         let variantClasses = "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
         let hoverClasses = "hover:bg-blue-200 dark:hover:bg-blue-950/60";
         let closeHoverClasses = "hover:bg-blue-300/50 dark:hover:bg-blue-800/50";
         let contentHandler = () => {};

         if (type === 'document') {
            const doc = item as Document;
            if (doc.type === 'image') {
                Icon = ImageIcon;
            } else {
                Icon = BookOpen;
            }
            contentHandler = () => {
                 if (doc.content_extracted) {
                      onViewContent('document-text', doc.content_extracted, 'markdown');
                 } else if (doc.type ==='image' && doc.file_url) {
                      onViewContent('image', null, undefined, doc.file_url);
                 }
            };
         } else {
            // Note
            Icon = StickyNote;
            variantClasses = "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800";
            hoverClasses = "hover:bg-green-200 dark:hover:bg-green-950/60";
            closeHoverClasses = "hover:bg-green-300/50 dark:hover:bg-green-800/50";
            const note = item as Note;
             contentHandler = () => {
                  onViewContent('document-text', note.content, 'markdown');
             };
         }

         const title = (item as any).title || (item as any).file_name || 'Untitled';

         return (
            <Badge
                key={id}
                variant="secondary"
                className={cn("flex items-center gap-1.5 py-1 pl-2 pr-1.5 cursor-pointer transition-colors border", variantClasses, hoverClasses)}
                onClick={contentHandler}
            >
                <Icon className="h-3.5 w-3.5" />
                <span className="max-w-[150px] truncate" title={title}>{title}</span>
                <div
                    role="button"
                    className={cn("rounded-full p-0.5 ml-1 transition-colors", closeHoverClasses)}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveDocOrNote(id);
                    }}
                >
                    <X className="h-3 w-3" />
                </div>
            </Badge>
         );
      })}
    </div>
  );
};