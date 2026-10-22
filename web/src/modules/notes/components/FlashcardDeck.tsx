// components/FlashcardDeck.tsx - Fixed overflow issues
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Plus, Trash2, Sparkles, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getFlashcardsForNote, deleteFlashcard } from '../services/FlashCardServices';
import BookPagesAnimation from '@/modules/ui/components/bookloader';

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
  lastUpdated?: number;
  onClose?: () => void;
}

export const FlashcardDeck: React.FC<FlashcardDeckProps> = ({ noteId, userId, onGenerate, lastUpdated, onClose }) => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFlashcards();
  }, [noteId, lastUpdated]);

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
    <div className="space-y-4 px-2 ">
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

        <div className="flex items-center gap-2">
          <button
            onClick={onGenerate}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            Generate More
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Close Flashcards"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Cards Grid - Fixed responsive layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
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
                <motion.div
                  className="relative h-full w-full"
                  initial={false}
                  animate={{ rotateY: flipped.has(card.id) ? 180 : 0 }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {/* Front Side */}
                  <div
                    className="absolute inset-0 h-full rounded-xl bg-gradient-to-br from-blue-500 to-gray-500 p-4 text-white shadow-lg [backface-visibility:hidden]"
                    style={{ transform: 'rotateY(0deg)' }}
                  >
                    <div className="flex h-full flex-col justify-between overflow-hidden">
                      <div className="flex-1 overflow-y-auto">
                        <div className="mb-3 flex flex-shrink-0 items-center justify-between">
                          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
                            Question
                          </span>
                          {card.difficulty && (
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              card.difficulty === 'easy' ? 'bg-green-400 text-green-900' :
                              card.difficulty === 'hard' ? 'bg-red-400 text-red-900' : 'bg-yellow-400 text-yellow-900'
                            }`}>
                              {card.difficulty.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="break-words text-base font-medium leading-relaxed sm:text-lg">
                          {card.front}
                        </p>
                        {card.hint && (
                          <p className="mt-3 break-words text-xs italic opacity-80 sm:text-sm">
                            💡 Hint: {card.hint}
                          </p>
                        )}
                      </div>
                      <div className="mt-2 flex-shrink-0 text-center text-xs opacity-70 sm:text-sm">
                        Click to reveal answer
                      </div>
                    </div>
                  </div>

                  {/* Back Side */}
                  <div
                    className="absolute inset-0 h-full rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 p-4 text-white shadow-lg [backface-visibility:hidden]"
                    style={{ transform: 'rotateY(180deg)' }}
                  >
                    <div className="flex h-full flex-col justify-between overflow-hidden">
                      <div className="flex-1 overflow-y-auto">
                        <div className="mb-3 flex flex-shrink-0 items-center justify-between">
                          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
                            Answer
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(card.id);
                            }}
                            className="flex-shrink-0 rounded-lg p-2 transition-colors hover:bg-white/20"
                            aria-label="Delete flashcard"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="break-words text-base font-medium leading-relaxed sm:text-lg">
                          {card.back || 'No answer is available for this flashcard.'}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-shrink-0 justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFlip(card.id);
                          }}
                          className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium transition-colors backdrop-blur hover:bg-white/30"
                        >
                          Show question
                        </button>
                      </div>
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