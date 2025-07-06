import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidProps {
  chart: string;
}

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: false, // We will manually render the diagrams
  theme: 'neutral', // You can change the theme: 'default', 'forest', 'dark', 'neutral'
  securityLevel: 'loose',
  fontFamily: 'inherit',
});

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderMermaid = async () => {
      try {
        // Generate a unique ID for each diagram to avoid conflicts
        const id = `mermaid-diagram-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        setSvg(renderedSvg);
        setError(null);
      } catch (e: any) {
        console.error("Mermaid rendering error:", e.message);
        setError("Could not render diagram. Invalid syntax.");
        setSvg(null);
      }
    };

    if (chart) {
      renderMermaid();
    }
  }, [chart]);

  if (error) {
    return (
      <div className="p-4 my-2 text-sm text-red-800 bg-red-100 border border-red-200 rounded">
        <p className="font-medium">Diagram Error</p>
        <p>{error}</p>
        <pre className="mt-2 p-2 text-xs bg-red-50 rounded overflow-auto">
          <code>{chart}</code>
        </pre>
      </div>
    );
  }

  if (svg) {
    // The rendered SVG is injected directly.
    // This is generally safe as Mermaid sanitizes the output.
    return (
      <div
        className="flex justify-center items-center my-4 p-4 bg-white rounded-lg shadow-sm border"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  return (
    <div className="flex justify-center items-center my-4 p-10 bg-slate-50 rounded-lg animate-pulse">
      <p className="text-slate-400">Loading diagram...</p>
    </div>
  );
};

export default Mermaid;
