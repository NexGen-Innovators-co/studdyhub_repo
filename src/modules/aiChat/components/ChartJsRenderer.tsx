import React, { useRef, useEffect } from 'react';
import { Chart } from 'chart.js';

/**
 * Detect the most likely chart type from the config content.
 * Used when the AI omits the `type` field.
 */
function detectChartType(obj: any): string {
    const json = JSON.stringify(obj).toLowerCase();
    if (json.includes('"pie"') || json.includes("'pie'")) return 'pie';
    if (json.includes('"doughnut"') || json.includes("'doughnut'")) return 'doughnut';
    if (json.includes('"line"') || json.includes("'line'") || json.includes('bordercolor')) return 'line';
    if (json.includes('"radar"') || json.includes("'radar'")) return 'radar';
    if (json.includes('"scatter"') || json.includes("'scatter'")) return 'scatter';
    if (json.includes('"polararea"') || json.includes("'polararea'")) return 'polarArea';
    // backgroundColor arrays without borderColor → likely a pie/doughnut chart
    if (Array.isArray(obj?.datasets?.[0]?.backgroundColor) && !obj?.datasets?.[0]?.borderColor) return 'pie';
    return 'bar'; // safe default
}

/**
 * Balance unclosed braces / brackets in a JSON-ish string.
 * - Appends missing `}` / `]` at the end for unclosed opens
 * - Prepends missing `{` / `[` at the start for unmatched closes
 */
function balanceBraces(str: string): string {
    let braces = 0;
    let brackets = 0;
    for (const ch of str) {
        if (ch === '{') braces++;
        else if (ch === '}') braces--;
        else if (ch === '[') brackets++;
        else if (ch === ']') brackets--;
    }
    let result = str;
    // Prepend opening braces/brackets if we have more closes than opens
    if (braces < 0) result = '{'.repeat(-braces) + result;
    if (brackets < 0) result = '['.repeat(-brackets) + result;
    // Append closing braces/brackets if we have more opens than closes
    if (braces > 0) result += '}'.repeat(braces);
    if (brackets > 0) result += ']'.repeat(brackets);
    return result;
}

/**
 * Robustly parse AI-generated Chart.js config.
 * Handles:  valid JSON, JS object literals, truncated content,
 *           missing `type`, data properties alongside `options`, etc.
 */
function parseChartConfig(content: string): any {
    // ------- Attempt 1: strict JSON -------
    try {
        const parsed = JSON.parse(content);
        return normalizeChartConfig(parsed);
    } catch (_) { /* fall through */ }

    // ------- Attempt 2: JS object via new Function -------
    try {
        const parsed = new Function(`return ${content}`)();
        return normalizeChartConfig(parsed);
    } catch (_) { /* fall through */ }

    // ------- Attempt 3: wrap in braces + balance -------
    {
        let wrapped = content;
        if (!wrapped.trimStart().startsWith('{')) wrapped = '{ ' + wrapped;
        wrapped = balanceBraces(wrapped);

        try {
            const parsed = JSON.parse(wrapped);
            return normalizeChartConfig(parsed);
        } catch (_) { /* fall through */ }

        try {
            const parsed = new Function(`return ${wrapped}`)();
            return normalizeChartConfig(parsed);
        } catch (_) { /* fall through */ }
    }

    // ------- Attempt 4: balance the raw content (may already start with `{`) -------
    {
        const balanced = balanceBraces(content);
        if (balanced !== content) {
            try {
                const parsed = JSON.parse(balanced);
                return normalizeChartConfig(parsed);
            } catch (_) { /* fall through */ }

            try {
                const parsed = new Function(`return ${balanced}`)();
                return normalizeChartConfig(parsed);
            } catch (_) { /* fall through */ }
        }
    }

    // ------- Attempt 5: AI returned the INNER content of a chart config -------
    // Pattern:  "labels": [...], "datasets": [...] }, "options": { ... }
    // The `},` after datasets closes an implicit "data" wrapper that got stripped.
    // Reconstruct as: { "data": { <data-guts> }, "options": <options-part> }
    {
        const optionsSplitMatch = content.match(
            /^([\s\S]+?\]\s*)\},\s*"options"\s*:\s*([\s\S]+)$/
        );
        if (optionsSplitMatch) {
            const dataGuts = optionsSplitMatch[1].trim();   // "labels":[...], "datasets":[...]
            const optionsValue = optionsSplitMatch[2].trim(); // { "responsive": true, ... }
            const reconstructed = `{ "data": { ${dataGuts} }, "options": ${optionsValue} }`;
            const balanced = balanceBraces(reconstructed);

            try {
                const parsed = JSON.parse(balanced);
                return normalizeChartConfig(parsed);
            } catch (_) { /* fall through */ }

            try {
                const parsed = new Function(`return ${balanced}`)();
                return normalizeChartConfig(parsed);
            } catch (_) { /* fall through */ }
        }
    }

    throw new Error('Unable to parse Chart.js configuration from AI output');
}

/**
 * Ensure the parsed object is a valid Chart.js config:
 *   { type, data: { labels, datasets }, options? }
 */
function normalizeChartConfig(obj: any): any {
    if (!obj || typeof obj !== 'object') {
        throw new Error('Parsed chart config is not an object');
    }

    // Already well-formed: { type, data: { ... } }
    if (obj.type && obj.data) return obj;

    // Has labels/datasets at top level alongside options → split into data + options
    if ((obj.labels || obj.datasets) && obj.options) {
        const { options, ...dataFields } = obj;
        return {
            type: obj.type || detectChartType(dataFields),
            data: dataFields,
            options,
        };
    }

    // Has labels/datasets at top level → treat entire object as data
    if (obj.labels || obj.datasets) {
        return {
            type: detectChartType(obj),
            data: obj,
            options: { responsive: true },
        };
    }

    // Has data nested but no type
    if (obj.data && !obj.type) {
        obj.type = detectChartType(obj.data);
        return obj;
    }

    // Fallback — return as-is and let Chart.js try
    return obj;
}

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
                // Strip any residual markdown fences that may leak through
                const cleanContent = chartJsContent
                    .replace(/^```\w*\n?/, '')
                    .replace(/\n?```\s*$/, '')
                    .trim();

                chartData = parseChartConfig(cleanContent);
                
                chartInstanceRef.current = new Chart(ctx, chartData);

            } catch (error: any) {
                // console.error('[ChartJsRenderer] Error:', error.message, { contentSnippet: chartJsContent?.slice(0, 200) });
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