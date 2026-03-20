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

                // Add base tag to prevent relative URLs from resolving to your app
                // Using a data URL as base to keep everything contained
                const baseTag = '<base target="_top" href="data:text/html,">';

                // Inject the HTML content with base tag
                doc.write(`${baseTag}${htmlContent}`);
                doc.close();

                // Allow internal navigation but block external navigation
                const handleClick = (e: Event) => {
                    const target = e.target as HTMLElement;
                    const link = target.closest('a');

                    if (link && link.href) {
                        // Allow internal navigation (hash links, same-origin)
                        if (link.href.startsWith('about:') ||
                            link.href.startsWith('data:') ||
                            link.hash ||
                            link.getAttribute('href')?.startsWith('#') ||
                            link.href === window.location.href + (link.hash || '')) {
                            // Allow default behavior for internal navigation
                            return true;
                        }

                        // Block external navigation and show message
                        e.preventDefault();
                        e.stopPropagation();

                        //console.log('External navigation blocked:', link.href);

                        // Optional: show message to user
                        if (iframe.contentWindow) {
                            iframe.contentWindow.alert('External links are disabled in preview mode. This link would navigate to: ' + link.href);
                        }
                    }
                };

                // Add click event listener to the iframe document
                doc.addEventListener('click', handleClick, true);

                // Also handle form submissions
                const handleSubmit = (e: Event) => {
                    e.preventDefault();
                    e.stopPropagation();
                    //console.log('Form submission blocked in HTML preview');
                    // Optional: show success message since forms often trigger navigation
                    if (iframe.contentWindow) {
                        iframe.contentWindow.alert('Form submitted successfully (demo mode)');
                    }
                };

                doc.addEventListener('submit', handleSubmit, true);

                // Cleanup function
                return () => {
                    doc.removeEventListener('click', handleClick, true);
                    doc.removeEventListener('submit', handleSubmit, true);
                };
            }
        }
    }, [htmlContent]);

    return (
        <iframe
            ref={iframeRef}
            title="HTML Preview"
            className="w-full h-full bg-white dark:bg-gray-900 border-none rounded-lg shadow-inner"
            style={{ minHeight: '300px' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            src="about:blank"
        />
    );
};