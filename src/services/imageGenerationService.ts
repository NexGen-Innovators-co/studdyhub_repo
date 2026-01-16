// services/imageGenerationService.ts
import { supabase } from '../integrations/supabase/client';

export interface GenerateImageParams {
  description: string;
  userId: string;
}

export interface GenerateImageResponse {
  imageUrl: string;
  error?: string;
}

/**
 * Generate an image from a text description using the Gemini API via the edge function
 * @param description - Text description of the image to generate
 * @param userId - ID of the user requesting the image
 * @returns Promise with the generated image URL
 */
export const generateImage = async (
  description: string,
  userId: string
): Promise<GenerateImageResponse> => {
  if (!description || !description.trim()) {
    throw new Error('Please provide a description for the image.');
  }

  if (!userId) {
    throw new Error('User ID is required for image generation.');
  }

  try {
    const { data, error } = await supabase.functions.invoke('generate-image-from-text', {
      body: {
        description: description.trim(),
        userId,
      },
    });

    if (error) {
      console.error('[imageGenerationService] Edge function error:', error);
      throw new Error(error.message || 'Failed to generate image.');
    }

    if (!data || !data.imageUrl) {
      console.error('[imageGenerationService] No image URL in response:', data);
      throw new Error('No image was generated. Please try again.');
    }

    return {
      imageUrl: data.imageUrl,
    };
  } catch (error) {
    console.error('[imageGenerationService] Error:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('An unexpected error occurred during image generation.');
  }
};
