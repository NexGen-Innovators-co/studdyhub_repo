// services/aiServices.ts
import { supabase } from '@/integrations/supabase/client';
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

    return data.generatedContent || '';
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