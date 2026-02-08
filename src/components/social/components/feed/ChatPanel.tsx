import React from 'react';
import { ChatList } from '../ChatList';
import { ChatWindow } from '../ChatWindow';

interface ChatPanelProps {
  isOpen: boolean;
  chatSessions: any[];
  activeSessionId: string | null;
  activeSessionMessages: any[];
  currentUserId: string;
  isLoadingSessions: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  onClose: () => void;
  onSessionSelect: (id: string | null) => void;
  onSendMessage: (content: string, files?: File[]) => Promise<boolean>;
  onSendMessageWithResource: (content: string, resourceId: string, resourceType: 'note' | 'document' | 'post' | 'class_recording') => Promise<boolean>;
  editMessage: (messageId: string, content: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  chatSessions,
  activeSessionId,
  activeSessionMessages,
  currentUserId,
  isLoadingSessions,
  isLoadingMessages,
  isSending,
  onClose,
  onSessionSelect,
  onSendMessage,
  onSendMessageWithResource,
  editMessage,
  deleteMessage,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-1 mt-11 lg:mt-0 lg:inset-auto lg:right-6 animate-in fade-in duration-500 lg:bottom-24 lg:h-[600px] bg-white dark:bg-slate-900 z-50 lg:rounded-2xl lg:shadow-2xl overflow-hidden flex">
      <div className="flex-1 flex max-w-[100vw]">
        {!activeSessionId ? (
          <ChatList
            sessions={chatSessions}
            activeSessionId={activeSessionId}
            onSessionSelect={onSessionSelect}
            currentUserId={currentUserId}
            isLoading={isLoadingSessions}
            onbackClick={onClose}
          />
        ) : (
          <ChatWindow
            session={chatSessions.find((s) => s.id === activeSessionId) || null}
            messages={activeSessionMessages}
            currentUserId={currentUserId}
            onBack={() => {
              onSessionSelect(null);
            }}
            onSendMessage={onSendMessage}
            onSendMessageWithResource={onSendMessageWithResource}
            isSending={isSending}
            isLoading={isLoadingMessages}
            editMessage={editMessage}
            deleteMessage={deleteMessage}
          />
        )}
      </div>
    </div>
  );
};
