import { useState, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Custom hook for copy to clipboard functionality.
 * Provides a `copied` state and a `copy` function.
 */
export const useCopyToClipboard = () => {
  const [copied, setCopied] = useState(false);

  /**
   * Copies the given text to the clipboard.
   * Shows a success toast on success, or an error toast on failure.
   * Resets the `copied` state after 2 seconds.
   * @param text The string to copy to the clipboard.
   */
  const copy = useCallback(async (text: string) => {
    try {
      // Use navigator.clipboard.writeText for modern browsers
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Code copied to clipboard!');
    } catch (err) {
      // Fallback for older browsers or environments where clipboard API is not available
      // This might not work in all sandboxed iframes due to security restrictions.
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Code copied to clipboard (fallback)!');
      } catch (execErr) {
        //console.error('Failed to copy code using fallback:', execErr);
        toast.error('Failed to copy code');
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }, []);

  return { copied, copy };
};
