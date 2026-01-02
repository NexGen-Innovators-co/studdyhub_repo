// services/aiServices.ts
import { supabase } from '../integrations/supabase/client';
import { UserProfile } from '../types';
import { FunctionsHttpError } from '@supabase/supabase-js';

export const generateInlineContent = async (
  selectedText: string,
  content: string,
  userProfile: UserProfile,
  actionType: string,
  customInstruction: string,
  attachedDocumentContent?: string,
  selectionRange?: { from: number; to: number }
): Promise<string> => {
  if (!userProfile) {
    throw new Error('User profile not found. Cannot generate content.');
  }

  if (!selectedText.trim()) {
    throw new Error('Please select some text to use AI actions.');
  }

  // Trim the note content to a reasonable context window
  const contextWindow = 20000;
  const half = Math.floor(contextWindow / 2);

  let fullNoteContentTrimmed = content;
  if (content.length > contextWindow) {
    const start = Math.max(0, content.indexOf(selectedText) - half);
    const end = Math.min(content.length, start + contextWindow);
    fullNoteContentTrimmed = content.slice(start, end);
  }

  try {
    const { data, error } = await supabase.functions.invoke('generate-inline-content', {
      body: {
        selectedText: selectedText,
        fullNoteContent: fullNoteContentTrimmed,
        userProfile: userProfile,
        actionType: actionType,
        customInstruction: customInstruction || '', // Ensure it's always a string
        attachedDocumentContent: attachedDocumentContent || '',
        selectionRange: selectionRange || null,
      },
    });

    if (error) {
      console.error('[aiServices] Edge function error:', error);
      throw new Error(error.message || 'An unknown error occurred during inline AI generation.');
    }

    if (!data || !data.generatedContent) {
      console.error('[aiServices] No generated content in response:', data);
      throw new Error('AI did not return any content. Please try again.');
    }

    // Get the generated content
    let finalContent = data.generatedContent || '';

    // Clean up the response
    finalContent = finalContent.trim();

    // Check if this is a diagram - if so, preserve the code blocks
    const isDiagram = /```(?:mermaid|chartjs|dot)/.test(finalContent);
    
    if (!isDiagram) {
      // Only remove wrappers for non-diagram content
      // Remove outer markdown wrapper if present
      if (finalContent.startsWith('```markdown') || finalContent.startsWith('```md')) {
        finalContent = finalContent
          .replace(/^```(?:markdown|md)\n/, '')
          .replace(/```$/, '')
          .trim();
      }

      // Remove hallucinated intros/preambles
      const badStarts = [
        /^here\s+is\s+(an?\s+)?/i,
        /^sure,?\s*/i,
        /^certainly,?\s*/i,
        /^expanded\s+version\s*:\s*/i,
        /^summary\s*:\s*/i,
        /^rephrased\s*:\s*/i,
        /^here'?s\s+/i,
        /^okay,?\s*/i,
        /^alright,?\s*/i,
      ];

      badStarts.forEach(regex => {
        finalContent = finalContent.replace(regex, '').trim();
      });
    }

    return finalContent;
    
  } catch (error) {
    let errorMessage = 'Failed to generate content with AI.';
    
    if (error instanceof FunctionsHttpError) {
      console.error('[aiServices] FunctionsHttpError:', error);
      errorMessage = `AI generation failed: ${error.context?.statusText || 'Unknown error'}`;
      
      if (error.message.includes("The model is overloaded")) {
        errorMessage = "AI model is currently overloaded. Please try again in a few moments.";
      }
    } else if (error instanceof Error) {
      console.error('[aiServices] Error:', error.message);
      errorMessage = error.message;
      
      if (error.message.includes("The model is overloaded")) {
        errorMessage = "AI model is currently overloaded. Please try again in a few moments.";
      }
    }
    
    throw new Error(errorMessage);
  }
};