// components/AISummarySection.tsx - FIXED VERSION
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Sparkles, ChevronDown, ChevronUp, X, Edit2, Save, RotateCw, Loader2, Bold, Italic, List, ListOrdered, Quote, Undo, Redo } from 'lucide-react';
import { Button } from '../../ui/button';
import { CodeRenderer } from './CodeRenderer';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { convertMarkdownToHtml, convertHtmlToMarkdown } from '../../../utils/markdownUtils';

interface AISummarySectionProps {
  ai_summary: string | null;
  isSummaryVisible: boolean;
  setIsSummaryVisible: (isVisible: boolean) => void;
  onSummaryChange?: (newSummary: string) => void;
  onRegenerateSummary?: () => void;
  isGenerating?: boolean;
}

export const AISummarySection: React.FC<AISummarySectionProps> = ({
  ai_summary,
  isSummaryVisible,
  setIsSummaryVisible,
  onSummaryChange,
  onRegenerateSummary,
  isGenerating = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Underline,
      Placeholder.configure({ placeholder: 'Edit your summary here...' }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] p-4 bg-white dark:bg-gray-950 rounded-md border border-blue-200 dark:border-gray-700',
      },
    },
  });

  // Update editor content when entering edit mode
  useEffect(() => {
    if (isEditing && editor && ai_summary) {
      const html = convertMarkdownToHtml(ai_summary);
      editor.commands.setContent(html);
    }
  }, [isEditing, editor, ai_summary]);

  // Early return removed to allowed empty state rendering
  // if (!ai_summary && !isGenerating) {
  //   return null;
  // }

  const handleSave = () => {
    if (onSummaryChange && editor) {
      const html = editor.getHTML();
      const markdown = convertHtmlToMarkdown(html);
      onSummaryChange(markdown);
    }
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleRegenerate = () => {
    if (onRegenerateSummary) {
      onRegenerateSummary();
    }
  };

  const commonMarkdownComponents = {
    code: CodeRenderer,
    table: ({ node, ...props }: any) => (
      <div className="overflow-x-auto my-4 shadow-md border border-slate-200 dark:border-gray-700">
        <table className="w-full border-collapse" {...props} />
      </div>
    ),
    thead: ({ node, ...props }: any) => (
      <thead className="bg-gradient-to-r from-blue-100 to-blue-100 dark:from-blue-900 dark:to-blue-900" {...props} />
    ),
    th: ({ node, ...props }: any) => (
      <th className="p-3 text-left border-b border-slate-300 font-semibold text-slate-800 dark:border-gray-600 dark:text-gray-100" {...props} />
    ),
    td: ({ node, ...props }: any) => (
      <td className="p-3 border-b border-slate-200 even:bg-slate-50 hover:bg-blue-50 transition-colors dark:border-gray-700 dark:even:bg-gray-800 dark:hover:bg-blue-900 dark:text-gray-200" {...props} />
    ),
    h1: ({ node, ...props }: any) => (
      <h1 className="text-2xl font-bold text-blue-700 mt-6 mb-3 dark:text-blue-400" {...props} />
    ),
    h2: ({ node, ...props }: any) => (
      <h2 className="text-xl font-semibold text-blue-700 mt-5 mb-2 dark:text-blue-400" {...props} />
    ),
    h3: ({ node, ...props }: any) => (
      <h3 className="text-lg font-semibold text-green-700 mt-4 mb-2 dark:text-green-400" {...props} />
    ),
    h4: ({ node, ...props }: any) => (
      <h4 className="text-base font-semibold text-orange-700 mt-3 mb-1 dark:text-orange-400" {...props} />
    ),
    ul: ({ node, ...props }: any) => (
      <ul className="list-disc list-inside space-y-1 text-slate-700 my-2 dark:text-gray-200" {...props} />
    ),
    ol: ({ node, ...props }: any) => (
      <ol className="list-decimal list-inside space-y-1 text-slate-700 my-2 dark:text-gray-200" {...props} />
    ),
    blockquote: ({ node, ...props }: any) => (
      <blockquote className="border-l-4 border-blue-400 pl-4 py-2 italic text-slate-600 bg-blue-50 rounded-r-md my-4 dark:border-blue-700 dark:text-gray-300 dark:bg-blue-950" {...props} />
    ),
    p: ({ node, ...props }: any) => (
      <p className="mb-3 text-slate-700 leading-relaxed dark:text-gray-200" {...props} />
    ),
    a: ({ node, ...props }: any) => (
      <a className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noopener noreferrer" {...props} />
    ),
    li: ({ node, ...props }: any) => (
      <li className="text-slate-700 dark:text-gray-200 ml-1" {...props} />
    ),
    strong: ({ node, ...props }: any) => (
      <strong className="font-semibold text-slate-900 dark:text-gray-100" {...props} />
    ),
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isSummaryVisible && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSummaryVisible(false)}
        />
      )}

      {/* AI Summary Panel */}
      <div
        className={`
          ${/* Desktop Styles */ ''}
          lg:block lg:relative lg:max-h-screen lg:w-80 
          lg:border-l lg:border-gray-200 lg:dark:border-gray-700
          lg:bg-gradient-to-br lg:from-blue-50 lg:to-indigo-50
          lg:dark:from-gray-800 lg:dark:to-gray-900
          lg:shadow-inner lg:overflow-y-auto lg:pb-12
          

          ${/* Mobile Styles */ ''}
          fixed bottom-0 left-0 right-0 z-50 lg:z-0 max-h-[45vh] 
          
          bg-white dark:bg-gray-800
          
          border-t border-gray-200 dark:border-gray-700

          ${/* Animation */ ''}
          transition-transform duration-300 ease-in-out
          ${isSummaryVisible ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
          
          ${/* Layout */ ''}
          flex flex-col overflow-scroll
        `}
      >
        {/* Header */}
        <div className="flex-shrink-0 sticky top-0 z-10 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-gray-700 dark:to-gray-800 border-b border-blue-200 dark:border-gray-600 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500 dark:bg-blue-600 rounded-lg">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h4 className="font-semibold text-slate-800 dark:text-gray-100 text-sm">
                AI Summary
              </h4>
            </div>

            <div className="flex items-center gap-1">
              {/* Regenerate Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="h-8 w-8 p-0 hover:bg-blue-200 dark:hover:bg-gray-600"
                title="Regenerate Summary"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : (
                  <RotateCw className="h-4 w-4 text-slate-600 dark:text-gray-400" />
                )}
              </Button>

              {/* Edit/Save Toggle */}
              {isEditing ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSave}
                  className="h-8 w-8 p-0 hover:bg-green-200 dark:hover:bg-green-900/30"
                  title="Save Summary"
                >
                  <Save className="h-4 w-4 text-green-600 dark:text-green-400" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  className="h-8 w-8 p-0 hover:bg-blue-200 dark:hover:bg-gray-600"
                  title="Edit Summary"
                >
                  <Edit2 className="h-4 w-4 text-slate-600 dark:text-gray-400" />
                </Button>
              )}

              {/* Desktop Toggle - Hide Summary */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSummaryVisible(!isSummaryVisible)}
                className="hidden lg:flex h-8 w-8 p-0 hover:bg-blue-200 dark:hover:bg-gray-600"
                title={isSummaryVisible ? "Hide Summary" : "Show Summary"}
              >
                <X className="h-4 w-4 text-slate-600 dark:text-gray-400" />
              </Button>

              {/* Mobile Close Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSummaryVisible(false)}
                className="lg:hidden h-8 w-8 p-0 hover:bg-blue-200 dark:hover:bg-gray-600"
                title="Close"
              >
                <ChevronDown className="h-5 w-5 text-slate-600 dark:text-gray-400" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area with Scroll */}
        <div className="flex-1 overflow-y-auto modern-scrollbar px-4 py-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-gray-800 dark:to-gray-900">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-slate-600 dark:text-gray-400 animate-pulse">
                AI is crafting your summary...
              </p>
            </div>
          ) : isEditing ? (
            <div className="h-full flex flex-col space-y-2">
              {/* Mini Toolbar */}
              <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-gray-800 rounded-md border border-slate-200 dark:border-gray-700">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={`h-8 w-8 p-0 ${editor?.isActive('bold') ? 'bg-blue-200 dark:bg-blue-900' : ''}`}
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={`h-8 w-8 p-0 ${editor?.isActive('italic') ? 'bg-blue-200 dark:bg-blue-900' : ''}`}
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  className={`h-8 w-8 p-0 ${editor?.isActive('bulletList') ? 'bg-blue-200 dark:bg-blue-900' : ''}`}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  className={`h-8 w-8 p-0 ${editor?.isActive('orderedList') ? 'bg-blue-200 dark:bg-blue-900' : ''}`}
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                  className={`h-8 w-8 p-0 ${editor?.isActive('blockquote') ? 'bg-blue-200 dark:bg-blue-900' : ''}`}
                >
                  <Quote className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 bg-slate-300 dark:bg-gray-600 mx-1 self-center" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().undo().run()}
                  className="h-8 w-8 p-0"
                >
                  <Undo className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().redo().run()}
                  className="h-8 w-8 p-0"
                >
                  <Redo className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto modern-scrollbar">
                <EditorContent editor={editor} />
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsEditing(false)}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSave}
                  className="text-xs h-8 bg-blue-600 hover:bg-blue-700"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          ) : !ai_summary ? (
             <div className="flex flex-col items-center justify-center h-48 lg:h-full text-center p-4 space-y-3 opacity-70">
                <Sparkles className="h-10 w-10 text-blue-400 mb-2" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No summary available</p>
                <Button size="sm" onClick={handleRegenerate} className="bg-blue-600 hover:bg-blue-700 text-white">
                  Generate Summary
                </Button>
             </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={commonMarkdownComponents}
              >
                {String(ai_summary || '')}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Mobile drag handle */}
        <div className="lg:hidden flex-shrink-0 py-2 flex justify-center bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-gray-700 dark:to-gray-800 border-t border-blue-200 dark:border-gray-600">
          <div className="w-12 h-1 bg-gray-400 dark:bg-gray-500 rounded-full" />
        </div>
      </div>
    </>
  );
};