// CodeBlock.tsx
import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { AlertTriangle, Copy, Check, Loader2, Maximize2, X, RefreshCw, ChevronDown, ChevronUp, Image, FileText, BookOpen, StickyNote, Sparkles } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Chart, registerables } from 'chart.js';
import { lowlight } from 'lowlight';
import { LanguageFn } from 'highlight.js';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import sql from 'highlight.js/lib/languages/sql';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import typescript from 'highlight.js/lib/languages/typescript';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { useTypingAnimation } from '../../../hooks/useTypingAnimation';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Use vscDarkPlus for dark mode

try {
    lowlight.registerLanguage('javascript', javascript as LanguageFn);
    lowlight.registerLanguage('js', javascript as LanguageFn);
    lowlight.registerLanguage('python', python as LanguageFn);
    lowlight.registerLanguage('py', python as LanguageFn);
    lowlight.registerLanguage('java', java as LanguageFn);
    lowlight.registerLanguage('cpp', cpp as LanguageFn);
    lowlight.registerLanguage('c++', cpp as LanguageFn);
    lowlight.registerLanguage('sql', sql as LanguageFn);
    lowlight.registerLanguage('xml', xml as LanguageFn);
    lowlight.registerLanguage('html', xml as LanguageFn);
    lowlight.registerLanguage('bash', bash as LanguageFn);
    lowlight.registerLanguage('shell', bash as LanguageFn);
    lowlight.registerLanguage('json', json as LanguageFn);
    lowlight.registerLanguage('css', css as LanguageFn);
    lowlight.registerLanguage('typescript', typescript as LanguageFn);
    lowlight.registerLanguage('ts', typescript as LanguageFn);
} catch (error) {
    //console.warn('Error registering syntax highlighting languages in MarkdownRenderer:', error);
}

Chart.register(...registerables);

export class CodeBlockErrorBoundary extends React.Component<
    { children: React.ReactNode; fallback?: React.ReactNode },
    { hasError: boolean; error?: Error }
> {
    constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        //console.error('CodeBlock error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="my-4 sm:my-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950 dark:border-red-800">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span className="font-medium text-sm sm:text-base">Rendering Error</span>
                    </div>
                    <p className="text-xs sm:text-sm text-red-600 mt-1 dark:text-red-400">
                        Failed to render this content. Please try refreshing or contact support if the issue persists.
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}

