import React, { useRef, useEffect } from 'react';
import { Chart } from 'chart.js';

interface ChartJsRendererProps {
    chartJsContent: string;
    onMermaidError: (code: string | null, errorType: 'rendering', errorDetail?: string) => void;
    isInteractiveContent: boolean;
}

export const ChartJsRenderer: React.FC<ChartJsRendererProps> = ({ chartJsContent, onMermaidError, isInteractiveContent }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<Chart | null>(null);

    useEffect(() => {
        if (!chartJsContent || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            // Cleanup previous instance
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }

            try {
                let chartData: any;
                const cleanContent = chartJsContent.trim();
                
                // Try strictly compliant JSON first
                try {
                    chartData = JSON.parse(cleanContent);
                } catch (e) {
                    // Fallback 1: Try evaluating as a JS object (supports unquoted keys, trailing commas)
                    try {
                        const fn = new Function(`return ${cleanContent}`);
                        chartData = fn();
                    } catch (e2) {
                        // Fallback 2: Check for common partial fragments
                        // Scenario A: AI returns just the data object content starting with "labels" or labels:
                        if (/^["']?labels["']?\s*:/.test(cleanContent)) {
                             try {
                                // Try wrapping in a standard bar chart structure
                                // If it ends with }, "options": ... we need to be careful
                                // Let's try to construct a valid object string
                                let fixedContent = cleanContent;
                                if (!cleanContent.trim().startsWith('{')) {
                                   fixedContent = `{ ${cleanContent} }`; // Try to make it an object first
                                }
                                
                                const fn = new Function(`return ${fixedContent}`);
                                const partialData = fn();
                                
                                // Check if we got something with labels/datasets
                                if (partialData.labels || partialData.datasets) {
                                     chartData = {
                                        type: 'bar', // Default
                                        data: partialData,
                                        options: { responsive: true }
                                    };
                                }
                             } catch (e3) { /* continue */ }
                        }
                        
                         if (!chartData) {
                            // Fallback 3: Try wrapping in braces if it looks like a property list
                            try {
                                const fn = new Function(`return { ${cleanContent} }`);
                                chartData = fn();
                            } catch (e4) {
                                throw e; // Throw simple JSON error if all fail
                            }
                         }
                    }
                }

                // Heuristic: If 'datasets' is at the top level, this is likely just the 'data' object.
                // Or if it lacks 'type', we need to default it for Chart.js to not crash.
                if (chartData && !chartData.type && (chartData.datasets || chartData.labels)) {
                    // Wrap it in a standard config with a default type (e.g., 'bar')
                    // Ideally the AI should specify the type, but if missing, 'bar' is a safe visual default.
                    chartData = {
                        type: 'bar', // Default
                        data: chartData,
                        options: { responsive: true }
                    };
                } else if (chartData && !chartData.type && !chartData.data && !chartData.options) {
                     // Empty or invalid object?
                }
                
                chartInstanceRef.current = new Chart(ctx, chartData);

            } catch (error: any) {
                // console.error('Chart.js rendering error:', error);
                // Don't replace innerHTML of canvas, it breaks React ref/rendering. 
                // Draw error text on canvas instead.
                ctx.save();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#ef4444'; // Red-500
                ctx.font = '14px sans-serif';
                ctx.fillText('Chart render error: Invalid config', 10, 50);
                ctx.restore();
                
                onMermaidError(chartJsContent, 'rendering', error.message || 'Unknown Chart.js error');
            }
        }
        
        return () => {
             if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
        };
    }, [chartJsContent, onMermaidError, isInteractiveContent]);

    return (
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    );
};