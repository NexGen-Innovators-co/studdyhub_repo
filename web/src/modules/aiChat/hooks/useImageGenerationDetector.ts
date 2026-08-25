// hooks/useImageGenerationDetector.ts
import { useCallback } from 'react';

/**
 * Custom hook to detect image generation requests in user messages
 * Returns a function that checks if a message is an image generation request
 */
export const useImageGenerationDetector = () => {
  const detectImageGenerationRequest = useCallback((message: string): {
    isImageRequest: boolean;
    extractedPrompt: string | null;
  } => {
    const lowerMessage = message.toLowerCase().trim();
    
    // Pattern 1: Direct commands
    const directCommands = [
      'generate image',
      'create image',
      'make image',
      'draw image',
      'generate picture',
      'create picture',
      'make picture',
      'draw picture',
      '/image',
      '/generate',
      '/draw',
    ];
    
    // Check if message starts with direct commands
    for (const command of directCommands) {
      if (lowerMessage.startsWith(command)) {
        // Extract the prompt after the command
        const prompt = message
          .substring(command.length)
          .replace(/^[:\s]+/, '') // Remove leading colons and spaces
          .trim();
        
        if (prompt) {
          return {
            isImageRequest: true,
            extractedPrompt: prompt,
          };
        }
      }
    }
    
    // Pattern 2: Natural language patterns
    const naturalPatterns = [
      /^(?:can you |could you |please )?(?:generate|create|make|draw)(?: me)?(?: an?)? image (?:of|showing|depicting) (.+)/i,
      /^(?:i want|i need|i would like)(?: to see)?(?: an?)? image (?:of|showing|depicting) (.+)/i,
      /^show me (?:an? )?image (?:of|showing|depicting) (.+)/i,
    ];
    
    for (const pattern of naturalPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return {
          isImageRequest: true,
          extractedPrompt: match[1].trim(),
        };
      }
    }
    
    return {
      isImageRequest: false,
      extractedPrompt: null,
    };
  }, []);

  return {
    detectImageGenerationRequest,
  };
};
