import React, { useRef, useEffect } from 'react';

interface HtmlRendererProps {
    htmlContent: string;
}

export const HtmlRenderer: React.FC<HtmlRendererProps> = ({ htmlContent }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (iframeRef.current) {
            const iframe = iframeRef.current;
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc) {
                doc.open();
                doc.write(htmlContent);
                doc.close();
            }
        }
    }, [htmlContent]);

    return (
        <iframe
            ref={iframeRef}
            title="HTML Preview"
            className="w-full h-full bg-white dark:bg-gray-900 border-none rounded-lg shadow-inner"
            style={{ minHeight: '300px' }}
            sandbox="allow-scripts allow-same-origin"
        />
    );
};