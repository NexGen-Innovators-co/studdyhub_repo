import React, { useRef, useEffect } from 'react';
import { Chart } from 'chart.js';

interface ChartJsRendererProps {
    chartJsContent: string;
    onMermaidError: (code: string | null, errorType: 'rendering') => void;
    isInteractiveContent: boolean;
}

export const ChartJsRenderer: React.FC<ChartJsRendererProps> = ({ chartJsContent, onMermaidError, isInteractiveContent }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!chartJsContent || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            try {
                const chartData = JSON.parse(chartJsContent);
                new Chart(ctx, chartData);
            } catch (error: any) {
                //console.error('Chart.js rendering error:', error);
                canvas.innerHTML = `<div class="text-red-500 dark:text-red-400">Chart.js render error. Invalid JSON or chart configuration.</div>`;
                onMermaidError(chartJsContent, 'rendering');
            }
        }
    }, [chartJsContent, onMermaidError, isInteractiveContent]);

    return (
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    );
};