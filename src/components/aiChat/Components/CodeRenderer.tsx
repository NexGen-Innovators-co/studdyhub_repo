import React, { useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import * as ReactDOMClient from 'react-dom/client';

interface CodeRendererProps {
    codeContent: string;
    language?: string;
}

export const CodeRenderer: React.FC<CodeRendererProps> = ({ codeContent, language }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!codeContent || !containerRef.current) return;
        const container = containerRef.current;
        container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'relative w-full h-full overflow-auto modern-scrollbar';

        const codeContainer = document.createElement('div');
        codeContainer.className = 'relative bg-white dark:bg-gray-900 w-full box-border';
        wrapper.appendChild(codeContainer);

        const root = ReactDOMClient.createRoot(codeContainer);
        root.render(
            <SyntaxHighlighter
                language={language || 'text'}
                style={vscDarkPlus}
                showLineNumbers={true}
                wrapLines={true}
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
        );

        container.appendChild(wrapper);
    }, [codeContent, language]);

    return (
        <div ref={containerRef} className="w-full h-full" />
    );
};