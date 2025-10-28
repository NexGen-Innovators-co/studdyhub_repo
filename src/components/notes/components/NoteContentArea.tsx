// components/NoteContentArea.tsx - FIXED VERSION
import React, { useEffect, useRef, memo, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
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
  SplitSquareHorizontal,
  ChevronDown,
  FileDown
} from 'lucide-react';

// Component imports
import { InlineAIEditor } from './InlineAIEditor';
import { AITypingOverlay } from './AITypingOverlay';
import { AISuggestionsPopup } from './AISuggestionsPopup';
import { commonMarkdownComponents } from './MarkdownComponent';

// Type imports
import { UserProfile } from '../../../types';
import { AISuggestion, AI_SUGGESTIONS } from '../../../constants/aiSuggestions';

// Utility imports
import { getTextareaCaretCoordinates } from '../utils/textareaUtils';
import { generateInlineContent } from '../../../services/aiServices';
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
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  // Typing animation hook
  const { startTypingAnimation, stopTypingAnimation, currentTypingPosition, isTypingActive } = useTypingAnimation({
    textareaRef,
    setContent,
    onTypingComplete: () => {
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

  const handleDownloadMarkdown = useCallback(() => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Note downloaded as Markdown!');
    setShowDownloadMenu(false);
  }, [content, title]);

  const handleDownloadHTML = useCallback(() => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              line-height: 1.6; 
              max-width: 800px; 
              margin: 40px auto; 
              padding: 20px; 
              color: #24292e;
            }
            h1, h2, h3, h4, h5, h6 { 
              margin-top: 24px; 
              margin-bottom: 16px; 
              font-weight: 600;
              line-height: 1.25;
            }
            h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
            h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
            p { margin-bottom: 16px; }
            code { 
              background: #f6f8fa; 
              padding: 2px 6px; 
              border-radius: 3px; 
              font-family: 'Courier New', Consolas, monospace;
              font-size: 0.9em;
            }
            pre { 
              background: #f6f8fa; 
              padding: 16px; 
              border-radius: 6px; 
              overflow-x: auto;
              margin: 16px 0;
            }
            pre code {
              background: none;
              padding: 0;
            }
            blockquote { 
              border-left: 4px solid #dfe2e5; 
              padding-left: 16px; 
              margin: 0 0 16px 0; 
              color: #6a737d; 
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 16px 0;
            }
            th, td {
              border: 1px solid #dfe2e5;
              padding: 8px 12px;
              text-align: left;
            }
            th {
              background: #f6f8fa;
              font-weight: 600;
            }
            a { color: #0366d6; text-decoration: none; }
            a:hover { text-decoration: underline; }
            img { max-width: 100%; height: auto; }
            ul, ol { margin-bottom: 16px; padding-left: 2em; }
            li { margin-bottom: 8px; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div id="content"></div>
          <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
          <script>
            marked.setOptions({
              breaks: true,
              gfm: true
            });
            document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(content)});
          </script>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Note downloaded as HTML!');
    setShowDownloadMenu(false);
  }, [content, title]);

  const handleDownloadPDF = useCallback(() => {
    const previewElement = document.getElementById('note-preview-content');
    if (!previewElement) {
      toast.error('Could not find preview content to generate PDF');
      return;
    }

    if (typeof window.html2pdf === 'undefined') {
      toast.error('PDF generation library not loaded. Please refresh the page and try again.');
      return;
    }

    toast.loading('Generating PDF...', { id: 'pdf-download' });

    window.html2pdf()
      .from(previewElement)
      .set({
        margin: [15, 15, 15, 15],
        filename: `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          letterRendering: true,
          logging: false
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' 
        },
      })
      .save()
      .then(() => {
        toast.success('Note downloaded as PDF!', { id: 'pdf-download' });
        setShowDownloadMenu(false);
      })
      .catch((error: Error) => {
        toast.error('Failed to generate PDF: ' + error.message, { id: 'pdf-download' });
        console.error('PDF generation error:', error);
      });
  }, [content, title]);

  const handleDownloadText = useCallback(() => {
    // Convert markdown to plain text by removing markdown syntax
    const plainText = content
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italics
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links, keep text
      .replace(/^[-*+]\s/gm, '') // Remove list markers
      .replace(/^\d+\.\s/gm, ''); // Remove numbered list markers

    const blob = new Blob([plainText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Note downloaded as Text!');
    setShowDownloadMenu(false);
  }, [content, title]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: content,
        });
      } catch (error) {
        handleCopyContent();
      }
    } else {
      handleCopyContent();
    }
  }, [content, title, handleCopyContent]);

  const handlePrint = useCallback(() => {
    // Create a temporary div to render the markdown
    const printDiv = document.createElement('div');
    printDiv.style.display = 'none';
    document.body.appendChild(printDiv);

    // Render the markdown content using React
    const root = createRoot(printDiv);
    root.render(
      <div style={{ 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        lineHeight: '1.6',
        maxWidth: '800px',
        margin: '0 auto',
        padding: '20px'
      }}>
        <h1>{title}</h1>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={commonMarkdownComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    );

    // Wait for render to complete
    setTimeout(() => {
      const printContent = printDiv.innerHTML;
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${title}</title>
              <style>
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                  line-height: 1.6; 
                  max-width: 800px; 
                  margin: 0 auto; 
                  padding: 20px; 
                }
                h1, h2, h3, h4, h5, h6 { 
                  margin-top: 24px; 
                  margin-bottom: 16px; 
                  font-weight: 600;
                }
                p { margin-bottom: 16px; }
                code { 
                  background: #f6f8fa; 
                  padding: 2px 4px; 
                  border-radius: 3px; 
                  font-family: 'Courier New', monospace;
                }
                pre { 
                  background: #f6f8fa; 
                  padding: 16px; 
                  border-radius: 6px; 
                  overflow-x: auto; 
                }
                pre code {
                  background: none;
                  padding: 0;
                }
                blockquote { 
                  border-left: 4px solid #dfe2e5; 
                  padding-left: 16px; 
                  margin: 0 0 16px 0; 
                  color: #6a737d; 
                }
                table {
                  border-collapse: collapse;
                  width: 100%;
                  margin: 16px 0;
                }
                th, td {
                  border: 1px solid #dfe2e5;
                  padding: 8px 12px;
                  text-align: left;
                }
                th {
                  background: #f6f8fa;
                  font-weight: 600;
                }
                img {
                  max-width: 100%;
                  height: auto;
                }
                @media print {
                  body { margin: 0; padding: 10mm; }
                  h1 { page-break-before: avoid; }
                  pre, blockquote { page-break-inside: avoid; }
                }
              </style>
            </head>
            <body>
              ${printContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        
        // Wait for content to load, then print
        printWindow.onload = () => {
          printWindow.focus();
          printWindow.print();
          
          // Clean up after printing
          printWindow.onafterprint = () => {
            printWindow.close();
          };
        };
      }

      // Clean up the temporary div
      root.unmount();
      document.body.removeChild(printDiv);
    }, 100);
  }, [content, title]);

  const adjustFontSize = useCallback((delta: number) => {
    setFontSize(prev => Math.max(12, Math.min(24, prev + delta)));
  }, []);

  // Detect AI-worthy content and show suggestions
  const detectAISuggestions = useCallback((text: string, cursorPosition: number) => {
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

    setContent(newContent);

    if (newContent.length > content.length && cursorPosition > 10) {
      detectAISuggestions(newContent, cursorPosition);
    }
  }, [content.length, setContent, detectAISuggestions]);

  // Handle context menu for text selection AI
  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!textareaRef.current || !isEditing) return;
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

  // AI generation handler
  const handleAIGenerate = async (selectedText: string, actionType: string, customInstruction: string): Promise<void> => {
    if (!userProfile) {
      toast.error('User profile not found. Cannot generate content.');
      return;
    }

    if (isGeneratingAIInline || isTypingInProgressRef.current) {
      return;
    }

    setIsEditorVisible(false);
    setIsGeneratingAIInline(true);
    isTypingInProgressRef.current = true;

    toast.loading('Generating AI content...', {
      id: 'inline-ai-gen',
      duration: Infinity
    });

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

      generatedContentBufferRef.current = generatedContent;

      const start = inlineSelectionStart !== null ? inlineSelectionStart : content.length;
      const end = inlineSelectionEnd !== null ? inlineSelectionEnd : content.length;

      const contentWithoutSelection = content.substring(0, start) + content.substring(end);
      setContent(contentWithoutSelection);

      setIsTypingAI(true);
      setTypingComplete(false);
      setIsGeneratingAIInline(false);

      setTimeout(() => {
        startTypingAnimation(generatedContent, start);
      }, 200);

    } catch (error) {
      console.error('AI generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate content with AI.';

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

  // Click outside to hide suggestions and download menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setShowAISuggestions(false);
        setShowDownloadMenu(false);
      }
    };

    if (showAISuggestions || showDownloadMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAISuggestions, showDownloadMenu]);

  // Render enhanced toolbar
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

        {/* Download Dropdown */}
        <div className="relative">
          <Button
            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
            disabled={!content.trim() || isTypingInProgressRef.current}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
          
          {showDownloadMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
              <Button
                onClick={handleDownloadMarkdown}
                variant="ghost"
                size="sm"
                className="w-full justify-start px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FileText className="w-4 h-4 mr-2" />
                Markdown (.md)
              </Button>
              <Button
                onClick={handleDownloadHTML}
                variant="ghost"
                size="sm"
                className="w-full justify-start px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FileText className="w-4 h-4 mr-2" />
                HTML (.html)
              </Button>
              <Button
                onClick={handleDownloadPDF}
                variant="ghost"
                size="sm"
                className="w-full justify-start px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FileDown className="w-4 h-4 mr-2" />
                PDF (.pdf)
              </Button>
              <Button
                onClick={handleDownloadText}
                variant="ghost"
                size="sm"
                className="w-full justify-start px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Type className="w-4 h-4 mr-2" />
                Plain Text (.txt)
              </Button>
            </div>
          )}
        </div>

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
                  className="p-4 overflow-y-scroll h-full modern-scrollbar flex-1"
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
      {(!isEditing || isFullscreen) && renderEnhancedToolbar()}

      {renderContent()}

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