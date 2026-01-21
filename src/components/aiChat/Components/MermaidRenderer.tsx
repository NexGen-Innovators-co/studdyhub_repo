import React, { useRef, useEffect, useCallback } from 'react';

interface MermaidRendererProps {
    mermaidContent: string;
    handleNodeClick: (nodeId: string) => void;
    onMermaidError?: (error: string, code: string) => void;
    iframeRef?: React.RefObject<HTMLIFrameElement>;
}

export const MermaidRenderer: React.FC<MermaidRendererProps> = ({
    mermaidContent,
    handleNodeClick,
    onMermaidError,
    iframeRef: externalIframeRef
}) => {
    const internalIframeRef = useRef<HTMLIFrameElement>(null);
    const iframeRef = externalIframeRef || internalIframeRef;

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
body { 
    margin: 0; 
    padding: 0; 
    background-color: #282c34; 
    color: #abb2bf; 
    font-family: sans-serif; 
    overflow: hidden;
    position: relative;
    width: 100vw;
    height: 100vh;
}

.diagram-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    cursor: grab;
}

.diagram-container.dragging {
    cursor: grabbing;
}

.mermaid-wrapper {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    transform-origin: center center;
    transition: transform 0.1s ease-out;
}

.mermaid {
    display: block;
    text-align: center;
}

.controls {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    z-index: 1000;
}

.control-btn {
    background: rgba(40, 44, 52, 0.9);
    border: 1px solid #61dafb;
    color: #61dafb;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    min-width: 40px;
    text-align: center;
    transition: all 0.2s ease;
}

.control-btn:hover {
    background: rgba(97, 218, 251, 0.1);
    border-color: #ffffff;
    color: #ffffff;
}

.control-btn:active {
    transform: scale(0.95);
}

.zoom-info {
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(40, 44, 52, 0.9);
    border: 1px solid #61dafb;
    color: #61dafb;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 1000;
}

.error-container {
    display: none;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(220, 38, 38, 0.1);
    border: 1px solid #ef4444;
    color: #ef4444;
    padding: 20px;
    border-radius: 8px;
    max-width: 80%;
    text-align: center;
    font-family: monospace;
    z-index: 2000;
}

/* Node hover effects */
.node:hover {
    stroke: orange !important;
    stroke-width: 3px !important;
    cursor: pointer;
    filter: brightness(1.2);
}

/* Touch-friendly styles */
@media (max-width: 768px) {
    .control-btn {
        padding: 10px 15px;
        font-size: 16px;
        min-width: 45px;
    }
    
    .controls {
        top: 15px;
        right: 15px;
        gap: 8px;
    }
}

/* Prevent text selection during drag */
.diagram-container.dragging * {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
}
</style>
</head>
<body>
<div class="diagram-container" id="diagramContainer">
    <div class="mermaid-wrapper" id="mermaidWrapper">
        <div class="mermaid" id="mermaidDiagram">
            ${mermaidContent}
        </div>
    </div>
</div>

<div class="error-container" id="errorContainer">
    <strong>Mermaid Render Error</strong>
    <p id="errorMessage"></p>
</div>

<div class="controls">
    <button class="control-btn" id="zoomIn" title="Zoom In">+</button>
    <button class="control-btn" id="zoomOut" title="Zoom Out">−</button>
    <button class="control-btn" id="zoomReset" title="Reset Zoom">⌂</button>
    <button class="control-btn" id="fitToScreen" title="Fit to Screen">⤢</button>
</div>

<div class="zoom-info" id="zoomInfo">100%</div>

<script>
let currentZoom = 1;
let currentX = 0;
let currentY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let lastTouchDistance = 0;

const container = document.getElementById('diagramContainer');
const wrapper = document.getElementById('mermaidWrapper');
const zoomInfo = document.getElementById('zoomInfo');
const errorContainer = document.getElementById('errorContainer');
const errorMessage = document.getElementById('errorMessage');

// Initialize Mermaid with custom error handler
mermaid.initialize({ 
    startOnLoad: false, 
    theme: 'dark', 
    securityLevel: 'loose',
    flowchart: {
        useMaxWidth: false,
        htmlLabels: false
    }
});

