import React from 'react';
import { NotesList } from './NotesList';
import { NoteEditor } from './NoteEditor';
import { ClassRecordings } from './ClassRecordings';
import { Schedule } from './Schedule';
import { AIChat } from './AIChat';
import { Note } from '../types/Note';
import { ClassRecording, ScheduleItem, Message } from '../types/Class';

interface TabContentProps {
  activeTab: 'notes' | 'recordings' | 'schedule' | 'chat';
  filteredNotes: Note[];
  activeNote: Note | null;
  recordings: ClassRecording[];
  scheduleItems: ScheduleItem[];
  chatMessages: Message[];
  isAILoading: boolean;
  onNoteSelect: (note: Note) => void;
  onNoteUpdate: (note: Note) => void;
  onNoteDelete: (noteId: string) => void;
  onAddRecording: (recording: ClassRecording) => void;
  onGenerateQuiz: (classId: string) => Promise<void>;
  onAddScheduleItem: (item: ScheduleItem) => void;
  onUpdateScheduleItem: (item: ScheduleItem) => void;
  onDeleteScheduleItem: (id: string) => void;
  onSendMessage: (message: string) => Promise<void>;
}

export const TabContent: React.FC<TabContentProps> = ({
  activeTab,
  filteredNotes,
  activeNote,
  recordings,
  scheduleItems,
  chatMessages,
  isAILoading,
  onNoteSelect,
  onNoteUpdate,
  onNoteDelete,
  onAddRecording,
  onGenerateQuiz,
  onAddScheduleItem,
  onUpdateScheduleItem,
  onDeleteScheduleItem,
  onSendMessage,
}) => {
  switch (activeTab) {
    case 'notes':
      return (
        <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
          <div className="w-full lg:w-80 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col max-h-80 lg:max-h-none overflow-y-auto lg:overflow-visible">
            <NotesList 
              notes={filteredNotes}
              activeNote={activeNote}
              onNoteSelect={onNoteSelect}
              onNoteDelete={onNoteDelete}
            />
          </div>
          <div className="flex-1 bg-white min-h-0">
            {activeNote ? (
              <NoteEditor 
                note={activeNote}
                onNoteUpdate={onNoteUpdate}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 p-4">
                <div className="text-center">
                  <div className="text-4xl sm:text-6xl mb-4">📝</div>
                  <h3 className="text-lg sm:text-xl font-medium mb-2">No note selected</h3>
                  <p className="text-sm sm:text-base">Select a note to start editing or create a new one</p>
                </div>
              </div>
            )}
          </div>
        </div>
      );

    case 'recordings':
      return (
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto">
          <ClassRecordings 
            recordings={recordings}
            onAddRecording={onAddRecording}
            onGenerateQuiz={onGenerateQuiz}
          />
        </div>
      );

    case 'schedule':
      return (
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto">
          <Schedule 
            scheduleItems={scheduleItems}
            onAddItem={onAddScheduleItem}
            onUpdateItem={onUpdateScheduleItem}
            onDeleteItem={onDeleteScheduleItem}
          />
        </div>
      );

    case 'chat':
      return (
        <div className="flex-1">
          <AIChat 
            messages={chatMessages}
            onSendMessage={onSendMessage}
            isLoading={isAILoading}
          />
        </div>
      );

    default:
      return null;
  }
};