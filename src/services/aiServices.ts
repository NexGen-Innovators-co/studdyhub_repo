// services/aiServices.ts
import { supabase } from '../integrations/supabase/client';
import { UserProfile } from '../types';
import { FunctionsHttpError } from '@supabase/supabase-js';

export const generateInlineContent = async (
  selectedText: string,
  content: string,
  userProfile: UserProfile,
  actionType: string,
  customInstruction: string
): Promise<string> => {
  if (!userProfile) {
    throw new Error('User profile not found. Cannot generate content.');
  }

  if (!selectedText.trim()) {
    throw new Error('Please select some text to use AI actions.');
  }

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
        fullNoteContent: content,
        userProfile: userProfile,
        actionType: actionType,
        customInstruction: customInstruction,
      },
    });

    if (error) {
      throw new Error(error.message || 'An unknown error occurred during inline AI generation.');
    }
// After receiving AI response
let finalContent = data.generatedContent || '';

// Remove any code block wrappers (defense in depth)
finalContent = finalContent.trim()
  .replace(/^```[\w+\s]*\n?/gm, '')  // Remove opening fences
  .replace(/```$/gm, '')             // Remove closing fences
  .trim();

// Remove hallucinated intros
const badStarts = [
  /here.?is.?(an?)?\s*:?/i,
  /sure.?,?\s*:?/i,
  /certainly.?,?\s*:?/i,
  /expanded.?version.?:/i,
  /summary.?:/i,
  /rephrased.?:/i,
];
badStarts.forEach(regex => {
  content = content.replace(regex, '').trim();
});

return finalContent;
    
  } catch (error) {
    let errorMessage = 'Failed to generate content with AI.';
    if (error instanceof FunctionsHttpError) {
      errorMessage = `AI generation failed: ${error.context.statusText}`;
      if (error.message.includes("The model is overloaded")) {
        errorMessage = "AI model is currently overloaded. Please try again in a few moments.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message.includes("The model is overloaded")) {
        errorMessage = "AI model is currently overloaded. Please try again in a few moments.";
      }
    }
    throw new Error(errorMessage);
  }
};