// Custom error handling
mermaid.parseError = function(err, hash) {
    console.error('Mermaid parse error:', err);
    errorContainer.style.display = 'block';
    errorMessage.textContent = err.message || err;
    window.parent.postMessage({ 
        type: 'mermaidError', 
        error: err.toString(),
        code: \`${mermaidContent.replace(/`/g, '\\`')}\`
    }, '*');
};

// Update transform
function updateTransform() {
    const transform = \`translate(\${currentX}px, \${currentY}px) scale(\${currentZoom})\`;
    wrapper.style.transform = transform;
    zoomInfo.textContent = Math.round(currentZoom * 100) + '%';
}

// Zoom functions
function zoomIn(centerX = container.offsetWidth / 2, centerY = container.offsetHeight / 2) {
    const newZoom = Math.min(currentZoom * 1.2, 5);
    zoomToPoint(centerX, centerY, newZoom);
}

function zoomOut(centerX = container.offsetWidth / 2, centerY = container.offsetHeight / 2) {
    const newZoom = Math.max(currentZoom / 1.2, 0.1);
    zoomToPoint(centerX, centerY, newZoom);
}

function zoomToPoint(centerX, centerY, newZoom) {
    const zoomFactor = newZoom / currentZoom;
    
    // Calculate new position to zoom towards the center point
    currentX = centerX - (centerX - currentX) * zoomFactor;
    currentY = centerY - (centerY - currentY) * zoomFactor;
    currentZoom = newZoom;
    
    updateTransform();
}

function resetZoom() {
    currentZoom = 1;
    currentX = 0;
    currentY = 0;
    updateTransform();
}

function fitToScreen() {
    const mermaidElement = document.querySelector('.mermaid svg');
    if (mermaidElement) {
        const bbox = mermaidElement.getBBox();
        const containerRect = container.getBoundingClientRect();
        
        const scaleX = (containerRect.width * 0.9) / bbox.width;
        const scaleY = (containerRect.height * 0.9) / bbox.height;
        
        currentZoom = Math.min(scaleX, scaleY, 2);
        currentX = 0;
        currentY = 0;
        updateTransform();
    }
}

// Mouse events
container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const centerX = e.clientX - rect.left;
    const centerY = e.clientY - rect.top;
    
    if (e.deltaY < 0) {
        zoomIn(centerX, centerY);
    } else {
        zoomOut(centerX, centerY);
    }
});

container.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left mouse button
        isDragging = true;
        dragStartX = e.clientX - currentX;
        dragStartY = e.clientY - currentY;
        container.classList.add('dragging');
        e.preventDefault();
    }
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        currentX = e.clientX - dragStartX;
        currentY = e.clientY - dragStartY;
        updateTransform();
    }
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        container.classList.remove('dragging');
    }
});

// Touch events for mobile
container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        // Single touch - start pan
        isDragging = true;
        const touch = e.touches[0];
        dragStartX = touch.clientX - currentX;
        dragStartY = touch.clientY - currentY;
        container.classList.add('dragging');
    } else if (e.touches.length === 2) {
        // Two fingers - start pinch zoom
        isDragging = false;
        container.classList.remove('dragging');
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        lastTouchDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
    }
    e.preventDefault();
});

container.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isDragging) {
        // Single touch - pan
        const touch = e.touches[0];
        currentX = touch.clientX - dragStartX;
        currentY = touch.clientY - dragStartY;
        updateTransform();
    } else if (e.touches.length === 2) {
        // Two fingers - pinch zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        
        if (lastTouchDistance > 0) {
            const scale = distance / lastTouchDistance;
            const centerX = (touch1.clientX + touch2.clientX) / 2;
            const centerY = (touch1.clientY + touch2.clientY) / 2;
            const rect = container.getBoundingClientRect();
            
            zoomToPoint(centerX - rect.left, centerY - rect.top, currentZoom * scale);
        }
        lastTouchDistance = distance;
    }
    e.preventDefault();
});

container.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
        isDragging = false;
        container.classList.remove('dragging');
        lastTouchDistance = 0;
    } else if (e.touches.length === 1) {
        // Switch back to pan mode
        const touch = e.touches[0];
        dragStartX = touch.clientX - currentX;
        dragStartY = touch.clientY - currentY;
        isDragging = true;
        container.classList.add('dragging');
        lastTouchDistance = 0;
    }
});

// Control button events
document.getElementById('zoomIn').addEventListener('click', () => zoomIn());
document.getElementById('zoomOut').addEventListener('click', () => zoomOut());
document.getElementById('zoomReset').addEventListener('click', resetZoom);
document.getElementById('fitToScreen').addEventListener('click', fitToScreen);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case '=':
            case '+':
                e.preventDefault();
                zoomIn();
                break;
            case '-':
                e.preventDefault();
                zoomOut();
                break;
            case '0':
                e.preventDefault();
                resetZoom();
                break;
        }
    }
});

// Render manual function
async function renderDiagram() {
    try {
        await mermaid.run({
            nodes: [document.getElementById('mermaidDiagram')]
        });
        
        // Add node click handlers after diagram is rendered
        const mermaidDiv = document.querySelector('.mermaid');
        if (mermaidDiv) {
            mermaidDiv.addEventListener('click', (event) => {
                // Prevent click during drag
                if (container.classList.contains('dragging')) {
                    return;
                }
                
                const target = event.target;
                if (target.classList.contains('node') || target.closest('.node')) {
                    const nodeElement = target.classList.contains('node') ? target : target.closest('.node');
                    const nodeId = nodeElement.id || nodeElement.getAttribute('data-id');
                    if (nodeId) {
                        window.parent.postMessage({ type: 'nodeClick', nodeId: encodeURIComponent(nodeId) }, '*');
                    }
                }
            });
        }
        
        // Auto-fit on initial load
        setTimeout(fitToScreen, 100);
    } catch (err) {
        // Already handled by parseError usually, but just in case
        console.error('Render error:', err);
    }
}

// Start rendering
renderDiagram();
</script>
</body>
</html>
`;
                doc.write(fullHtml);
                doc.close();
            }
        }
    }, [mermaidContent]);

    useEffect(() => {
        loadMermaid();
    }, [loadMermaid]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'nodeClick' && event.data.nodeId) {
                handleNodeClick(decodeURIComponent(event.data.nodeId));
            } else if (event.data.type === 'mermaidError' && onMermaidError) {
                onMermaidError(event.data.error, event.data.code);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [handleNodeClick, onMermaidError]);

    return (
        <iframe
            ref={iframeRef}
            title="Mermaid Diagram Preview"
            className="w-full h-full bg-white dark:bg-gray-900 border-none rounded-lg shadow-inner"
            style={{ minHeight: '400px' }}
        />
    );
};