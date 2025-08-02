// components/NoteContentArea.tsx
import React, { useEffect, useRef, memo, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { Chart, registerables } from 'chart.js';

// Component imports
import { InlineAIEditor } from './InlineAIEditor';
import { AITypingOverlay } from './AITypingOverlay';
import { AISuggestionsPopup } from './AISuggestionsPopup';
import { commonMarkdownComponents } from './MarkdownComponent';

// Type and constant imports
import { UserProfile } from '../types';
import { AISuggestion, AI_SUGGESTIONS } from '../constants/aiSuggestions';

// Utility imports
import { getTextareaCaretCoordinates } from '../utils/textareaUtils';
import { generateInlineContent } from '../services/aiServices';
import { useTypingAnimation } from '../hooks/useTypingAnimation';

Chart.register(...registerables);

interface NoteContentAreaProps {
  content: string;
  setContent: (content: string) => void;
  isEditing: boolean;
  userProfile: UserProfile | null;
}

export const NoteContentArea: React.FC<NoteContentAreaProps> = ({
  content,
  setContent,
  isEditing,
  userProfile,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedContentBufferRef = useRef<string>('');

  // Typing animation hook
  const { startTypingAnimation, stopTypingAnimation, currentTypingPosition, typingIntervalRef } =
    useTypingAnimation({ textareaRef, setContent });

  // State for Inline AI Editor
  const [editorPosition, setEditorPosition] = useState({ top: 0, left: 0 });
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [selectedTextForAI, setSelectedTextForAI] = useState('');
  const [actionTypeForAI, setActionTypeForAI] = useState('');
  const [isGeneratingAIInline, setIsGeneratingAIInline] = useState(false);
  const [inlineSelectionStart, setInlineSelectionStart] = useState<number | null>(null);
  const [inlineSelectionEnd, setInlineSelectionEnd] = useState<number | null>(null);

  // New states for improved AI typing
  const [isTypingAI, setIsTypingAI] = useState(false);
  const [originalContentBeforeAI, setOriginalContentBeforeAI] = useState('');
  const [typingComplete, setTypingComplete] = useState(false);

  // AI Suggestions state
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiSuggestionsPosition, setAISuggestionsPosition] = useState({ top: 0, left: 0 });
  const [suggestedActions, setSuggestedActions] = useState<AISuggestion[]>([]);

  // Detect AI-worthy content and show suggestions
  const detectAISuggestions = useCallback((text: string, cursorPosition: number) => {
    if (!text.trim()) return;

    // Get surrounding context (50 chars before and after cursor)
    const start = Math.max(0, cursorPosition - 50);
    const end = Math.min(text.length, cursorPosition + 50);
    const context = text.substring(start, end);

    // Find matching suggestions
    const matchingSuggestions = AI_SUGGESTIONS
      .filter(suggestion => suggestion.trigger.test(context))
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3);

    if (matchingSuggestions.length > 0 && textareaRef.current) {
      const textarea = textareaRef.current;
      const textareaRect = textarea.getBoundingClientRect();
      const coords = getTextareaCaretCoordinates(textarea, cursorPosition);

      setSuggestedActions(matchingSuggestions);
      setAISuggestionsPosition({
        top: textareaRect.top + coords.top + coords.height + 5,
        left: textareaRect.left + coords.left
      });
      setShowAISuggestions(true);

      // Auto-hide after 5 seconds
      setTimeout(() => setShowAISuggestions(false), 5000);
    }
  }, []);

  // Handle textarea input changes
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPosition = e.target.selectionStart;

    // Stop AI typing if user interferes
    if (isTypingAI && !typingComplete) {
      handleDeclineAI();
      return;
    }

    setContent(newContent);

    // Detect AI suggestions on certain conditions
    if (newContent.length > content.length && cursorPosition > 10) {
      // Only check when content is being added and we have enough context
      detectAISuggestions(newContent, cursorPosition);
    }
  }, [content.length, isTypingAI, typingComplete, setContent, detectAISuggestions]);

  // Handle context menu for text selection AI
  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!textareaRef.current || !isEditing) return;

    event.preventDefault();

    const textarea = textareaRef.current;
    const selectedTextValue = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);

    if (selectedTextValue.length > 0) {
      const textareaRect = textarea.getBoundingClientRect();
      const selectionStartPos = textarea.selectionStart;
      const selectionEndPos = textarea.selectionEnd;

      const startCoords = getTextareaCaretCoordinates(textarea, selectionStartPos);
      const endCoords = getTextareaCaretCoordinates(textarea, selectionEndPos);

      let top = textareaRect.top + startCoords.top - 60;
      let left = textareaRect.left + (startCoords.left + endCoords.left) / 2;

      if (top < textareaRect.top + 10) {
        top = textareaRect.top + startCoords.top + startCoords.height + 10;
      }

      if (top + 200 > textareaRect.bottom - 10) {
        top = textareaRect.bottom - 210;
      }

      if (top < 10) {
        top = 10;
      }

      setEditorPosition({ top, left });
      setSelectedTextForAI(selectedTextValue);
      setActionTypeForAI('improve');
      setIsGeneratingAIInline(false);
      setInlineSelectionStart(selectionStartPos);
      setInlineSelectionEnd(selectionEndPos);
      setIsEditorVisible(true);
      setShowAISuggestions(false); // Hide other suggestions
    } else {
      setIsEditorVisible(false);
    }
  }, [isEditing]);

  // Handler for accepting AI suggestion
  const handleAcceptAI = useCallback(() => {
    stopTypingAnimation();

    // If typing wasn't complete, finish it instantly
    if (!typingComplete && generatedContentBufferRef.current) {
      const remainingContent = generatedContentBufferRef.current;
      const startPos = inlineSelectionStart !== null ? inlineSelectionStart : content.length;
      const currentContent = textareaRef.current?.value || content;
      // Ensure we append the full remaining content from the point of current typing
      const finalContent = currentContent.substring(0, currentTypingPosition) +
        remainingContent.substring(currentTypingPosition - startPos + (content.length - originalContentBeforeAI.length)) + // Adjust for content length changes
        currentContent.substring(currentTypingPosition);
      setContent(finalContent);
    }

    // Reset all states
    setIsTypingAI(false);
    setTypingComplete(false);
    setOriginalContentBeforeAI('');
    setInlineSelectionStart(null);
    setInlineSelectionEnd(null);
    generatedContentBufferRef.current = '';

    toast.success('AI suggestion accepted!');
  }, [typingComplete, inlineSelectionStart, content, currentTypingPosition, setContent, originalContentBeforeAI, stopTypingAnimation]);

  // Handler for declining AI suggestion
  const handleDeclineAI = useCallback(() => {
    stopTypingAnimation();

    // Revert to original content
    setContent(originalContentBeforeAI);

    // Reset all states
    setIsTypingAI(false);
    setTypingComplete(false);
    setOriginalContentBeforeAI('');
    setInlineSelectionStart(null);
    setInlineSelectionEnd(null);
    generatedContentBufferRef.current = '';

    toast.info('AI suggestion declined');
  }, [originalContentBeforeAI, setContent, stopTypingAnimation]);

  // AI generation handler
  const handleAIGenerate = async (selectedText: string, actionType: string, customInstruction: string): Promise<void> => {
    if (!userProfile) {
      toast.error('User profile not found. Cannot generate content.');
      return;
    }

    setIsEditorVisible(false);
    setIsGeneratingAIInline(true);
    toast.loading('Generating AI content...', { id: 'inline-ai-gen' });

    setOriginalContentBeforeAI(content);

    try {
      const generatedContent = await generateInlineContent(
        selectedText,
        content,
        userProfile,
        actionType,
        customInstruction
      );

      generatedContentBufferRef.current = generatedContent;

      const start = inlineSelectionStart !== null ? inlineSelectionStart : content.length;
      const end = inlineSelectionEnd !== null ? inlineSelectionEnd : content.length;

      // Clear the original selected text
      const contentWithoutSelection = content.substring(0, start) + content.substring(end);
      setContent(contentWithoutSelection);

      setIsTypingAI(true);
      setTypingComplete(false);

      // Start typing animation
      setTimeout(() => {
        startTypingAnimation(generatedContent, start);
      }, 100);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate content with AI.';
      toast.error(errorMessage, { id: 'inline-ai-gen' });
      console.error('AI generation error:', error);

      // Cleanup on error
      setContent(originalContentBeforeAI);
      setIsTypingAI(false);
      setOriginalContentBeforeAI('');
    } finally {
      setIsGeneratingAIInline(false);
    }
  };

  // Handle AI suggestion click
  const handleAISuggestionClick = useCallback((suggestion: AISuggestion) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;

    // Select some context around cursor for AI processing
    const contextStart = Math.max(0, cursorPos - 100);
    const contextEnd = Math.min(content.length, cursorPos + 100);
    const contextText = content.substring(contextStart, contextEnd);

    setSelectedTextForAI(contextText);
    setActionTypeForAI(suggestion.actionType);
    setInlineSelectionStart(contextStart);
    setInlineSelectionEnd(contextEnd);
    setShowAISuggestions(false);

    // Generate immediately
    handleAIGenerate(contextText, suggestion.actionType, '');
  }, [content, handleAIGenerate]);

  // Event listeners
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.addEventListener('contextmenu', handleContextMenu as any);
    }

    return () => {
      if (textareaRef.current) {
        textareaRef.current.removeEventListener('contextmenu', handleContextMenu as any);
      }
    };
  }, [handleContextMenu]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      stopTypingAnimation();
    };
  }, [stopTypingAnimation]);

  // Click outside to hide suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setShowAISuggestions(false);
      }
    };

    if (showAISuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAISuggestions]);

  return (
    <>
      {isEditing ? (
        <div ref={containerRef} className="flex-1 p-3 sm:p-6 flex flex-col dark:bg-gray-800 lg:flex-row gap-4 modern-scrollbar overflow-y-auto min-w-0 relative h-full">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            placeholder="Start typing your note... (Right-click on selected text for AI assistance)"
            className="w-full lg:w-1/2 h-full resize-none border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-base leading-relaxed max-h-[600px] lg:max-h-none"
            style={{ minHeight: '400px', maxHeight: '600px', fontSize: '16px' }}
          />

          {/* Live Preview */}
          <div className="w-full lg:w-1/2 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[600px] lg:max-h-none">
            <div className="bg-blue-50 px-4 py-2 border-b bg-blue-100 dark:bg-blue-900 border-gray-200 dark:border-gray-700 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">
                Live Preview {isTypingAI && <span className="text-sm text-blue-600 dark:text-blue-400">(AI Typing...)</span>}
              </h3>
            </div>
            <div className="p-4 overflow-y-auto flex-1 modern-scrollbar">
              {content.trim() ? (
                <div className="prose prose-lg prose-slate dark:prose-invert max-w-none" style={{ fontSize: '16px', lineHeight: '1.7' }}>
                  {isTypingAI ? (
                    // Show raw text during AI typing to prevent diagram rendering errors
                    <pre className="whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-200 text-base leading-relaxed">
                      {content}
                    </pre>
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={commonMarkdownComponents}
                    >
                      {content}
                    </ReactMarkdown>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 dark:text-gray-500 italic text-base">Preview will appear here as you type...</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Read-only view
        <div className="flex-1 p-3 sm:p-6 bg-white dark:bg-gray-900 overflow-y-auto modern-scrollbar">
          {content.trim() ? (
            <div className="prose prose-lg prose-slate dark:prose-invert max-w-3xl mx-auto" style={{ fontSize: '16px', lineHeight: '1.7' }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={commonMarkdownComponents}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 dark:text-gray-500 text-2xl mb-2">📝</div>
              <p className="text-gray-500 dark:text-gray-400 text-lg">This note is empty</p>
              <p className="text-base text-gray-400 dark:text-gray-500 mt-1">Click edit to start writing</p>
            </div>
          )}
        </div>
      )}

      {/* AI Typing Overlay */}
      <AITypingOverlay
        isTypingAI={isTypingAI}
        typingComplete={typingComplete}
        isGeneratingAIInline={isGeneratingAIInline}
        onAccept={handleAcceptAI}
        onDecline={handleDeclineAI}
      />

      {/* Inline AI Editor Portal */}
      {isEditorVisible && createPortal(
        <InlineAIEditor
          position={editorPosition}
          selectedText={selectedTextForAI}
          actionType={actionTypeForAI}
          onGenerate={handleAIGenerate}
          originalText={content} // Pass the full content of the note
          onAccept={() => { /* Handle accept logic if needed */ }}
          onReject={() => setIsEditorVisible(false)} // Close editor on reject
          isVisible={isEditorVisible}
          isLoading={isGeneratingAIInline}
        />,
        document.body
      )}

      {/* AI Suggestions Portal */}
      <AISuggestionsPopup
        isVisible={showAISuggestions}
        position={aiSuggestionsPosition}
        suggestions={suggestedActions}
        onSuggestionClick={handleAISuggestionClick}
      />
    </>
  );
};