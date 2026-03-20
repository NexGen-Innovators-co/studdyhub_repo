import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/components/dialog';
import { Button } from '../../ui/components/button';

interface SectionSelectionDialogProps {
  isOpen: boolean;
  sections: string[];
  onSectionSelect: (section: string | null) => void; // null for all content
  onCancel: () => void;
  documentId?: string; // Optional document ID for tracking
}

export const SectionSelectionDialog: React.FC<SectionSelectionDialogProps> = ({ isOpen, sections, onSectionSelect, onCancel }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Document Structure Found</DialogTitle>
          <DialogDescription>
            We found several sections in your document. Would you like to generate a note from a specific section or the entire document?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 my-4 overflow-y-auto min-h-0 pr-1">
          <Button onClick={() => onSectionSelect(null)} variant="outline" className="shrink-0">Generate from Full Document</Button>
          {sections.map((section, index) => (
            <Button key={index} onClick={() => onSectionSelect(section)} className="shrink-0 whitespace-normal text-left h-auto py-2">
              {section}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};