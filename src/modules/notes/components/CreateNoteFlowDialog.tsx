import React, { useState, useEffect } from 'react';
import { QuickNoteTitleDialog } from './QuickNoteTitleDialog';
import {
  NotesTemplatePickerDialog,
  NoteTemplate } from './NotesTemplatePickerDialog'; // Will export
import { NoteCategory } from '../../../types/Note';

interface CreateNoteFlowDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNote: (data: {
    title: string;
    content: string;
    category: NoteCategory;
  }) => void;
}

type DialogStep = 'template' | 'title' | 'closed';

export const CreateNoteFlowDialog: React.FC<CreateNoteFlowDialogProps> = ({
  isOpen,
  onClose,
  onCreateNote,
}) => {
  const [dialogStep, setDialogStep] = useState<DialogStep>('closed');
  const [selectedTemplate, setSelectedTemplate] = useState<NoteTemplate | null>(
    null
  );

  // Sync isOpen prop with internal dialog state
  useEffect(() => {
    if (isOpen) {
      setDialogStep('template');
    } else {
      setDialogStep('closed');
    }
  }, [isOpen]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setDialogStep('closed');
      setSelectedTemplate(null);
      onClose();
    } else {
      setDialogStep('template');
    }
  };

  const handleTemplateSelect = (template: NoteTemplate) => {
    setSelectedTemplate(template);
    setDialogStep('title');
  };

  const handleTitleConfirm = (title: string, category: NoteCategory) => {
    const noteData = {
      title,
      content: selectedTemplate?.content || '',
      category,
    };
    onCreateNote(noteData);

    // Reset for next time
    setDialogStep('closed');
    setSelectedTemplate(null);
    onClose();
  };

  return (
    <>
      <NotesTemplatePickerDialog
        isOpen={isOpen && dialogStep === 'template'}
        onClose={() => handleOpenChange(false)}
        onSelect={handleTemplateSelect}
      />

      <QuickNoteTitleDialog
        isOpen={dialogStep === 'title'}
        onClose={() => {
          setDialogStep('template');
          setSelectedTemplate(null);
        }}
        onConfirm={handleTitleConfirm}
        templateName={selectedTemplate?.name}
      />
    </>
  );
};
