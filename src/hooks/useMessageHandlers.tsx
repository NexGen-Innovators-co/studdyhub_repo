import { useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../integrations/supabase/client';
import { useAppContext } from '../hooks/useAppContext';
import { Message, FileData, MessagePart } from '../types/Class';
import { Document as AppDocument } from '../types/Document';
import { Note } from '../types/Note';
import { v4 as uuidv4 } from 'uuid';

export const useMessageHandlers = () => {
  const {
    user,
    activeChatSessionId,
    allChatMessages,
    documents,
    notes,
    userProfile,
    filteredChatMessages,
    setChatMessages,
    createNewChatSession,
    dispatch,
    selectedDocumentIds,
  } = useAppContext();

  const buildRichContext = useCallback((
    documentIdsToInclude: string[],
    noteIdsToInclude: string[],
    allDocuments: AppDocument[],
    allNotes: Note[]
  ) => {
    const selectedDocs = (allDocuments ?? []).filter(doc => 
      (documentIdsToInclude ?? []).includes(doc.id)
    );
    const selectedNotes = (allNotes ?? []).filter(note => 
      (noteIdsToInclude ?? []).includes(note.id)
    );

    let context = '';

    if (selectedDocs.length > 0) {
      context += 'ATTACHED DOCUMENTS:\n';
      for (const doc of selectedDocs) {
        const docInfo = `Title: ${doc.title}\nFile: ${doc.file_name}\nType: ${doc.type}\n`;
        if (doc.content_extracted) {
          context += docInfo + `Content: ${doc.content_extracted}\n\n`;
        } else {
          context += docInfo + `Content: ${doc.processing_status === 'completed' 
            ? 'No extractable content found' 
            : `Processing status: ${doc.processing_status || 'pending'}`}\n\n`;
        }
      }
    }

    if (selectedNotes.length > 0) {
      context += 'ATTACHED NOTES:\n';
      selectedNotes.forEach(note => {
        const noteInfo = `Title: ${note.title}\nCategory: ${note.category}\n`;
        let noteContent = '';
        if (note.content) {
          noteContent = note.content;
        }

        const noteBlock = noteInfo + (noteContent ? `Content: ${noteContent}\n` : '') +
          (note.aiSummary ? `Summary: ${note.aiSummary}\n` : '') +
          (note.tags?.length ? `Tags: ${note.tags.join(', ')}\n` : '') + '\n';

        context += noteBlock;
      });
    }

    return context;
  }, []);

  const handleSubmitMessage = useCallback(async (
    messageContent: string,
    attachedDocumentIds?: string[],
    attachedNoteIds?: string[],
    imageUrl?: string,
    imageMimeType?: string,
    imageDataBase64?: string,
    aiMessageIdToUpdate: string | null = null,
    attachedFiles?: FileData[]
  ) => {
    const hasTextContent = messageContent?.trim();
    const hasAttachments = (attachedDocumentIds && attachedDocumentIds.length > 0) ||
      (attachedNoteIds && attachedNoteIds.length > 0) ||
      imageUrl ||
      (attachedFiles && attachedFiles.length > 0);

    if (!hasTextContent && !hasAttachments) {
      toast.warning('Please enter a message or attach files to send.');
      return;
    }

    dispatch({ type: 'SET_IS_SUBMITTING_USER_MESSAGE', payload: true });
    dispatch({ type: 'SET_IS_AI_LOADING', payload: true });

    let cleanupTimeout: NodeJS.Timeout | null = null;

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        toast.error('You must be logged in to chat.');
        return;
      }

      let currentSessionId = activeChatSessionId;

      if (!currentSessionId) {
        currentSessionId = await createNewChatSession();
        if (!currentSessionId) {
          toast.error('Failed to create chat session. Please try again.');
          return;
        }
      }

      let finalAttachedDocumentIds = attachedDocumentIds || [];
      const finalAttachedNoteIds = attachedNoteIds || [];

      // Build the parts for the current user message
      const currentMessageParts: MessagePart[] = [];
      if (messageContent) {
        currentMessageParts.push({ text: messageContent });
      }

      const currentAttachedContext = buildRichContext(
        finalAttachedDocumentIds, 
        finalAttachedNoteIds, 
        documents, 
        notes
      );
      if (currentAttachedContext) {
        currentMessageParts.push({ text: `\n\nAttached Context:\n${currentAttachedContext}` });
      }

      if (imageUrl && imageMimeType) {
        if (imageDataBase64) {
          currentMessageParts.push({
            inlineData: { mimeType: imageMimeType, data: imageDataBase64 }
          });
        }
      }

      // Process attached files
      let processedFiles: FileData[] = attachedFiles || [];
      processedFiles = await Promise.all(
        (attachedFiles || []).map(async (file) => {
          return new Promise<FileData>((resolve) => {
            setTimeout(() => {
              //console.log(`Processing file: ${file.name}`);
              resolve(file);
            }, 200);
          });
        })
      );

      processedFiles.forEach(file => {
        if (file.content) {
          currentMessageParts.push({ text: `[File: ${file.name}]\n${file.content}` });
        } else if (file.type === 'image') {
          currentMessageParts.push({
            inlineData: { mimeType: file.mimeType, data: file.data }
          });
        }
      });

      const historicalMessagesForAI = allChatMessages
        .filter(msg => msg.session_id === currentSessionId)
        .filter(msg => !(aiMessageIdToUpdate && msg.id === aiMessageIdToUpdate))
        .slice(-1000); // MAX_HISTORY_MESSAGES

      const chatHistoryForAI: Array<{ role: string; parts: MessagePart[] }> = [];

      historicalMessagesForAI.forEach(msg => {
        const msgParts: MessagePart[] = [{ text: msg.content }];
        if (msg.attachedDocumentIds && msg.attachedDocumentIds.length > 0 || 
            msg.attachedNoteIds && msg.attachedNoteIds.length > 0) {
          const historicalContext = buildRichContext(
            msg.attachedDocumentIds || [],
            msg.attachedNoteIds || [],
            documents,
            notes
          );
          if (historicalContext && historicalContext.length < 1000000) {
            msgParts.push({ text: `\n\nPrevious Context:\n${historicalContext}` });
          }
        }
        chatHistoryForAI.push({ role: msg.role, parts: msgParts });
      });

      // Create optimistic user message
      const optimisticUserMessageId = `optimistic-user-${uuidv4()}`;
      const optimisticUserMessage: Message = {
        id: optimisticUserMessageId,
        content: messageContent || '[Files attached]',
        role: 'user',
        timestamp: new Date().toISOString(),
        isError: false,
        attachedDocumentIds: finalAttachedDocumentIds,
        attachedNoteIds: finalAttachedNoteIds,
        session_id: currentSessionId,
        has_been_displayed: true,
        image_url: imageUrl,
        image_mime_type: imageMimeType,
        files_metadata: processedFiles.length > 0 ? JSON.stringify(processedFiles) : undefined,
      };

      // Create optimistic AI message with special loading flag
      const optimisticAiMessageId = `optimistic-ai-${uuidv4()}`;
      const optimisticAiMessage: Message = {
        id: optimisticAiMessageId,
        content: '', // Empty content to trigger loading animation
        role: 'assistant',
        timestamp: new Date().toISOString(),
        isError: false,
        attachedDocumentIds: [],
        attachedNoteIds: [],
        session_id: currentSessionId,
        has_been_displayed: false,
        isLoading: true, // Add loading flag
      };

      // Add optimistic messages to UI immediately
      setChatMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== aiMessageIdToUpdate);
        return [...filtered, optimisticUserMessage, optimisticAiMessage];
      });

      // Update file processing progress
      if (processedFiles.length > 0) {
        dispatch({
          type: 'SET_FILE_PROCESSING_PROGRESS',
          payload: { processing: true, completed: 0, total: processedFiles.length, phase: 'uploading' }
        });
      }

      // Send the message to AI service
      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: {
          userId: currentUser.id,
          sessionId: currentSessionId,
          learningStyle: userProfile?.learning_style || 'visual',
          learningPreferences: userProfile?.learning_preferences || {
            explanation_style: 'detailed',
            examples: false,
            difficulty: 'intermediate',
          },
          chatHistory: chatHistoryForAI,
          message: messageContent || '',
          messageParts: currentMessageParts,
          files: processedFiles,
          attachedDocumentIds: finalAttachedDocumentIds,
          attachedNoteIds: finalAttachedNoteIds,
          imageUrl: imageUrl,
          imageMimeType: imageMimeType,
          aiMessageIdToUpdate: aiMessageIdToUpdate,
        },
      });

      if (error) {
        //console.error('Edge function error:', error);
        throw new Error(`AI service error: ${error.message || 'Unknown error'}`);
      }

      if (!data || !data.response) {
        throw new Error('Empty response from AI service');
      }

      //console.log('[handleSubmitMessage] Backend response:', data);

      // **Replace optimistic messages with real messages from response**
      // Backend should return userMessageId and aiMessageId
      const realUserMessage: Message = {
        id: data.userMessageId || optimisticUserMessageId,
        content: messageContent || '[Files attached]',
        role: 'user',
        timestamp: data.timestamp || new Date().toISOString(),
        isError: false,
        attachedDocumentIds: finalAttachedDocumentIds,
        attachedNoteIds: finalAttachedNoteIds,
        session_id: currentSessionId,
        has_been_displayed: true,
        image_url: imageUrl,
        image_mime_type: imageMimeType,
        files_metadata: processedFiles.length > 0 ? JSON.stringify(processedFiles) : undefined,
      };

      const realAiMessage: Message = {
        id: data.aiMessageId || optimisticAiMessageId,
        content: data.response,
        role: 'assistant',
        timestamp: data.timestamp || new Date().toISOString(),
        isError: false,
        attachedDocumentIds: [],
        attachedNoteIds: [],
        session_id: currentSessionId,
        has_been_displayed: false,
      };

      // console.log('[handleSubmitMessage] Replacing optimistic messages with real IDs:', {
      //   userMessageId: realUserMessage.id,
      //   aiMessageId: realAiMessage.id
      // });

      // Update UI with real messages
      setChatMessages(prev => {
        // Remove optimistic messages
        const withoutOptimistic = prev.filter(msg => 
          msg.id !== optimisticUserMessageId && msg.id !== optimisticAiMessageId
        );
        
        // Add real messages
        return [...withoutOptimistic, realUserMessage, realAiMessage];
      });

      // Update the session with the new title if provided
      if (data.title) {
        dispatch({
          type: 'UPDATE_CHAT_SESSION',
          payload: {
            id: currentSessionId,
            updates: {
              last_message_at: new Date().toISOString(),
              title: data.title,
              document_ids: [...new Set([...selectedDocumentIds, ...finalAttachedDocumentIds])],
            }
          }
        });
      }

      if (processedFiles.length > 0) {
        const successful = processedFiles.filter(f => f.processing_status === 'completed').length;
        const failed = processedFiles.filter(f => f.processing_status === 'failed').length;

        if (successful > 0 && failed === 0) {
          toast.success(`Successfully processed ${successful} file${successful > 1 ? 's' : ''}`);
        } else if (successful > 0 && failed > 0) {
          toast.warning(`Processed ${successful} file${successful > 1 ? 's' : ''}, ${failed} failed`);
        } else if (failed > 0) {
          toast.error(`Failed to process ${failed} file${failed > 1 ? 's' : ''}`);
        }
      }

    } catch (error: any) {
      //console.error('Error in handleSubmitMessage:', error);
      
      // Remove optimistic messages on error
      setChatMessages(prev => {
        return prev.filter(msg => !msg.id.startsWith('optimistic-'));
      });
      
      let errorMessage = 'Failed to send message';
      if (error.message?.includes('content size exceeds')) {
        errorMessage = 'Message too large. Please reduce file sizes or message length.';
      } else if (error.message?.includes('rate limit')) {
        errorMessage = 'Service is busy. Please try again in a moment.';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      toast.error(errorMessage);
    } finally {
      if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
      }
      dispatch({ type: 'SET_IS_SUBMITTING_USER_MESSAGE', payload: false });
      dispatch({ type: 'SET_IS_AI_LOADING', payload: false });
      dispatch({
        type: 'SET_FILE_PROCESSING_PROGRESS',
        payload: {
          processing: false,
          completed: 0,
          total: 0,
          phase: 'complete'
        }
      });
    }
  }, [
    user,
    activeChatSessionId,
    createNewChatSession,
    allChatMessages,
    documents,
    notes,
    buildRichContext,
    userProfile,
    dispatch,
    selectedDocumentIds,
    setChatMessages,
  ]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      if (!user || !activeChatSessionId) {
        toast.error('Authentication required or no active chat session.');
        return;
      }

      // Optimistically remove from UI
      setChatMessages(prevMessages => 
        (prevMessages || []).filter(msg => msg.id !== messageId)
      );
      toast.info('Deleting message...');

      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId)
        .eq('session_id', activeChatSessionId)
        .eq('user_id', user.id);

      if (error) {
        //console.error('Error deleting message from DB:', error);
        toast.error('Failed to delete message from database.');
        // Could reload messages here to restore state
      } else {
        toast.success('Message deleted successfully.');
      }
    } catch (error: any) {
      //console.error('Error in handleDeleteMessage:', error);
      toast.error(`Error deleting message: ${error.message || 'Unknown error'}`);
    }
  }, [user, activeChatSessionId, setChatMessages]);

  const handleRegenerateResponse = useCallback(async (lastUserMessageContent: string) => {
    if (!user || !activeChatSessionId) {
      toast.error('Authentication required or no active chat session.');
      return;
    }

    const lastAssistantMessage = filteredChatMessages.slice().reverse()
      .find(msg => msg.role === 'assistant');
    const lastUserMessage = filteredChatMessages.slice().reverse()
      .find(msg => msg.role === 'user');

    if (!lastUserMessage) {
      toast.info('No previous user message to regenerate from.');
      return;
    }

    if (!lastAssistantMessage) {
      toast.info('No previous AI message to regenerate.');
      return;
    }

    // Mark message as updating in UI
    setChatMessages(prevAllMessages =>
      (prevAllMessages || []).map(msg =>
        msg.id === lastAssistantMessage.id 
          ? { ...msg, content: 'Regenerating...', isError: false } 
          : msg
      )
    );

    toast.info('Regenerating response...');

    try {
      await handleSubmitMessage(
        lastUserMessageContent,
        lastUserMessage.attachedDocumentIds,
        lastUserMessage.attachedNoteIds,
        undefined,
        undefined,
        undefined,
        lastAssistantMessage.id,
        undefined,
      );
    } catch (error) {
      //console.error('Error regenerating response:', error);
      toast.error('Failed to regenerate response');

      setChatMessages(prevAllMessages =>
        (prevAllMessages || []).map(msg =>
          msg.id === lastAssistantMessage.id 
            ? { ...msg, isError: true } 
            : msg
        )
      );
    }
  }, [user, activeChatSessionId, filteredChatMessages, setChatMessages, handleSubmitMessage]);

  const handleRetryFailedMessage = useCallback(async (
    originalUserMessageContent: string, 
    failedAiMessageId: string
  ) => {
    if (!user || !activeChatSessionId) {
      toast.error('Authentication required or no active chat session.');
      return;
    }

    const lastUserMessage = filteredChatMessages.slice().reverse()
      .find(msg => msg.role === 'user' && msg.content === originalUserMessageContent);

    if (!lastUserMessage) {
      toast.error('Could not find original user message to retry.');
      return;
    }

    // Mark message as retrying in UI
    setChatMessages(prevAllMessages =>
      (prevAllMessages || []).map(msg =>
        msg.id === failedAiMessageId 
          ? { ...msg, content: 'Retrying...', isError: false } 
          : msg
      )
    );

    toast.info('Retrying message...');

    try {
      await handleSubmitMessage(
        originalUserMessageContent,
        lastUserMessage.attachedDocumentIds,
        lastUserMessage.attachedNoteIds,
        undefined,
        undefined,
        undefined,
        failedAiMessageId,
        undefined,
      );
    } catch (error) {
      //console.error('Error retrying message:', error);
      toast.error('Failed to retry message');

      setChatMessages(prevAllMessages =>
        (prevAllMessages || []).map(msg =>
          msg.id === failedAiMessageId 
            ? { ...msg, isError: true } 
            : msg
        )
      );
    }
  }, [user, activeChatSessionId, filteredChatMessages, setChatMessages, handleSubmitMessage]);

  return {
    handleSubmitMessage,
    handleDeleteMessage,
    handleRegenerateResponse,
    handleRetryFailedMessage,
    buildRichContext,
  };
};

