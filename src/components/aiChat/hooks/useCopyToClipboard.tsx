import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export const useCopyToClipboard = () => {
    const [copied, setCopied] = useState(false);

    const copy = useCallback((text: string) => {
        navigator.clipboard.writeText(text)
            .then(() => {
                setCopied(true);
                toast.success('Copied to clipboard!');
                setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
            })
            .catch(err => {
                //console.error('Failed to copy text: ', err);
                toast.error('Failed to copy to clipboard.');
            });
    }, []);

    return { copied, copy };
};