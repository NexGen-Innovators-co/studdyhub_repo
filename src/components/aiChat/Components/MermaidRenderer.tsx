import React, { useRef, useEffect, useCallback } from 'react';

interface MermaidRendererProps {
    mermaidContent: string;
    handleNodeClick: (nodeId: string) => void;
}

export const MermaidRenderer: React.FC<MermaidRendererProps> = ({ mermaidContent, handleNodeClick }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const loadMermaid = useCallback(() => {
        if (iframeRef.current) {
            const iframe = iframeRef.current;
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc) {
                doc.open();
                const fullHtml = `
<!DOCTYPE html>
<html>
<head>
<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
<style>
body { margin: 0; padding: 10px; background-color: #282c34; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #abb2bf; font-family: sans-serif; overflow: scroll; }
.mermaid { display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; }
/* Add any custom styles for interactive elements here */
.node:hover {
stroke: orange !important;
stroke-width: 2px !important;
cursor: pointer;
}
</style>
</head>
<body>
<div class="mermaid">
${mermaidContent}
</div>
<script>
mermaid.initialize({ startOnLoad: true, theme: 'dark', securityLevel: 'loose' });
document.addEventListener('DOMContentLoaded', () => {
mermaid.init(undefined, ".mermaid");

// Add event listeners for interactive elements
const mermaidDiv = document.querySelector('.mermaid');
if (mermaidDiv) {
mermaidDiv.addEventListener('click', (event) => {
const target = event.target;
if (target.classList.contains('node')) {
// Handle click on a node
const nodeId = target.id;
const encodedNodeId = encodeURIComponent(nodeId);
console.log('Clicked node:', nodeId);
window.parent.postMessage({ type: 'nodeClick', nodeId: encodedNodeId }, '*');
}
});

mermaidDiv.addEventListener('mouseover', (event) => {
const target = event.target;
if (target.classList.contains('node')) {
// Handle hover on a node
console.log('Mouse over node:', target.id);
}
});
}
});
</script>
</body>
</html>
`;
                doc.write(fullHtml);
                doc.close();
            }
        }
    }, [mermaidContent, handleNodeClick]);

    useEffect(() => {
        loadMermaid();
    }, [loadMermaid]);

    return (
        <iframe
            ref={iframeRef}
            title="Mermaid Diagram Preview"
            className="w-full h-full bg-white dark:bg-gray-900 border-none rounded-lg shadow-inner"
            style={{ minHeight: '300px' }}
            sandbox="allow-scripts allow-same-origin"
        />
    );
};