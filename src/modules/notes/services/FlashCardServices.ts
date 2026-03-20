// services/flashcardService.ts
import { supabase } from '../../../integrations/supabase/client';

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  hint?: string;
  created_at?: string;
}

export interface FlashcardGenerationOptions {
  noteContent: string;
  noteId?: string;
  userProfile: any;
  numberOfCards?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  focusAreas?: string[];
}

export interface FlashcardGenerationResult {
  success: boolean;
  flashcards: Flashcard[];
  metadata?: {
    totalCards: number;
    coverageAreas: string[];
    suggestedStudyOrder: string;
  };
  count: number;
  timestamp: string;
}

/**
 * Generate flashcards using AI from note content
 */
export const generateFlashcardsFromNote = async (
  options: FlashcardGenerationOptions
): Promise<FlashcardGenerationResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('generate-flashcards', {
      body: {
        noteContent: options.noteContent,
        noteId: options.noteId,
        userProfile: options.userProfile,
        numberOfCards: options.numberOfCards || 10,
        difficulty: options.difficulty || 'medium',
        focusAreas: options.focusAreas
      }
    });

    if (error) {
      throw new Error(error.message || 'Failed to generate flashcards');
    }

    return data as FlashcardGenerationResult;
  } catch (error) {

    throw error;
  }
};

/**
 * Save flashcards to the database
 */
export const saveFlashcards = async (
  flashcards: Flashcard[],
  noteId: string,
  userId: string
): Promise<void> => {
  try {
    const flashcardsToInsert = flashcards.map(card => ({
      user_id: userId,
      note_id: noteId,
      front: card.front,
      back: card.back,
      category: card.category,
      difficulty: card.difficulty,
      hint: card.hint,
      created_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('flashcards')
      .insert(flashcardsToInsert);

    if (error) {
      throw error;
    }
  } catch (error) {

    throw error;
  }
};

/**
 * Fetch flashcards for a specific note
 */
export const getFlashcardsForNote = async (
  noteId: string,
  userId: string
): Promise<Flashcard[]> => {
  try {
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('note_id', noteId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return data as Flashcard[];
  } catch (error) {

    throw error;
  }
};

/**
 * Update a flashcard
 */
export const updateFlashcard = async (
  flashcardId: string,
  updates: Partial<Flashcard>,
  userId: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('flashcards')
      .update(updates)
      .eq('id', flashcardId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  } catch (error) {

    throw error;
  }
};

/**
 * Delete a flashcard
 */
export const deleteFlashcard = async (
  flashcardId: string,
  userId: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('flashcards')
      .delete()
      .eq('id', flashcardId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  } catch (error) {

    throw error;
  }
};

/**
 * Export flashcards to various formats
 */
export const exportFlashcards = (
  flashcards: Flashcard[],
  format: 'txt' | 'csv' | 'json' = 'txt'
): void => {
  let content = '';
  let filename = '';
  let mimeType = '';

  switch (format) {
    case 'txt':
      content = flashcards.map(card =>
        `Q: ${card.front}\nA: ${card.back}\n${card.category ? `Category: ${card.category}\n` : ''}Difficulty: ${card.difficulty}\n---\n`
      ).join('\n');
      filename = 'flashcards.txt';
      mimeType = 'text/plain';
      break;

    case 'csv':
      content = 'Front,Back,Category,Difficulty,Hint\n' +
        flashcards.map(card =>
          `"${card.front}","${card.back}","${card.category || ''}","${card.difficulty}","${card.hint || ''}"`
        ).join('\n');
      filename = 'flashcards.csv';
      mimeType = 'text/csv';
      break;

    case 'json':
      content = JSON.stringify(flashcards, null, 2);
      filename = 'flashcards.json';
      mimeType = 'application/json';
      break;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Import flashcards from a file
 */
export const importFlashcards = async (
  file: File
): Promise<Flashcard[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        let flashcards: Flashcard[] = [];

        if (file.name.endsWith('.json')) {
          flashcards = JSON.parse(content);
        } else if (file.name.endsWith('.csv')) {
          const lines = content.split('\n').slice(1); // Skip header
          flashcards = lines.map((line, index) => {
            const [front, back, category, difficulty, hint] = line.split(',').map(s => s.replace(/^"|"$/g, ''));
            return {
              id: `imported-${Date.now()}-${index}`,
              front,
              back,
              category: category || undefined,
              difficulty: (difficulty as any) || 'medium',
              hint: hint || undefined
            };
          });
        } else if (file.name.endsWith('.txt')) {
          const cards = content.split('---\n').filter(s => s.trim());
          flashcards = cards.map((cardText, index) => {
            const frontMatch = cardText.match(/Q: (.+)/);
            const backMatch = cardText.match(/A: (.+)/);
            const categoryMatch = cardText.match(/Category: (.+)/);
            const difficultyMatch = cardText.match(/Difficulty: (.+)/);

            return {
              id: `imported-${Date.now()}-${index}`,
              front: frontMatch ? frontMatch[1].trim() : '',
              back: backMatch ? backMatch[1].trim() : '',
              category: categoryMatch ? categoryMatch[1].trim() : undefined,
              difficulty: (difficultyMatch ? difficultyMatch[1].trim() : 'medium') as any
            };
          });
        }

        resolve(flashcards);
      } catch (error) {
        reject(new Error('Failed to parse flashcard file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};