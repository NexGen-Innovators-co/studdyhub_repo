import React, { useRef, useEffect } from 'react';

interface DotRendererProps {
    dotContent: string;
    onMermaidError: (code: string | null, errorType: 'rendering') => void;
}

export const DotRenderer: React.FC<DotRendererProps> = ({ dotContent, onMermaidError }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!dotContent || !containerRef.current) return;
        const container = containerRef.current;
        container.innerHTML = '';

        const renderGraphviz = async () => {
            try {
                const graphviz = await import('@hpcc-js/wasm').then(m => m.Graphviz.load());
                const svg = graphviz.layout(dotContent, 'svg', 'dot');
                container.innerHTML = svg;
            } catch (error: any) {
                console.error('Graphviz rendering error:', error);
                container.innerHTML = `<div class="text-red-500 dark:text-red-400">DOT render error.</div>`;
                onMermaidError(dotContent, 'rendering');
            }
        };

        renderGraphviz();
    }, [dotContent, onMermaidError]);

    return (
        <div ref={containerRef} className="w-full h-full" />
    );
};