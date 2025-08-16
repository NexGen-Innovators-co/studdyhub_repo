import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Loader2, CheckCircle, AlertTriangle, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { fixDiagram, DiagramFixRequest } from '../services/diagramFixService';
import { UserProfile } from '../types';

interface DiagramFixDialogProps {
  isOpen: boolean;
  onClose: () => void;
  diagramType: 'mermaid' | 'html' | 'code';
  originalContent: string;
  errorMessage: string;
  userProfile: UserProfile;
  onApplyFix: (fixedContent: string) => void;
}

export const DiagramFixDialog: React.FC<DiagramFixDialogProps> = ({
  isOpen,
  onClose,
  diagramType,
  originalContent,
  errorMessage,
  userProfile,
  onApplyFix
}) => {
  const [isFixing, setIsFixing] = useState(false);
  const [fixedContent, setFixedContent] = useState('');
  const [explanation, setExplanation] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [hasAttemptedFix, setHasAttemptedFix] = useState(false);

  const handleFixDiagram = async () => {
    setIsFixing(true);
    setHasAttemptedFix(true);
    
    try {
      const request: DiagramFixRequest = {
        diagramType,
        originalContent,
        errorMessage,
        userProfile
      };
      
      const result = await fixDiagram(request);
      
      setFixedContent(result.fixedContent);
      setExplanation(result.explanation);
      setSuggestions(result.suggestions);
      
      toast.success('AI has analyzed and fixed the diagram');
    } catch (error) {
      console.error('Error fixing diagram:', error);
      toast.error('Failed to fix diagram with AI');
      
      // Set fallback content
      setFixedContent(originalContent);
      setExplanation('Unable to automatically fix the diagram. Please check the suggestions below.');
      setSuggestions([
        'Check for syntax errors in the diagram code',
        'Ensure all required elements are properly formatted',
        'Try simplifying complex structures',
        'Verify that special characters are properly escaped'
      ]);
    } finally {
      setIsFixing(false);
    }
  };

  const handleCopyFixed = () => {
    navigator.clipboard.writeText(fixedContent);
    toast.success('Fixed content copied to clipboard');
  };

  const handleApplyFix = () => {
    onApplyFix(fixedContent);
    toast.success('Fix applied to diagram');
    onClose();
  };

  const handleClose = () => {
    setFixedContent('');
    setExplanation('');
    setSuggestions([]);
    setHasAttemptedFix(false);
    onClose();
  };

  const getDiagramTypeLabel = () => {
    switch (diagramType) {
      case 'mermaid': return 'Mermaid Diagram';
      case 'html': return 'HTML Content';
      case 'code': return 'Code Block';
      default: return 'Content';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🤖 AI Diagram Fix - {getDiagramTypeLabel()}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Error Information */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-red-800 dark:text-red-200">Error Detected</h3>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">{errorMessage}</p>
              </div>
            </div>
          </div>

          {/* Original Content */}
          <div>
            <h3 className="font-medium mb-2">Original Content:</h3>
            <Textarea
              value={originalContent}
              readOnly
              className="h-32 font-mono text-sm resize-none"
            />
          </div>

          {/* Fix Button */}
          {!hasAttemptedFix && (
            <div className="flex justify-center">
              <Button
                onClick={handleFixDiagram}
                disabled={isFixing}
                className="flex items-center gap-2"
              >
                {isFixing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing and fixing...
                  </>
                ) : (
                  <>
                    🤖 Fix with AI
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Fixed Content */}
          {hasAttemptedFix && (
            <>
              {/* Explanation */}
              {explanation && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-blue-800 dark:text-blue-200">AI Analysis</h3>
                      <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">{explanation}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Fixed Content */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Fixed Content:</h3>
                  <Button
                    onClick={handleCopyFixed}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                </div>
                <Textarea
                  value={fixedContent}
                  onChange={(e) => setFixedContent(e.target.value)}
                  className="h-32 font-mono text-sm"
                  placeholder="Fixed content will appear here..."
                />
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Suggestions for Prevention:</h3>
                  <ul className="space-y-1">
                    {suggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {hasAttemptedFix && fixedContent && (
            <Button onClick={handleApplyFix} className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Apply Fix
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};