// Helper hook for session management
export const useSessionHelpers = () => {
  const { 
    user, 
    chatSessions, 
    activeChatSessionId, 
    dispatch,
    loadChatSessions 
  } = useAppContext();

  const extractFirstSentence = useCallback((text: string): string => {
    if (!text) return 'New Chat';
    
    // Remove markdown and clean text
    const cleanText = text
      .replace(/[#*`]/g, '')
      .replace(/\n+/g, ' ')
      .trim();
    
    // Find first sentence
    const sentences = cleanText.split(/[.!?]+/);
    const firstSentence = sentences[0]?.trim();
    
    if (firstSentence && firstSentence.length > 5) {
      return firstSentence.length > 50 
        ? firstSentence.substring(0, 47) + '...' 
        : firstSentence;
    }
    
    return 'New Chat';
  }, []);

  const switchToSession = useCallback(async (sessionId: string) => {
    if (sessionId === activeChatSessionId) return;
    
    dispatch({ type: 'SET_ACTIVE_CHAT_SESSION', payload: sessionId });
    
    // Update selected document IDs for the new session
    const session = chatSessions.find(s => s.id === sessionId);
    if (session) {
      dispatch({ 
        type: 'SET_SELECTED_DOCUMENT_IDS', 
        payload: session.document_ids || [] 
      });
    }
  }, [activeChatSessionId, chatSessions, dispatch]);

  const updateSessionTitle = useCallback(async (sessionId: string, newTitle: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ title: newTitle })
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      dispatch({
        type: 'UPDATE_CHAT_SESSION',
        payload: { id: sessionId, updates: { title: newTitle } }
      });

      return true;
    } catch (error) {
      console.error('Error updating session title:', error);
      return false;
    }
  }, [user, dispatch]);

  return {
    extractFirstSentence,
    switchToSession,
    updateSessionTitle,
  };
};

// Helper hook for data operations
export const useDataHelpers = () => {
  const {
    setNotes,
    setRecordings,
    setDocuments,
    setScheduleItems,
    loadDataIfNeeded,
  } = useAppContext();

  const refreshAllData = useCallback(async () => {
    await Promise.all([
      loadDataIfNeeded('notes'),
      loadDataIfNeeded('recordings'),
      loadDataIfNeeded('documents'),
      loadDataIfNeeded('scheduleItems'),
      loadDataIfNeeded('quizzes'),
    ]);
  }, [loadDataIfNeeded]);

  const addOptimisticNote = useCallback((note: Note) => {
    setNotes(prev => [note, ...prev]);
  }, [setNotes]);

  const updateOptimisticNote = useCallback((noteId: string, updates: Partial<Note>) => {
    setNotes(prev => prev.map(note => 
      note.id === noteId ? { ...note, ...updates } : note
    ));
  }, [setNotes]);

  const removeOptimisticNote = useCallback((noteId: string) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
  }, [setNotes]);

  return {
    refreshAllData,
    addOptimisticNote,
    updateOptimisticNote,
    removeOptimisticNote,
  };
};