// components/FlashcardDeck.tsx - Fixed overflow issues
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, RotateCw, Plus, Edit2, Trash2, Sparkles, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getFlashcardsForNote, saveFlashcards, deleteFlashcard } from '../services/FlashCardServices';
import BookPagesAnimation from '@/components/ui/bookloader';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  hint?: string;
}

interface FlashcardDeckProps {
  noteId: string;
  userId: string;
  onGenerate: () => void;
}

export const FlashcardDeck: React.FC<FlashcardDeckProps> = ({ noteId, userId, onGenerate }) => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFlashcards();
  }, [noteId]);

  const loadFlashcards = async () => {
    try {
      const cards = await getFlashcardsForNote(noteId, userId);
      setFlashcards(cards);
    } catch (error) {
      toast.error('Failed to load flashcards');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlip = (id: string) => {
    setFlipped(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFlashcard(id, userId);
      setFlashcards(prev => prev.filter(c => c.id !== id));
      toast.success('Flashcard deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <BookPagesAnimation showText text='loading your flashcards..' size='lg'/>
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-gray-100 dark:from-blue-900/30 dark:to-gray-900/30 rounded-full flex items-center justify-center">
          <Brain className="w-10 h-10 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold mb-1 text-gray-800 dark:text-gray-100">
          No Flashcards Yet
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-xs mx-auto">
          Generate AI-powered flashcards from your note to boost retention!
        </p>
        <button
          onClick={onGenerate}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-gray-600 hover:from-blue-700 hover:to-gray-700 text-white rounded-lg font-medium flex items-center gap-2 mx-auto shadow-md transition-all"
        >
          <Sparkles className="w-4 h-4" />
          Generate Flashcards
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-2 sm:px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            Your Flashcards
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {flashcards.length} card{flashcards.length !== 1 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={onGenerate}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Generate More
        </button>
      </div>

      {/* Cards Grid - Fixed responsive layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto pb-4">
        <AnimatePresence>
          {flashcards.map((card) => (
            <motion.div
              key={card.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="relative"
            >
              {/* Card Container */}
              <div
                className="relative w-full h-64 cursor-pointer"
                style={{ perspective: '1000px' }}
                onClick={() => handleFlip(card.id)}
              >
                {/* Front Side */}
                <motion.div
                  className="absolute inset-0 w-full h-full"
                  initial={false}
                  animate={{ rotateY: flipped.has(card.id) ? 180 : 0 }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                  style={{ 
                    backfaceVisibility: 'hidden',
                    transformStyle: 'preserve-3d'
                  }}
                >
                  <div className="h-full bg-gradient-to-br from-blue-500 to-gray-500 rounded-xl shadow-lg p-4 flex flex-col justify-between text-white overflow-hidden">
                    <div className="flex-1 overflow-y-auto">
                      <div className="flex items-center justify-between mb-3 flex-shrink-0">
                        <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-xs font-medium">
                          Question
                        </span>
                        {card.difficulty && (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            card.difficulty === 'easy' ? 'bg-green-400 text-green-900' :
                            card.difficulty === 'hard' ? 'bg-red-400 text-red-900' : 'bg-yellow-400 text-yellow-900'
                          }`}>
                            {card.difficulty.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-base sm:text-lg font-medium leading-relaxed break-words">
                        {card.front}
                      </p>
                      {card.hint && (
                        <p className="text-xs sm:text-sm opacity-80 mt-3 italic break-words">
                          💡 Hint: {card.hint}
                        </p>
                      )}
                    </div>
                    <div className="text-center text-xs sm:text-sm opacity-70 mt-2 flex-shrink-0">
                      Click to reveal answer
                    </div>
                  </div>
                </motion.div>

                {/* Back Side */}
                <motion.div
                  className="absolute inset-0 w-full h-full"
                  initial={false}
                  animate={{ rotateY: flipped.has(card.id) ? 0 : -180 }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                  style={{ 
                    backfaceVisibility: 'hidden',
                    transformStyle: 'preserve-3d'
                  }}
                >
                  <div className="h-full bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg p-4 flex flex-col justify-between text-white overflow-hidden">
                    <div className="flex-1 overflow-y-auto">
                      <div className="flex items-center justify-between mb-3 flex-shrink-0">
                        <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-xs font-medium">
                          Answer
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(card.id);
                          }}
                          className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                          aria-label="Delete flashcard"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-base sm:text-lg font-medium leading-relaxed break-words">
                        {card.back}
                      </p>
                    </div>
                    <div className="flex gap-2 justify-center mt-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFlip(card.id);
                        }}
                        className="px-4 py-2 bg-white/20 backdrop-blur hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                      >
                        Flip Back
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Category Badge */}
              {card.category && (
                <div className="mt-2 text-center">
                  <span className="inline-block px-2.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium truncate max-w-full">
                    {card.category}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};