interface CodeBlockProps {
    node?: any;
    inline: boolean;
    className: string;
    children: React.ReactNode;
    onMermaidError: (code: string, errorType: 'syntax' | 'rendering' | 'timeout' | 'network') => void;
    onSuggestAiCorrection: (prompt: string) => void;
    onViewDiagram: (type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'unknown' | 'document-text' | 'threejs' | 'html', content?: string, language?: string, imageUrl?: string) => void;
    isFirstBlock?: boolean;
    autoTypeInPanel?: boolean;
    isDiagramPanelOpen: boolean;
    onDiagramCodeUpdate: (newCode: string) => void; // Add this line
    isTyping: boolean;
}
const CodeBlock: React.FC<CodeBlockProps> = memo(({
    node, inline, className, children, onMermaidError, onSuggestAiCorrection, onViewDiagram, isFirstBlock, autoTypeInPanel = true, isDiagramPanelOpen, onDiagramCodeUpdate, isTyping, ...props
}) => {
    const { copied, copy } = useCopyToClipboard();
    const match = /language-(\w+)/.exec(className || '');
    const lang = match && match[1];
    const codeContent = String(children).trim();
    const [showRawCode, setShowRawCode] = useState(false);
    const [isEditing, setIsEditing] = useState(false); // Add this line
    const [editedCode, setEditedCode] = useState(codeContent); // Add this line

    const handleCopyCode = useCallback(async () => {
        await copy(editedCode); // Copy editedCode instead of codeContent
    }, [copied, copy, editedCode]);

    const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditedCode(e.target.value);
    }, []);

    const handleUpdateDiagram = useCallback(() => {
        onDiagramCodeUpdate(editedCode); // Call the callback with the edited code
        onViewDiagram(lang as any, editedCode); // Refresh the diagram in the panel
        setIsEditing(false); // Exit edit mode
    }, [editedCode, lang, onDiagramCodeUpdate, onViewDiagram]);
    useEffect(() => {
        if (isEditing) {
            setShowRawCode(true);
        }
    }, [isEditing]);
    const handleToggleRawCode = useCallback(() => {
        setShowRawCode(!showRawCode);
    }, [showRawCode]);
    const handleSaveCode = useCallback(() => {
        onViewDiagram(lang as any, editedCode);
        setIsEditing(false);
    }, [editedCode, lang, onViewDiagram]);

    // Updated effect to show raw code when typing and panel is not open
    useEffect(() => {
        if (isEditing) {
            setShowRawCode(true);
        }
    }, [isEditing]);

    // Check if this is a special diagram type
    const isDiagramType = lang && ['mermaid', 'chartjs', 'threejs', 'dot', 'html'].includes(lang);

    // Determine if raw code should be shown based on various conditions
    const shouldShowRawCodeForGeneric = !isDiagramType && autoTypeInPanel && !isDiagramPanelOpen;

    // Determine if raw code should be shown based on various conditions
    const shouldShowRawCode = showRawCode || (isTyping && !inline && lang && !isDiagramPanelOpen);

    // Render raw code with syntax highlighting using react-syntax-highlighter
    const renderRawCode = useCallback(() => {
        return (
            <div className="relative my-4 sm:my-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 w-full">
                <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-xs sm:text-sm font-medium text-gray-600 uppercase tracking-wide dark:text-gray-300">
                        Raw Code ({lang || 'text'})
                    </span>
                    <div className="flex">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopyCode}
                            className="h-5 w-5 sm:h-6 sm:w-6 p-0 text-gray-500 hover:text-green-400 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-green-400 dark:hover:bg-gray-700"
                            title="Copy code"
                            aria-label="Copy code to clipboard"
                        >
                            {copied ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : <Copy className="h-3 w-3 sm:h-4 sm:w-4" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleToggleRawCode}
                            className="h-5 w-5 sm:h-6 sm:w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-200 dark:hover:bg-gray-700"
                            title={showRawCode ? 'Hide Raw Code' : 'Show Raw Code'}
                            aria-label={showRawCode ? 'Hide raw code' : 'Show raw code'}
                        >
                            {showRawCode ? <X className="h-3 w-3 sm:h-4 sm:w-4" /> : <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />}
                        </Button>
                    </div>
                </div>
                <div className="relative bg-white dark:bg-gray-900 w-full box-border">
                    <div className="overflow-x-auto max-w-[100vw] sm:max-w-full">
                        <SyntaxHighlighter
                            language={lang || 'text'}
                            style={vscDarkPlus}
                            showLineNumbers={true}
                            customStyle={{
                                margin: 0,
                                padding: '0.75rem 1rem',
                                fontSize: '0.875rem',
                                lineHeight: '1.5',
                                background: 'transparent',
                                borderRadius: '0 0 0.375rem 0.375rem',
                            }}
                            codeTagProps={{
                                className: 'font-mono text-gray-800 dark:text-gray-100',
                            }}
                        >
                            {codeContent}
                        </SyntaxHighlighter>
                    </div>
                </div>
            </div>
        );
    }, [codeContent, copied, handleCopyCode, handleToggleRawCode, lang, showRawCode]);

    // Handle special cases like HTML, Mermaid, Chart.js, Three.js, and DOT
    const renderHTMLBlock = useCallback(() => {
        return (
            <div className="my-4 sm:my-6 p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg dark:bg-gray-800 dark:border-gray-600">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 text-slate-700 dark:text-gray-200">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        <span className="font-medium text-sm sm:text-base">Web Page</span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onViewDiagram && onViewDiagram('html', codeContent, lang)}
                            className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm dark:bg-blue-700 dark:hover:bg-blue-800 text-xs sm:text-sm flex-1 sm:flex-initial"
                        >
                            <Maximize2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            <span className="hidden xs:inline">View Web Page</span>
                            <span className="xs:hidden">View</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopyCode}
                            className="text-gray-500 hover:text-green-400 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-green-400 dark:hover:bg-gray-700"
                            title="Copy code"
                            aria-label="Copy code to clipboard"
                        >
                            {copied ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : <Copy className="h-3 w-3 sm:h-4 sm:w-4" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleToggleRawCode}
                            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-200 dark:hover:bg-gray-700"
                            title={showRawCode ? 'Hide Raw Code' : 'Show Raw Code'}
                            aria-label={showRawCode ? 'Hide raw code' : 'Show raw code'}
                        >
                            {showRawCode ? <X className="h-3 w-3 sm:h-4 sm:w-4" /> : <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }, [codeContent, copied, handleCopyCode, handleToggleRawCode, lang, onViewDiagram, showRawCode]);

    // Handle diagram blocks (mermaid, chartjs, threejs, dot)
    const createDiagramBlock = useCallback((title: string, type: any) => (
        <div className="my-4 sm:my-6 p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg dark:bg-gray-800 dark:border-gray-600">
            <div className="flex flex-col sm:flex-row flex-wrap sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3 text-slate-700 dark:text-gray-200">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    <span className="font-medium text-sm sm:text-base truncated">{title}</span>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDiagram && onViewDiagram(type, codeContent, lang)}
                        className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm dark:bg-blue-700 dark:hover:bg-blue-800 text-xs sm:text-sm flex-1 sm:flex-initial"
                    >
                        <Maximize2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyCode}
                        className="text-gray-500 hover:text-green-400 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-green-400 dark:hover:bg-gray-700"
                        title="Copy code"
                        aria-label="Copy code to clipboard"
                    >
                        {copied ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : <Copy className="h-3 w-3 sm:h-4 sm:w-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleToggleRawCode}
                        className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-200 dark:hover:bg-gray-700"
                        title={showRawCode ? 'Hide Raw Code' : 'Show Raw Code'}
                        aria-label={showRawCode ? 'Hide raw code' : 'Show raw code'}
                    >
                        {showRawCode ? <X className="h-3 w-3 sm:h-4 sm:w-4" /> : <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />}
                    </Button>
                </div>
            </div>
        </div>
    ), [codeContent, copied, handleCopyCode, handleToggleRawCode, lang, onViewDiagram, showRawCode]);

    const renderDiagramBlock = useCallback((title: string, type: any) => {
        return createDiagramBlock(title, type);
    }, [createDiagramBlock]);

    // Inline code
    const renderInlineCode = useCallback(() => {
        return (
            <code
                className="bg-gray-100 text-gray-900 px-1 sm:px-1.5 py-0.5 rounded-full font-mono text-xs sm:text-sm dark:bg-gray-800 dark:text-gray-100"
                {...props}
            >
                {children}
            </code>
        );
    }, [children, props]);

    // Determine the content to render
    let content;
    if (!inline && shouldShowRawCode) {
        content = renderRawCode();
    } else if (!inline && lang === 'html') {
        content = renderHTMLBlock();
    } else if (!inline && lang === 'mermaid') {
        content = renderDiagramBlock('Mermaid Diagram', 'mermaid');
    } else if (!inline && lang === 'chartjs') {
        content = renderDiagramBlock('Chart.js Graph', 'chartjs');
    } else if (!inline && lang === 'threejs') {
        content = renderDiagramBlock('Three.js 3D Scene', 'threejs');
    } else if (!inline && lang === 'dot') {
        content = renderDiagramBlock('DOT Graph', 'dot');
    } else if (!inline && lang) {
        content = renderDiagramBlock(lang.toUpperCase() + ' Code', 'code');
    } else {
        content = renderInlineCode();
    }

    return <>{content}</>;
});

export const MemoizedCodeBlock = memo(CodeBlock);
export { CodeBlock };