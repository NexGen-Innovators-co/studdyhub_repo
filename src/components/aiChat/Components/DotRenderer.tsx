import React, { useRef, useEffect } from 'react';

interface DotRendererProps {
    dotContent: string;
    onMermaidError: (code: string | null, errorType: 'rendering', errorDetail?: string) => void;
}

export const DotRenderer: React.FC<DotRendererProps> = ({ dotContent, onMermaidError }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!dotContent || !containerRef.current) return;
        const container = containerRef.current;
        container.innerHTML = '';

        // Strip any residual markdown fences that may leak through
        const cleanContent = dotContent
            .replace(/^```\w*\n?/, '')
            .replace(/\n?```\s*$/, '')
            .trim();

        if (!cleanContent) return;

        const renderGraphviz = async () => {
            try {
                const graphviz = await import('@hpcc-js/wasm').then(m => m.Graphviz.load());
                const svg = graphviz.layout(cleanContent, 'svg', 'dot');
                container.innerHTML = svg;
            } catch (error: any) {
                // console.error('[DotRenderer] Graphviz error:', error.message, { contentSnippet: cleanContent.slice(0, 200) });
                container.innerHTML = `<div class="text-red-500 dark:text-red-400">DOT render error: ${error.message}</div>`;
                onMermaidError(cleanContent, 'rendering', error.message || 'Unknown Graphviz error');
            }
        };

        renderGraphviz();
    }, [dotContent, onMermaidError]);

    return (
        <div ref={containerRef} className="w-full h-full" />
    );
};