// components/TranslatedContentSection.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { FileText, ChevronUp } from 'lucide-react';
import { Button } from '../../ui/button';
import { CodeRenderer } from './CodeRenderer'; // Assuming CodeRenderer is exported from NoteContentArea

interface TranslatedContentSectionProps {
  translatedContent: string | null;
  targetLanguage: string;
  setTranslatedContent: (content: string | null) => void;
}

export const TranslatedContentSection: React.FC<TranslatedContentSectionProps> = ({
  translatedContent,
  targetLanguage,
  setTranslatedContent,
}) => {
  if (!translatedContent) {
    return null;
  }

  const commonMarkdownComponents = {
    code: CodeRenderer,
    table: ({ node, ...props }: any) => (
      <div className="overflow-x-auto my-4 rounded-lg shadow-md border border-slate-200 dark:border-gray-700">
        <table className="w-full border-collapse" {...props} />
      </div>
    ),
    thead: ({ node, ...props }: any) => <thead className="bg-gradient-to-r from-blue-100 to-blue-100 dark:from-blue-900 dark:to-blue-900" {...props} />,
    th: ({ node, ...props }: any) => <th className="p-3 text-left border-b border-slate-300 font-semibold text-slate-800 dark:border-gray-600 dark:text-gray-100" {...props} />,
    td: ({ node, ...props }: any) => <td className="p-3 border-b border-slate-200 group-last:border-b-0 even:bg-slate-50 hover:bg-blue-50 transition-colors dark:border-gray-700 dark:even:bg-gray-800 dark:hover:bg-blue-900 dark:text-gray-200" {...props} />,
    h1: ({ node, ...props }: any) => <h1 className="text-3xl font-extrabold text-blue-700 mt-6 mb-3 dark:text-blue-400" {...props} />,
    h2: ({ node, ...props }: any) => <h2 className="text-2xl font-bold text-blue-700 mt-5 mb-2 dark:text-blue-400" {...props} />,
    h3: ({ node, ...props }: any) => <h3 className="text-xl font-semibold text-green-700 mt-4 mb-2 dark:text-green-400" {...props} />,
    h4: ({ node, ...props }: any) => <h4 className="text-lg font-semibold text-orange-700 mt-3 mb-1 dark:text-orange-400" {...props} />,
    ul: ({ node, ...props }: any) => <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-gray-200" {...props} />,
    ol: ({ node, ...props }: any) => <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-gray-200" {...props} />,
    blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-blue-400 pl-4 py-2 italic text-slate-600 bg-blue-50 rounded-r-md my-4 dark:border-blue-700 dark:text-gray-300 dark:bg-blue-950" {...props} />,
    p: ({ node, ...props }: any) => <p className="mb-3 text-slate-700 leading-relaxed dark:text-gray-200" {...props} />,
    a: ({ node, ...props }: any) => <a className="text-blue-600 hover:underline dark:text-blue-400 dark:hover:underline" {...props} />,
  };

  return (
    <div className="p-3 sm:p-6 border-t border-slate-200 bg-slate-50 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2 mb-3 cursor-pointer" onClick={() => setTranslatedContent(null)}>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-600 dark:text-gray-400" />
          <h4 className="font-medium text-slate-800 dark:text-gray-100">Translated Content ({targetLanguage.toUpperCase()})</h4>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-600 hover:bg-slate-50 dark:text-gray-400 dark:hover:bg-gray-800">
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>
      <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed dark:text-gray-200">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={commonMarkdownComponents}
        >
          {String(translatedContent || '')}
        </ReactMarkdown>
      </div>
    </div>
  );
};
