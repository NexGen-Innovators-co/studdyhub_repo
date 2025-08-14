import { useState, useCallback, useRef } from 'react';
import { Message } from '../types/Class';
import { generateId } from '../utils/helpers';

interface UseInstantMessageReturn {
  optimisticMessages: Message[];
  addOptimisticUserMessage: (content: string, attachments?: any) => string;
  addOptimisticAIMessage: (content?: string) => string;
  updateOptimisticMessage: (id: string, content: string, isComplete?: boolean) => void;
  removeOptimisticMessage: (id: string) => void;
  clearOptimisticMessages: () => void;
  replaceWithActualMessage: (optimisticId: string, actualMessage: Message) => void;
}

export const useInstantMessage = (actualMessages: Message[]): UseInstantMessageReturn => {
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const pendingMessageIds = useRef<Set<string>>(new Set());

  const addOptimisticUserMessage = useCallback((content: string, attachments?: any): string => {
    const id = generateId();
    const message: Message = {
      id,
      content,
      role: 'user',
      timestamp: new Date().toISOString(),
      isError: false,
      session_id: '',
      has_been_displayed: false,
      ...attachments
    };

    setOptimisticMessages(prev => [...prev, message]);
    pendingMessageIds.current.add(id);
    return id;
  }, []);

  const addOptimisticAIMessage = useCallback((content: string = ''): string => {
    const id = generateId();
    const message: Message = {
      id,
      content,
      role: 'assistant',
      timestamp: new Date().toISOString(),
      isError: false,
      session_id: '',
      has_been_displayed: false
    };

    setOptimisticMessages(prev => [...prev, message]);
    pendingMessageIds.current.add(id);
    return id;
  }, []);

  const updateOptimisticMessage = useCallback((id: string, content: string, isComplete: boolean = false) => {
    setOptimisticMessages(prev => 
      prev.map(msg => 
        msg.id === id 
          ? { ...msg, content }
          : msg
      )
    );
  }, []);

  const removeOptimisticMessage = useCallback((id: string) => {
    setOptimisticMessages(prev => prev.filter(msg => msg.id !== id));
    pendingMessageIds.current.delete(id);
  }, []);

  const clearOptimisticMessages = useCallback(() => {
    setOptimisticMessages([]);
    pendingMessageIds.current.clear();
  }, []);

  const replaceWithActualMessage = useCallback((optimisticId: string, actualMessage: Message) => {
    // Remove the optimistic message and let the actual message be handled by the parent
    setOptimisticMessages(prev => prev.filter(msg => msg.id !== optimisticId));
    pendingMessageIds.current.delete(optimisticId);
  }, []);

  // Only add optimistic messages that don't exist in actual messages
  const allMessages = [...actualMessages];
  
  optimisticMessages.forEach(optimistic => {
    // Check if this optimistic message is not already in actual messages
    const exists = allMessages.some(actual => 
      actual.id === optimistic.id || 
      (actual.content.trim() === optimistic.content.trim() && 
       actual.role === optimistic.role &&
       Math.abs(new Date(actual.timestamp).getTime() - new Date(optimistic.timestamp).getTime()) < 5000)
    );
    
    if (!exists) {
      allMessages.push(optimistic);
    }
  });

  // Sort by timestamp
  allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  // Filter out duplicate welcome messages
  const seenWelcomeMessages = new Set();
  const filteredMessages = allMessages.filter(message => {
    if (message.role === 'assistant' && message.content.toLowerCase().includes('welcome to your ai study assistant')) {
      if (seenWelcomeMessages.has('welcome')) {
        return false;
      }
      seenWelcomeMessages.add('welcome');
    }
    return true;
  });

  return {
    optimisticMessages: filteredMessages,
    addOptimisticUserMessage,
    addOptimisticAIMessage,
    updateOptimisticMessage,
    removeOptimisticMessage,
    clearOptimisticMessages,
    replaceWithActualMessage
  };
};