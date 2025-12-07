// components/AISummarySection.tsx - FIXED VERSION
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Sparkles, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { CodeRenderer } from './CodeRenderer';

interface AISummarySectionProps {
  ai_summary: string | null;
  isSummaryVisible: boolean;
  setIsSummaryVisible: (isVisible: boolean) => void;
}

export const AISummarySection: React.FC<AISummarySectionProps> = ({
  ai_summary,
  isSummaryVisible,
  setIsSummaryVisible,
}) => {
  if (!ai_summary) {
    return null;
  }

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
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={commonMarkdownComponents}
            >
              {String(ai_summary || '')}
            </ReactMarkdown>
          </div>
        </div>

        {/* Mobile drag handle */}
        <div className="lg:hidden flex-shrink-0 py-2 flex justify-center bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-gray-700 dark:to-gray-800 border-t border-blue-200 dark:border-gray-600">
          <div className="w-12 h-1 bg-gray-400 dark:bg-gray-500 rounded-full" />
        </div>
      </div>
    </>
  );
};