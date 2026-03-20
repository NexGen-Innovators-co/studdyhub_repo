import React, { useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';

interface PlainTextRendererProps {
    textContent: string;
}

export const PlainTextRenderer: React.FC<PlainTextRendererProps> = ({ textContent }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!textContent || !containerRef.current) return;
        const container = containerRef.current;
        container.innerHTML = '';

        const plainTextStyle = `
.text-block-wrapper {
position: relative;
counter-reset: line;
padding-left: 40px;
background-color: #1e1e1e;
color: #d4d4d4;
font-family: sans-serif;
font-size: 0.875rem;
line-height: 1.4;
width: 100%;
height: 100%;
overflow-x: auto;
overflow-y: auto;
white-space: pre-wrap;
word-break: break-all;
word-wrap: break-word;
-webkit-overflow-scrolling: touch;
border-radius: 8px;
border: 1px solid #3c3c3c;
box-sizing: border-box;
padding-top: 1rem;
padding-bottom: 1rem;
min-width: 0;
flex-shrink: 0;
}

.text-block-wrapper .text-line {
position: relative;
display: block;
min-height: 1.4em;
padding-right: 1rem;
padding-left: 0.5rem;
}

.text-block-wrapper .text-line::before {
content: counter(line);
counter-increment: line;
position: absolute;
left: -40px;
width: 30px;
text-align: right;
padding-right: 10px;
color: #858585;
font-size: 0.85em;
line-height: inherit;
display: inline-block;
pointer-events: none;
user-select: none;
box-sizing: border-box;
}
`;
        const styleElement = document.createElement('style');
        styleElement.textContent = plainTextStyle;
        container.appendChild(styleElement);

        const pre = document.createElement('pre');
        pre.className = `text-block-wrapper modern-scrollbar`;
        container.appendChild(pre);

        const lines = DOMPurify.sanitize(textContent).split('\n');
        const numberedHtml = lines.map(line => `<div class="text-line">${line || '&nbsp;'}</div>`).join('');
        pre.innerHTML = numberedHtml;
    }, [textContent]);

    return (
        <div ref={containerRef} className="w-full h-full" />
    );
};