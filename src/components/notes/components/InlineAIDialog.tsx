// components/InlineAIDialog.tsx
import React, { useState } from 'react'; // Import useState
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Loader2, Check, Copy, ChevronDown, ChevronUp } from 'lucide-react'; // Import Chevron icons
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { CodeRenderer } from './CodeRenderer'; // Assuming CodeRenderer is exported
import { Textarea } from '../../ui/textarea'; // Import Textarea for custom instructions

interface InlineAIDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  generatedContent: string;
  isLoading: boolean;
  actionType: string;
  onInsert: (content: string) => void;
  onGenerate: (selectedText: string, actionType: string, customInstruction: string) => Promise<void>; // New prop for triggering generation
  customInstruction: string;
  setCustomInstruction: (instruction: string) => void;
}

export const InlineAIDialog: React.FC<InlineAIDialogProps> = ({
  isOpen,
  onClose,
  selectedText,
  generatedContent,
  isLoading,
  actionType,
  onInsert,
  onGenerate, // Destructure new prop
  customInstruction,
  setCustomInstruction,
}) => {
  const { copied, copy } = useCopyToClipboard();
  const [showCustomInstructionInput, setShowCustomInstructionInput] = useState(false); // New state for toggling custom instruction

  const commonMarkdownComponents = {
    code: CodeRenderer,
    table: ({ node, ...props }: any) => (
      <div className="overflow-x-auto my-4 rounded-lg shadow-md border border-slate-200 dark:border-gray-700">
        <table className="w-full border-collapse" {...props} />
      </div>
    ),
    thead: ({ node, ...props }: any) => <thead className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900" {...props} />,
    th: ({ node, ...props }: any) => <th className="p-3 text-left border-b border-slate-300 font-semibold text-slate-800 dark:border-gray-600 dark:text-gray-100" {...props} />,
    td: ({ node, ...props }: any) => <td className="p-3 border-b border-slate-200 group-last:border-b-0 even:bg-slate-50 hover:bg-blue-50 transition-colors dark:border-gray-700 dark:even:bg-gray-800 dark:hover:bg-blue-900 dark:text-gray-200" {...props} />,
    h1: ({ node, ...props }: any) => <h1 className="text-3xl font-extrabold text-blue-700 mt-6 mb-3 dark:text-blue-400" {...props} />,
    h2: ({ node, ...props }: any) => <h2 className="text-2xl font-bold text-purple-700 mt-5 mb-2 dark:text-purple-400" {...props} />,
    h3: ({ node, ...props }: any) => <h3 className="text-xl font-semibold text-green-700 mt-4 mb-2 dark:text-green-400" {...props} />,
    h4: ({ node, ...props }: any) => <h4 className="text-lg font-semibold text-orange-700 mt-3 mb-1 dark:text-orange-400" {...props} />,
    ul: ({ node, ...props }: any) => <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-gray-200" {...props} />,
    ol: ({ node, ...props }: any) => <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-gray-200" {...props} />,
    blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-blue-400 pl-4 py-2 italic text-slate-600 bg-blue-50 rounded-r-md my-4 dark:border-blue-700 dark:text-gray-300 dark:bg-blue-950" {...props} />,
    p: ({ node, ...props }: any) => <p className="mb-3 text-slate-700 leading-relaxed dark:text-gray-200" {...props} />,
    a: ({ node, ...props }: any) => <a className="text-blue-600 hover:underline dark:text-blue-400 dark:hover:underline" {...props} />,
  };

  const dialogTitle = actionType.charAt(0).toUpperCase() + actionType.slice(1) + ' with AI';

  const handleGenerateClick = () => {
    onGenerate(selectedText, actionType, customInstruction);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800 dark:text-gray-100">{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto modern-scrollbar p-2 border rounded-md bg-slate-50 dark:bg-gray-800 dark:border-gray-700">
          <h5 className="font-semibold text-slate-700 mb-2 dark:text-gray-200">Selected Text:</h5>
          <div className="p-3 mb-4 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-sm italic dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300">
            {selectedText || 'No text selected.'}
          </div>

          <div className="flex items-center justify-between mb-2">
            <h5 className="font-semibold text-slate-700 dark:text-gray-200">Custom Instructions (Optional):</h5>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCustomInstructionInput(!showCustomInstructionInput)}
              className="h-6 w-6 p-0 text-slate-600 hover:bg-slate-50 dark:text-gray-400 dark:hover:bg-gray-800"
              title={showCustomInstructionInput ? 'Hide custom instructions' : 'Show custom instructions'}
            >
              {showCustomInstructionInput ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {showCustomInstructionInput && (
            <Textarea
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="e.g., 'Make it more concise and add a real-world example.'"
              className="mb-4 resize-none border shadow-sm focus-visible:ring-0 text-base leading-relaxed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              rows={3}
            />
          )}

          <Button
            onClick={handleGenerateClick}
            disabled={isLoading || !selectedText.trim()}
            className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-md hover:from-green-600 hover:to-teal-600 mb-4"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...
              </>
            ) : (
              'Generate with AI'
            )}
          </Button>

          <h5 className="font-semibold text-slate-700 mb-2 dark:text-gray-200">AI Generated Content:</h5>
          <div className="relative min-h-[150px] p-3 rounded-md border border-slate-200 bg-white dark:bg-gray-900 dark:border-gray-700">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 dark:bg-gray-900 dark:bg-opacity-80">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed dark:text-gray-200">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={commonMarkdownComponents}
                >
                  {String(generatedContent || 'Click "Generate with AI" to see content here.')}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-2">
          <Button
            variant="outline"
            onClick={() => onClose()}
            className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => copy(generatedContent)}
            disabled={!generatedContent || isLoading}
            className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            Copy
          </Button>
          <Button
            onClick={() => onInsert(generatedContent)}
            disabled={!generatedContent || isLoading}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700"
          >
            Insert into Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
