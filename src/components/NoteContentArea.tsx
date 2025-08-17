// components/NoteContentArea.tsx
import React, { useEffect, useRef, memo, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { Chart, registerables } from 'chart.js';
import {
  Edit3,
  Eye,
  Copy,
  Download,
  Share2,
  Printer,
  FileText,
  ZoomIn,
  ZoomOut,
  Type,
  Maximize2,
  Minimize2,
  SplitSquareHorizontal
} from 'lucide-react';

// Component imports
import { InlineAIEditor } from './InlineAIEditor';
import { AITypingOverlay } from './AITypingOverlay';
import { AISuggestionsPopup } from './AISuggestionsPopup';
import { commonMarkdownComponents } from './MarkdownComponent';

// Type imports
import { UserProfile } from '../types';
import { AISuggestion, AI_SUGGESTIONS } from '../constants/aiSuggestions';

// Utility imports
import { getTextareaCaretCoordinates } from '../utils/textareaUtils';
import { generateInlineContent } from '../services/aiServices';
import { useTypingAnimation } from './TypingAnimation';

Chart.register(...registerables);

interface NoteContentAreaProps {
  content: string;
  setContent: (content: string) => void;
  isEditing: boolean;
  userProfile: UserProfile | null;
  title?: string;
}

export const NoteContentArea: React.FC<NoteContentAreaProps> = ({
  content,
  setContent,
  isEditing,
  userProfile,
  title = 'Untitled Note',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const generatedContentBufferRef = useRef<string>('');
  const isTypingInProgressRef = useRef<boolean>(false);

  // View state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [viewMode, setViewMode] = useState<'preview' | 'split' | 'editor'>('preview');

  // Typing animation hook
  const { startTypingAnimation, stopTypingAnimation, currentTypingPosition, isTypingActive } = useTypingAnimation({
    textareaRef,
    setContent,
    onTypingComplete: () => {
      // console.log('Typing animation completed');
      setTypingComplete(true);
      setIsTypingAI(false);
      isTypingInProgressRef.current = false;
      toast.dismiss('inline-ai-gen');
      toast.success('AI content generated successfully!');
    },
  });

  // State for Inline AI Editor
  const [editorPosition, setEditorPosition] = useState({ top: 0, left: 0 });
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [selectedTextForAI, setSelectedTextForAI] = useState('');
  const [actionTypeForAI, setActionTypeForAI] = useState('');
  const [isGeneratingAIInline, setIsGeneratingAIInline] = useState(false);
  const [inlineSelectionStart, setInlineSelectionStart] = useState<number | null>(null);
  const [inlineSelectionEnd, setInlineSelectionEnd] = useState<number | null>(null);

  // States for AI typing
  const [isTypingAI, setIsTypingAI] = useState(false);
  const [originalContentBeforeAI, setOriginalContentBeforeAI] = useState('');
  const [typingComplete, setTypingComplete] = useState(false);

  // AI Suggestions state
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiSuggestionsPosition, setAISuggestionsPosition] = useState({ top: 0, left: 0 });
  const [suggestedActions, setSuggestedActions] = useState<AISuggestion[]>([]);

  // Update view mode based on isEditing prop
  useEffect(() => {
    setViewMode(isEditing ? 'split' : 'preview');
  }, [isEditing]);

  // Action handlers
  const handleCopyContent = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Content copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy content');
    }
  }, [content]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Note downloaded!');
  }, [content, title]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: content,
        });
      } catch (error) {
        // User cancelled or error occurred
        handleCopyContent();
      }
    } else {
      handleCopyContent();
    }
  }, [content, title, handleCopyContent]);

  const handlePrint = useCallback(() => {
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; }
            p { margin-bottom: 16px; }
            code { background: #f6f8fa; padding: 2px 4px; border-radius: 3px; }
            pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
            blockquote { border-left: 4px solid #dfe2e5; padding-left: 16px; margin: 0 0 16px 0; color: #6a737d; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div id="content"></div>
          <script type="module">
            import { marked } from 'https://cdn.skypack.dev/marked';
            const content = ${JSON.stringify(content)};
            document.getElementById('content').innerHTML = marked(content);
            window.print();
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  }, [content, title]);

  const adjustFontSize = useCallback((delta: number) => {
    setFontSize(prev => Math.max(12, Math.min(24, prev + delta)));
  }, []);

  // Detect AI-worthy content and show suggestions
  const detectAISuggestions = useCallback((text: string, cursorPosition: number) => {
    // Don't show suggestions while AI is typing
    if (isTypingInProgressRef.current || isTypingActive) return;

    if (!text.trim()) return;

    const start = Math.max(0, cursorPosition - 50);
    const end = Math.min(text.length, cursorPosition + 50);
    const context = text.substring(start, end);

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
        left: textareaRect.left + coords.left,
      });
      setShowAISuggestions(true);

      setTimeout(() => setShowAISuggestions(false), 5000);
    }
  }, [isTypingActive]);

  // Handle textarea input changes
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPosition = e.target.selectionStart;

    // If AI is currently typing and user tries to type, interrupt the typing
    // if (isTypingInProgressRef.current || (isTypingActive && !typingComplete)) {
    //   console.log('User interrupted AI typing, declining changes');
    //   handleDeclineAI();
    //   return;
    // }

    setContent(newContent);

    // Only detect suggestions if content is growing and cursor is in a reasonable position
    if (newContent.length > content.length && cursorPosition > 10) {
      detectAISuggestions(newContent, cursorPosition);
    }
  }, [content.length, isTypingActive, typingComplete, setContent, detectAISuggestions]);

  // Handle context menu for text selection AI
  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!textareaRef.current || !isEditing) return;

    // Don't show context menu while AI is typing
    if (isTypingInProgressRef.current || isTypingActive) return;

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
      setShowAISuggestions(false);
    } else {
      setIsEditorVisible(false);
    }
  }, [isEditing, isTypingActive]);

  // Handler for accepting AI suggestion
  // const handleAcceptAI = useCallback(() => {
  //   console.log('Accepting AI suggestion');

  //   // Reset all AI-related states
  //   setIsTypingAI(false);
  //   setTypingComplete(false);
  //   setOriginalContentBeforeAI('');
  //   setInlineSelectionStart(null);
  //   setInlineSelectionEnd(null);
  //   setIsGeneratingAIInline(false);
  //   isTypingInProgressRef.current = false;
  //   generatedContentBufferRef.current = '';

  //   toast.dismiss('inline-ai-gen');
  //   toast.success('AI suggestion accepted!');
  // }, [typingComplete, inlineSelectionStart, content, currentTypingPosition, setContent, stopTypingAnimation]);

  // Handler for declining AI suggestion
  // const handleDeclineAI = useCallback(() => {
  //   console.log('Declining AI suggestion');

  //   // Stop any ongoing typing animation
  //   stopTypingAnimation();

  //   // Restore original content
  //   setContent(originalContentBeforeAI);

  //   // Reset all AI-related states
  //   setIsTypingAI(false);
  //   setTypingComplete(false);
  //   setOriginalContentBeforeAI('');
  //   setInlineSelectionStart(null);
  //   setInlineSelectionEnd(null);
  //   setIsGeneratingAIInline(false);
  //   isTypingInProgressRef.current = false;
  //   generatedContentBufferRef.current = '';

  //   toast.dismiss('inline-ai-gen');
  //   toast.info('AI suggestion declined');
  // }, [originalContentBeforeAI, setContent, stopTypingAnimation]);

  // AI generation handler
  const handleAIGenerate = async (selectedText: string, actionType: string, customInstruction: string): Promise<void> => {
    if (!userProfile) {
      toast.error('User profile not found. Cannot generate content.');
      return;
    }

    // Don't start new generation if already in progress
    if (isGeneratingAIInline || isTypingInProgressRef.current) {
      // console.log('AI generation already in progress, skipping');
      return;
    }

    // console.log('Starting AI generation');
    setIsEditorVisible(false);
    setIsGeneratingAIInline(true);
    isTypingInProgressRef.current = true;

    // Show persistent loading toast
    toast.loading('Generating AI content...', {
      id: 'inline-ai-gen',
      duration: Infinity // Keep showing until manually dismissed
    });

    // Store original content for potential rollback
    setOriginalContentBeforeAI(content);

    try {
      const generatedContent = await generateInlineContent(
        selectedText,
        content,
        userProfile,
        actionType,
        customInstruction
      );

      if (!generatedContent || generatedContent.trim().length === 0) {
        throw new Error('Generated content is empty');
      }

      // console.log('AI content generated, length:', generatedContent.length);

      // Store generated content in buffer
      generatedContentBufferRef.current = generatedContent;

      // Calculate insertion position
      const start = inlineSelectionStart !== null ? inlineSelectionStart : content.length;
      const end = inlineSelectionEnd !== null ? inlineSelectionEnd : content.length;

      // Remove selected text and prepare for typing animation
      const contentWithoutSelection = content.substring(0, start) + content.substring(end);
      setContent(contentWithoutSelection);

      // Update states for typing animation
      setIsTypingAI(true);
      setTypingComplete(false);
      setIsGeneratingAIInline(false);

      // Start typing animation after a short delay
      setTimeout(() => {
        // console.log('Starting typing animation at position:', start);
        startTypingAnimation(generatedContent, start);
      }, 200);

    } catch (error) {
      console.error('AI generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate content with AI.';

      // Reset states on error
      setContent(originalContentBeforeAI);
      setIsTypingAI(false);
      setTypingComplete(false);
      setOriginalContentBeforeAI('');
      setIsGeneratingAIInline(false);
      isTypingInProgressRef.current = false;
      generatedContentBufferRef.current = '';

      toast.dismiss('inline-ai-gen');
      toast.error(errorMessage);
    }
  };

  // Handle AI suggestion click
  const handleAISuggestionClick = useCallback((suggestion: AISuggestion) => {
    if (!textareaRef.current || isTypingInProgressRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;

    const contextStart = Math.max(0, cursorPos - 100);
    const contextEnd = Math.min(content.length, cursorPos + 100);
    const contextText = content.substring(contextStart, contextEnd);

    setSelectedTextForAI(contextText);
    setActionTypeForAI(suggestion.actionType);
    setInlineSelectionStart(contextStart);
    setInlineSelectionEnd(contextEnd);
    setShowAISuggestions(false);

    handleAIGenerate(contextText, suggestion.actionType, '');
  }, [content, handleAIGenerate]);

  // Event listeners
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('contextmenu', handleContextMenu as any);
    }

    return () => {
      if (textarea) {
        textarea.removeEventListener('contextmenu', handleContextMenu as any);
      }
    };
  }, [handleContextMenu]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTypingAnimation();
      isTypingInProgressRef.current = false;
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

  // Render enhanced toolbar (only when not editing or when user wants quick actions)
  const renderEnhancedToolbar = () => (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-wrap gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {isEditing && (
          <Button
            onClick={() => setViewMode(viewMode === 'split' ? 'editor' : 'split')}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            disabled={isTypingInProgressRef.current}
          >
            <SplitSquareHorizontal className="w-4 h-4" />
            {viewMode === 'split' ? 'Editor Only' : 'Split View'}
          </Button>
        )}

        <div className="flex items-center gap-1 border border-gray-300 dark:border-gray-600 rounded">
          <Button
            onClick={() => adjustFontSize(-2)}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={isTypingInProgressRef.current}
          >
            <ZoomOut className="w-3 h-3" />
          </Button>
          <span className="px-2 text-xs text-gray-600 dark:text-gray-400">{fontSize}px</span>
          <Button
            onClick={() => adjustFontSize(2)}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={isTypingInProgressRef.current}
          >
            <ZoomIn className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          onClick={handleCopyContent}
          variant="ghost"
          size="sm"
          className="flex items-center gap-2"
          disabled={!content.trim() || isTypingInProgressRef.current}
        >
          <Copy className="w-4 h-4" />
          <span className="hidden sm:inline">Copy</span>
        </Button>

        <Button
          onClick={handleDownload}
          variant="ghost"
          size="sm"
          className="flex items-center gap-2"
          disabled={!content.trim() || isTypingInProgressRef.current}
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Download</span>
        </Button>

        <Button
          onClick={handleShare}
          variant="ghost"
          size="sm"
          className="flex items-center gap-2"
          disabled={!content.trim() || isTypingInProgressRef.current}
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Share</span>
        </Button>

        <Button
          onClick={handlePrint}
          variant="ghost"
          size="sm"
          className="flex items-center gap-2"
          disabled={!content.trim() || isTypingInProgressRef.current}
        >
          <Printer className="w-4 h-4" />
          <span className="hidden sm:inline">Print</span>
        </Button>

        <Button
          onClick={() => setIsFullscreen(!isFullscreen)}
          variant="ghost"
          size="sm"
          className="flex items-center gap-2"
          disabled={isTypingInProgressRef.current}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );

  // Main content based on editing state and view mode
  const renderContent = () => {
    if (!isEditing) {
      // Preview-only mode (default)
      return (
        <div
          ref={previewRef}
          className="flex-1 overflow-y-auto modern-scrollbar"
          style={{ fontSize: `${fontSize}px` }}
          id="note-preview-content"
        >
          {content.trim() ? (
            <div className="p-6">
              <div className="prose prose-lg prose-slate dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={commonMarkdownComponents}
                >
                  {content}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="text-center">
                <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">📝</div>
                <p className="text-gray-500 dark:text-gray-400 text-xl mb-2">This note is empty</p>
                <p className="text-gray-400 dark:text-gray-500 mb-4">Click edit in the header to start writing</p>
              </div>
            </div>
          )}
        </div>
      );
    } else {
      // Editing mode with split view or editor only
      if (viewMode === 'editor') {
        return (
          <div className="flex-1 p-4 min-h-0">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder="Start typing your note... (Right-click on selected text for AI assistance)"
              className="w-full h-full resize-none border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono leading-relaxed"
              style={{ fontSize: `${fontSize}px`, minHeight: '400px' }}
              disabled={isTypingInProgressRef.current}
            />
          </div>
        );
      } else {
        return (
          <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0">
            {/* Editor */}
            <div className="flex flex-col lg:w-1/2">
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={handleContentChange}
                placeholder="Start typing your note... (Right-click on selected text for AI assistance)"
                className="flex-1 resize-none border-2 border-dashed border-gray-300 modern-scrollbar dark:border-gray-600 rounded-lg p-4 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono leading-relaxed"
                style={{ fontSize: `${fontSize}px`, minHeight: '400px' }}
                disabled={isTypingInProgressRef.current}
              />
            </div>

            {/* Live Preview */}
            <div className="lg:w-1/2 flex flex-col">
              <div className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Live Preview
                    {isGeneratingAIInline && <span className="text-blue-600 dark:text-blue-400 ml-2">(Generating...)</span>}
                    {isTypingActive && !typingComplete && <span className="text-green-600 dark:text-green-400 ml-2">(AI Typing...)</span>}
                  </h3>
                </div>
                <div
                  className="p-4 overflow-y-scroll h-full  modern-scrollbar flex-1"
                  style={{ fontSize: `${fontSize}px` }}
                  id="note-preview-content"
                >
                  {content.trim() ? (
                    <div className="prose prose-slate dark:prose-invert max-w-none">
                      {isTypingActive && !typingComplete ? (
                        <pre className="whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-200 leading-relaxed">
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
                    <p className="text-gray-400 dark:text-gray-500 italic">Preview will appear here as you type...</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-white dark:bg-gray-900 ${isFullscreen
        ? 'fixed inset-0 z-50'
        : 'flex-1 min-h-0'
        }`}
    >
      {/* Enhanced Toolbar - Only show when not editing or when user needs quick actions */}
      {(!isEditing || isFullscreen) && renderEnhancedToolbar()}

      {/* Main Content */}
      {renderContent()}

      {/* AI Typing Overlay */}
      {/* <AITypingOverlay
        isTypingAI={isTypingActive || isGeneratingAIInline}
        typingComplete={typingComplete}
        isGeneratingAIInline={isGeneratingAIInline}
        onAccept={handleAcceptAI}
        onDecline={handleDeclineAI}
      /> */}

      {/* Inline AI Editor Portal */}
      {isEditorVisible && createPortal(
        <InlineAIEditor
          position={editorPosition}
          selectedText={selectedTextForAI}
          actionType={actionTypeForAI}
          onGenerate={handleAIGenerate}
          originalText={content}
          onAccept={() => { }}
          onReject={() => setIsEditorVisible(false)}
          isVisible={isEditorVisible}
          isLoading={isGeneratingAIInline}
        />,
        document.body
      )}

      {/* AI Suggestions Portal */}
      <AISuggestionsPopup
        isVisible={showAISuggestions && !isTypingInProgressRef.current}
        position={aiSuggestionsPosition}
        suggestions={suggestedActions}
        onSuggestionClick={handleAISuggestionClick} 
        onClose={() => setShowAISuggestions(false)}
      />
    </div>
  );
};