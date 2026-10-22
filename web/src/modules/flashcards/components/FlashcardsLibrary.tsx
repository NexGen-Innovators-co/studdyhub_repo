import React, { useEffect, useState } from 'react';
import { BookOpen, Loader2, RotateCcw } from 'lucide-react';
import { flashcardsService, type Flashcard } from '@/services/flashcardsService';
import { Button } from '@/modules/ui/components/button';

interface FlashcardsLibraryProps {
    userId: string;
}

export const FlashcardsLibrary: React.FC<FlashcardsLibraryProps> = ({ userId }) => {
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadFlashcards = async () => {
        setLoading(true);
        setError(null);
        try {
            setFlashcards(await flashcardsService.list({ order: 'created_at.desc', limit: 200 }));
        } catch (loadError: any) {
            setError(loadError?.message || 'Unable to load flashcards');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userId) void loadFlashcards();
    }, [userId]);

    return (
        <section className="mx-auto w-full max-w-5xl p-4 sm:p-8">
            <div className="mb-8 flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Flashcards</h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review cards created from your notes or AI chats.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadFlashcards()} disabled={loading} title="Refresh flashcards">
                    <RotateCcw className="mr-2 h-4 w-4" /> Refresh
                </Button>
            </div>

            {loading ? (
                <div className="flex min-h-48 items-center justify-center text-slate-500">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading flashcards...
                </div>
            ) : error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                    <p>{error}</p>
                    <Button className="mt-4" variant="outline" onClick={() => void loadFlashcards()}>Try again</Button>
                </div>
            ) : flashcards.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
                    <BookOpen className="mx-auto mb-4 h-10 w-10 text-slate-400" />
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">No flashcards yet</h2>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Ask StuddyHub AI to create flashcards, and they will appear here.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {flashcards.map((card) => (
                        <article key={card.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                            <div className="mb-4 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                                <span>{card.category || 'General'}</span>
                                <span>{card.difficulty || 'medium'}</span>
                            </div>
                            <h2 className="font-semibold text-slate-900 dark:text-white">{card.front}</h2>
                            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{card.back}</p>
                            {card.hint && <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Hint: {card.hint}</p>}
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
};
