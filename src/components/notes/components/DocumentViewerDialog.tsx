import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../ui/dialog';
import { Button } from '../../ui/button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface DocumentViewerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  content: string | null;
  fileType: string | null;
  fileUrl: string | null;
}

export const DocumentViewerDialog: React.FC<DocumentViewerDialogProps> = ({
  isOpen,
  onClose,
  content,
  fileType,
  fileUrl,
}) => {
  // Function to render the document content based on its type
  const renderContent = () => {
    if (!content) {
      return <p className="text-center text-slate-500">No content available for this document.</p>;
    }

    // Handle different file types for rendering
    if (fileType?.includes('pdf') && fileUrl) {
      // For PDFs, use an iframe to embed the PDF viewer
      return (
        <iframe
          src={fileUrl}
          className="w-full h-[60vh] border-0 rounded-md"
          title="Document Viewer"
        >
          {/* Fallback content for browsers that don't support iframes */}
          <p>Your browser does not support iframes. You can <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">download the PDF here</a>.</p>
        </iframe>
      );
    } else if (fileType?.includes('wordprocessingml') || fileType?.includes('msword')) {
      // For Word documents, display extracted text and provide a download link
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] bg-slate-50 rounded-md p-4">
          <p className="text-lg text-slate-700 mb-4">This is a Word document.</p>
          <p className="text-slate-600 mb-4">Displaying extracted text. For original formatting, please download:</p>
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              <Button>Download Original Word Document</Button>
            </a>
          )}
          {/* Display the extracted content as markdown */}
          <div className="mt-4 p-4 border border-slate-200 rounded-md bg-white w-full max-h-[40vh] overflow-y-auto">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
            // className="prose prose-sm max-w-none text-slate-700 leading-relaxed" // className is not a valid prop for ReactMarkdown
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      );
    } else {
      // Default to markdown rendering for text/plain, text/markdown, or unknown types
      return (
        <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed overflow-y-auto max-h-[70vh] p-4 bg-slate-50 rounded-md">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
          //className="prose prose-sm max-w-none text-slate-700 leading-relaxed"
          >
            {content}
          </ReactMarkdown>
        </div>
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Original Document Content</DialogTitle>
          <DialogDescription>
            This is the content extracted from your uploaded document.
            {/* Provide a direct link to view PDF in a new tab if applicable */}
            {fileType?.includes('pdf') && fileUrl && (
              <span className="ml-2 text-blue-600 hover:underline cursor-pointer" onClick={() => window.open(fileUrl, '_blank')}>
                (View PDF in new tab)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        {/* Main content area for the document viewer */}
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
