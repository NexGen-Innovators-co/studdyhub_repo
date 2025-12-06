// actions-service.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export class StuddyHubActionsService {
    supabase: any;

    constructor(supabaseUrl: string, supabaseKey: string) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    // ========== HELPER METHODS ==========
    private async getNoteIdByTitle(userId: string, noteTitle: string): Promise<string | null> {
        try {
            const { data: note, error } = await this.supabase
                .from('notes')
                .select('id')
                .eq('user_id', userId)
                .eq('title', noteTitle)
                .single();

            if (error || !note) {
                // Try partial match
                const { data: notes } = await this.supabase
                    .from('notes')
                    .select('id')
                    .eq('user_id', userId)
                    .ilike('title', `%${noteTitle}%`)
                    .limit(1);
                
                return notes?.[0]?.id || null;
            }
            return note.id;
        } catch (error) {
            console.error('[ActionService] Error finding note:', error);
            return null;
        }
    }

    private async getDocumentIdByTitle(userId: string, documentTitle: string): Promise<string | null> {
        try {
            const { data: document, error } = await this.supabase
                .from('documents')
                .select('id')
                .eq('user_id', userId)
                .eq('title', documentTitle)
                .single();

            if (error || !document) {
                // Try partial match
                const { data: documents } = await this.supabase
                    .from('documents')
                    .select('id')
                    .eq('user_id', userId)
                    .ilike('title', `%${documentTitle}%`)
                    .limit(1);
                
                return documents?.[0]?.id || null;
            }
            return document.id;
        } catch (error) {
            console.error('[ActionService] Error finding document:', error);
            return null;
        }
    }

    private async getFolderIdByName(userId: string, folderName: string): Promise<string | null> {
        try {
            const { data: folder, error } = await this.supabase
                .from('document_folders')
                .select('id')
                .eq('user_id', userId)
                .eq('name', folderName)
                .single();

            if (error || !folder) {
                const { data: folders } = await this.supabase
                    .from('document_folders')
                    .select('id')
                    .eq('user_id', userId)
                    .ilike('name', `%${folderName}%`)
                    .limit(1);
                
                return folders?.[0]?.id || null;
            }
            return folder.id;
        } catch (error) {
            console.error('[ActionService] Error finding folder:', error);
            return null;
        }
    }

    private async getQuizIdByTitle(userId: string, quizTitle: string): Promise<string | null> {
        try {
            const { data: quiz, error } = await this.supabase
                .from('quizzes')
                .select('id')
                .eq('user_id', userId)
                .eq('title', quizTitle)
                .single();

            if (error || !quiz) {
                const { data: quizzes } = await this.supabase
                    .from('quizzes')
                    .select('id')
                    .eq('user_id', userId)
                    .ilike('title', `%${quizTitle}%`)
                    .limit(1);
                
                return quizzes?.[0]?.id || null;
            }
            return quiz.id;
        } catch (error) {
            console.error('[ActionService] Error finding quiz:', error);
            return null;
        }
    }

    private async getLearningGoalByText(userId: string, goalText: string): Promise<any | null> {
        try {
            const { data: goal, error } = await this.supabase
                .from('user_learning_goals')
                .select('*')
                .eq('user_id', userId)
                .eq('goal_text', goalText)
                .single();

            if (error || !goal) {
                const { data: goals } = await this.supabase
                    .from('user_learning_goals')
                    .select('*')
                    .eq('user_id', userId)
                    .ilike('goal_text', `%${goalText}%`)
                    .limit(1);
                
                return goals?.[0] || null;
            }
            return goal;
        } catch (error) {
            console.error('[ActionService] Error finding learning goal:', error);
            return null;
        }
    }

    private async getScheduleItemByTitle(userId: string, itemTitle: string): Promise<any | null> {
        try {
            const { data: item, error } = await this.supabase
                .from('schedule_items')
                .select('*')
                .eq('user_id', userId)
                .eq('title', itemTitle)
                .single();

            if (error || !item) {
                const { data: items } = await this.supabase
                    .from('schedule_items')
                    .select('*')
                    .eq('user_id', userId)
                    .ilike('title', `%${itemTitle}%`)
                    .limit(1);
                
                return items?.[0] || null;
            }
            return item;
        } catch (error) {
            console.error('[ActionService] Error finding schedule item:', error);
            return null;
        }
    }

    // ========== NOTE OPERATIONS ==========
    async createNote(userId: string, noteData: {
        title: string;
        content?: string;
        category?: 'general' | 'math' | 'science' | 'history' | 'language' | 'other';
        tags?: string[];
        document_id?: string;
    }) {
        try {
            const { data, error } = await this.supabase
                .from('notes')
                .insert({
                    user_id: userId,
                    title: noteData.title || 'Untitled Note',
                    content: noteData.content || '',
                    category: noteData.category || 'general',
                    tags: noteData.tags || [],
                    document_id: noteData.document_id || null,
                    ai_summary: noteData.content ? this.generateAISummary(noteData.content) : '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select('id, title, category, tags, content, created_at')
                .single();

            if (error) {
                console.error('[ActionService] Error creating note:', error);
                return { success: false, error: error.message };
            }

            console.log(`[ActionService] Created note: "${data.title}" for user ${userId}`);
            return {
                success: true,
                note: data,
                message: `✅ Created note: "${data.title}" in ${data.category} category`,
                xp_reward: 10
            };
        } catch (error: any) {
            console.error('[ActionService] Exception creating note:', error);
            return { success: false, error: 'Failed to create note' };
        }
    }

    async updateNote(userId: string, noteTitle: string, updates: {
        title?: string;
        content?: string;
        category?: string;
        tags?: string[];
    }) {
        try {
            const noteId = await this.getNoteIdByTitle(userId, noteTitle);
            if (!noteId) {
                return { success: false, error: `Note "${noteTitle}" not found` };
            }

            const { data, error } = await this.supabase
                .from('notes')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', noteId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('[ActionService] Error updating note:', error);
                return { success: false, error: error.message };
            }

            return { success: true, note: data, message: `✏️ Updated note: "${data.title}"` };
        } catch (error: any) {
            console.error('[ActionService] Exception updating note:', error);
            return { success: false, error: 'Failed to update note' };
        }
    }

    async deleteNote(userId: string, noteTitle: string) {
        try {
            const noteId = await this.getNoteIdByTitle(userId, noteTitle);
            if (!noteId) {
                return { success: false, error: `Note "${noteTitle}" not found` };
            }

            const { error } = await this.supabase
                .from('notes')
                .delete()
                .eq('id', noteId)
                .eq('user_id', userId);

            if (error) {
                console.error('[ActionService] Error deleting note:', error);
                return { success: false, error: error.message };
            }

            return { success: true, message: `🗑️ Deleted note: "${noteTitle}"`, xp_reward: 5 };
        } catch (error: any) {
            console.error('[ActionService] Exception deleting note:', error);
            return { success: false, error: 'Failed to delete note' };
        }
    }

    async linkDocumentToNote(userId: string, noteTitle: string, documentTitle: string) {
        try {
            const noteId = await this.getNoteIdByTitle(userId, noteTitle);
            const documentId = await this.getDocumentIdByTitle(userId, documentTitle);
            
            if (!noteId) return { success: false, error: `Note "${noteTitle}" not found` };
            if (!documentId) return { success: false, error: `Document "${documentTitle}" not found` };

            const { data, error } = await this.supabase
                .from('notes')
                .update({
                    document_id: documentId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', noteId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('[ActionService] Error linking document:', error);
                return { success: false, error: error.message };
            }

            return {
                success: true,
                message: `📎 Linked "${documentTitle}" to note: "${noteTitle}"`,
                xp_reward: 5
            };
        } catch (error: any) {
            console.error('[ActionService] Exception linking document:', error);
            return { success: false, error: 'Failed to link document' };
        }
    }

    // ========== DOCUMENT FOLDER OPERATIONS ==========
    async createDocumentFolder(userId: string, folderData: {
        name: string;
        description?: string;
        color?: string;
        parent_folder_name?: string;
    }) {
        try {
            let parentFolderId = null;
            if (folderData.parent_folder_name) {
                parentFolderId = await this.getFolderIdByName(userId, folderData.parent_folder_name);
            }

            const { data, error } = await this.supabase
                .from('document_folders')
                .insert({
                    user_id: userId,
                    name: folderData.name,
                    description: folderData.description || '',
                    color: folderData.color || '#3B82F6',
                    parent_folder_id: parentFolderId,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('[ActionService] Error creating folder:', error);
                return { success: false, error: error.message };
            }

            return {
                success: true,
                folder: data,
                message: `📁 Created folder: "${data.name}"`,
                xp_reward: 15
            };
        } catch (error: any) {
            console.error('[ActionService] Exception creating folder:', error);
            return { success: false, error: 'Failed to create folder' };
        }
    }

    async addDocumentToFolder(userId: string, documentTitle: string, folderName: string) {
        try {
            const documentId = await this.getDocumentIdByTitle(userId, documentTitle);
            const folderId = await this.getFolderIdByName(userId, folderName);
            
            if (!documentId) return { success: false, error: `Document "${documentTitle}" not found` };
            if (!folderId) return { success: false, error: `Folder "${folderName}" not found` };

            // First, get the current folder_ids for the document
            const { data: document } = await this.supabase
                .from('documents')
                .select('folder_ids, title')
                .eq('id', documentId)
                .eq('user_id', userId)
                .single();

            if (!document) {
                return { success: false, error: 'Document not found' };
            }

            const currentFolders = document.folder_ids || [];
            const updatedFolders = [...new Set([...currentFolders, folderId])];

            const { error } = await this.supabase
                .from('documents')
                .update({
                    folder_ids: updatedFolders,
                    updated_at: new Date().toISOString()
                })
                .eq('id', documentId)
                .eq('user_id', userId);

            if (error) {
                console.error('[ActionService] Error adding document to folder:', error);
                return { success: false, error: error.message };
            }

            return {
                success: true,
                message: `📄 Added "${document.title}" to folder "${folderName}"`,
                xp_reward: 5
            };
        } catch (error: any) {
            console.error('[ActionService] Exception adding document to folder:', error);
            return { success: false, error: 'Failed to add document to folder' };
        }
    }

    // ========== SCHEDULE OPERATIONS ==========
    async createScheduleItem(userId: string, scheduleData: {
        title: string;
        subject: string;
        type: 'class' | 'study' | 'assignment' | 'exam' | 'other';
        start_time: string;
        end_time: string;
        description?: string;
        location?: string;
        color?: string;
    }) {
        try {
            const { data, error } = await this.supabase
                .from('schedule_items')
                .insert({
                    user_id: userId,
                    title: scheduleData.title,
                    subject: scheduleData.subject,
                    type: scheduleData.type,
                    start_time: scheduleData.start_time,
                    end_time: scheduleData.end_time,
                    description: scheduleData.description || '',
                    location: scheduleData.location || '',
                    color: scheduleData.color || '#3B82F6',
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('[ActionService] Error creating schedule item:', error);
                return { success: false, error: error.message };
            }

            return {
                success: true,
                item: data,
                message: `📅 Scheduled: "${data.title}" on ${new Date(data.start_time).toLocaleDateString()}`,
                xp_reward: 20
            };
        } catch (error: any) {
            console.error('[ActionService] Exception creating schedule item:', error);
            return { success: false, error: 'Failed to create schedule item' };
        }
    }

    async updateScheduleItem(userId: string, itemIdOrTitle: string, updates: any) {
        try {
            let itemId = itemIdOrTitle;
            // If it's not a UUID, assume it's a title
            if (!itemIdOrTitle.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                const item = await this.getScheduleItemByTitle(userId, itemIdOrTitle);
                if (!item) return { success: false, error: `Schedule item "${itemIdOrTitle}" not found` };
                itemId = item.id;
            }

            const { data, error } = await this.supabase
                .from('schedule_items')
                .update(updates)
                .eq('id', itemId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('[ActionService] Error updating schedule item:', error);
                return { success: false, error: error.message };
            }

            return { success: true, item: data, message: `✏️ Updated schedule item: "${data.title}"` };
        } catch (error: any) {
            console.error('[ActionService] Exception updating schedule item:', error);
            return { success: false, error: 'Failed to update schedule item' };
        }
    }

    async deleteScheduleItem(userId: string, itemTitle: string) {
        try {
            const item = await this.getScheduleItemByTitle(userId, itemTitle);
            if (!item) {
                return { success: false, error: `Schedule item "${itemTitle}" not found` };
            }

            const { error } = await this.supabase
                .from('schedule_items')
                .delete()
                .eq('id', item.id)
                .eq('user_id', userId);

            if (error) {
                console.error('[ActionService] Error deleting schedule item:', error);
                return { success: false, error: error.message };
            }

            return { success: true, message: `🗑️ Deleted schedule item: "${itemTitle}"`, xp_reward: 5 };
        } catch (error: any) {
            console.error('[ActionService] Exception deleting schedule item:', error);
            return { success: false, error: 'Failed to delete schedule item' };
        }
    }

    // ========== QUIZ OPERATIONS ==========
    async createQuiz(userId: string, quizData: {
        title: string;
        questions: any[];
        source_type?: 'recording' | 'notes' | 'ai';
        class_id?: string;
    }) {
        try {
            const { data, error } = await this.supabase
                .from('quizzes')
                .insert({
                    user_id: userId,
                    title: quizData.title,
                    questions: quizData.questions,
                    source_type: quizData.source_type || 'ai',
                    class_id: quizData.class_id || null,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('[ActionService] Error creating quiz:', error);
                return { success: false, error: error.message };
            }

            return {
                success: true,
                quiz: data,
                message: `📝 Created quiz: "${data.title}" with ${quizData.questions.length} questions`,
                xp_reward: 25
            };
        } catch (error: any) {
            console.error('[ActionService] Exception creating quiz:', error);
            return { success: false, error: 'Failed to create quiz' };
        }
    }

    async recordQuizAttempt(userId: string, quizTitle: string, attemptData: {
        score: number;
        total_questions: number;
        percentage: number;
        time_taken_seconds: number;
        answers: any[];
        xp_earned: number;
    }) {
        try {
            const quizId = await this.getQuizIdByTitle(userId, quizTitle);
            if (!quizId) {
                return { success: false, error: `Quiz "${quizTitle}" not found` };
            }

            const { data, error } = await this.supabase
                .from('quiz_attempts')
                .insert({
                    quiz_id: quizId,
                    user_id: userId,
                    score: attemptData.score,
                    total_questions: attemptData.total_questions,
                    percentage: attemptData.percentage,
                    time_taken_seconds: attemptData.time_taken_seconds,
                    answers: attemptData.answers,
                    xp_earned: attemptData.xp_earned,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('[ActionService] Error recording quiz attempt:', error);
                return { success: false, error: error.message };
            }

            // Update user stats
            await this.updateUserStats(userId, {
                total_quizzes_attempted: 1,
                total_quizzes_completed: 1,
                total_xp: attemptData.xp_earned
            });

            return {
                success: true,
                attempt: data,
                message: `🏆 Quiz completed! Score: ${attemptData.percentage}% (+${attemptData.xp_earned} XP)`,
                xp_reward: attemptData.xp_earned
            };
        } catch (error: any) {
            console.error('[ActionService] Exception recording quiz attempt:', error);
            return { success: false, error: 'Failed to record quiz attempt' };
        }
    }

    // ========== FLASHCARD OPERATIONS ==========
    async createFlashcardsFromNote(userId: string, noteTitle: string, count: number = 5) {
        try {
            const noteId = await this.getNoteIdByTitle(userId, noteTitle);
            if (!noteId) {
                return { success: false, error: `Note "${noteTitle}" not found` };
            }

            const { data: note } = await this.supabase
                .from('notes')
                .select('content, title')
                .eq('id', noteId)
                .eq('user_id', userId)
                .single();

            if (!note) {
                return { success: false, error: 'Note not found' };
            }

            // Generate simple flashcards from note content
            const flashcards = this.generateFlashcardsFromContent(note.content, count);

            const { data, error } = await this.supabase
                .from('flashcards')
                .insert(
                    flashcards.map(flashcard => ({
                        user_id: userId,
                        note_id: noteId,
                        front: flashcard.front,
                        back: flashcard.back,
                        category: note.title.substring(0, 20),
                        difficulty: 'medium',
                        review_count: 0,
                        last_reviewed_at: null,
                        next_review_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                        ease_factor: 2.5,
                        interval_days: 1,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }))
                )
                .select();

            if (error) {
                console.error('[ActionService] Error creating flashcards:', error);
                return { success: false, error: error.message };
            }

            return {
                success: true,
                flashcards: data,
                message: `🎴 Created ${data.length} flashcards from note: "${note.title}"`,
                xp_reward: 15
            };
        } catch (error: any) {
            console.error('[ActionService] Exception creating flashcards:', error);
            return { success: false, error: 'Failed to create flashcards' };
        }
    }

    async createFlashcard(userId: string, flashcardData: {
        note_id?: string;
        front: string;
        back: string;
        category?: string;
        difficulty?: 'easy' | 'medium' | 'hard';
        hint?: string;
    }) {
        try {
            const { data, error } = await this.supabase
                .from('flashcards')
                .insert({
                    user_id: userId,
                    note_id: flashcardData.note_id || null,
                    front: flashcardData.front,
                    back: flashcardData.back,
                    category: flashcardData.category || 'General',
                    difficulty: flashcardData.difficulty || 'medium',
                    hint: flashcardData.hint || null,
                    review_count: 0,
                    last_reviewed_at: null,
                    next_review_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    ease_factor: 2.5,
                    interval_days: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('[ActionService] Error creating flashcard:', error);
                return { success: false, error: error.message };
            }

            return {
                success: true,
                flashcard: data,
                message: `🎴 Created flashcard: "${flashcardData.front.substring(0, 30)}..."`,
                xp_reward: 5
            };
        } catch (error: any) {
            console.error('[ActionService] Exception creating flashcard:', error);
            return { success: false, error: 'Failed to create flashcard' };
        }
    }

    async updateFlashcardReview(userId: string, flashcardId: string, reviewData: {
        difficulty_rating: number; // 0-5 scale
        correct: boolean;
    }) {
        try {
            const { data: flashcard } = await this.supabase
                .from('flashcards')
                .select('*')
                .eq('id', flashcardId)
                .eq('user_id', userId)
                .single();

            if (!flashcard) {
                return { success: false, error: 'Flashcard not found' };
            }

            // Calculate new interval using SM-2 algorithm
            const newEaseFactor = this.calculateNewEaseFactor(
                flashcard.ease_factor || 2.5,
                reviewData.difficulty_rating
            );

            let newInterval = flashcard.interval_days || 1;
            if (reviewData.correct) {
                newInterval = Math.ceil((flashcard.interval_days || 1) * newEaseFactor);
            } else {
                newInterval = 1; // Reset to 1 day if incorrect
            }

            const nextReviewDate = new Date();
            nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

            const { data, error } = await this.supabase
                .from('flashcards')
                .update({
                    review_count: (flashcard.review_count || 0) + 1,
                    last_reviewed_at: new Date().toISOString(),
                    next_review_at: nextReviewDate.toISOString(),
                    ease_factor: newEaseFactor,
                    interval_days: newInterval,
                    updated_at: new Date().toISOString()
                })
                .eq('id', flashcardId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('[ActionService] Error updating flashcard review:', error);
                return { success: false, error: error.message };
            }

            return { success: true, flashcard: data };
        } catch (error: any) {
            console.error('[ActionService] Exception updating flashcard review:', error);
            return { success: false, error: 'Failed to update flashcard review' };
        }
    }

    // ========== LEARNING GOALS ==========
    async createLearningGoal(userId: string, goalData: {
        goal_text: string;
        target_date?: string;
        progress?: number;
        category?: string;
    }) {
        try {
            const { data, error } = await this.supabase
                .from('user_learning_goals')
                .insert({
                    user_id: userId,
                    goal_text: goalData.goal_text,
                    target_date: goalData.target_date || null,
                    progress: goalData.progress || 0,
                    category: goalData.category || 'general',
                    is_completed: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('[ActionService] Error creating learning goal:', error);
                return { success: false, error: error.message };
            }

            return {
                success: true,
                goal: data,
                message: `🎯 Created learning goal: "${data.goal_text}"`,
                xp_reward: 10
            };
        } catch (error: any) {
            console.error('[ActionService] Exception creating learning goal:', error);
            return { success: false, error: 'Failed to create learning goal' };
        }
    }

    async updateLearningGoalProgress(userId: string, goalText: string, progress: number) {
        try {
            const goal = await this.getLearningGoalByText(userId, goalText);
            if (!goal) {
                return { success: false, error: `Learning goal "${goalText}" not found` };
            }

            const { data, error } = await this.supabase
                .from('user_learning_goals')
                .update({
                    progress: Math.min(100, Math.max(0, progress)),
                    is_completed: progress >= 100,
                    updated_at: new Date().toISOString()
                })
                .eq('id', goal.id)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('[ActionService] Error updating learning goal:', error);
                return { success: false, error: error.message };
            }

            let xpReward = 0;
            if (progress >= 100 && !goal.is_completed) {
                xpReward = 50; // Bonus XP for completing goal
            } else if (progress - goal.progress >= 25) {
                xpReward = 10; // XP for significant progress
            }

            return { 
                success: true, 
                goal: data, 
                message: `🎯 Updated goal progress to ${progress}%`,
                xp_reward: xpReward
            };
        } catch (error: any) {
            console.error('[ActionService] Exception updating learning goal:', error);
            return { success: false, error: 'Failed to update learning goal' };
        }
    }

    // ========== CLASS RECORDINGS ==========
    async createClassRecording(userId: string, recordingData: {
        title: string;
        subject: string;
        audio_url?: string;
        duration: number;
        transcript?: string;
        summary?: string;
        document_title?: string;
    }) {
        try {
            let documentId = null;
            if (recordingData.document_title) {
                documentId = await this.getDocumentIdByTitle(userId, recordingData.document_title);
            }

            const { data, error } = await this.supabase
                .from('class_recordings')
                .insert({
                    user_id: userId,
                    title: recordingData.title,
                    subject: recordingData.subject,
                    audio_url: recordingData.audio_url || null,
                    duration: recordingData.duration,
                    transcript: recordingData.transcript || '',
                    summary: recordingData.summary || '',
                    document_id: documentId,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('[ActionService] Error creating recording:', error);
                return { success: false, error: error.message };
            }

            return {
                success: true,
                recording: data,
                message: `🎙️ Created recording: "${data.title}" (${Math.round(data.duration / 60)} minutes)`,
                xp_reward: 30
            };
        } catch (error: any) {
            console.error('[ActionService] Exception creating recording:', error);
            return { success: false, error: 'Failed to create recording' };
        }
    }

    // ========== USER STATS & PROFILE ==========
    async updateUserStats(userId: string, updates: {
        total_xp?: number;
        level?: number;
        current_streak?: number;
        longest_streak?: number;
        total_quizzes_attempted?: number;
        total_quizzes_completed?: number;
        average_score?: number;
        total_study_time_seconds?: number;
        weak_areas?: string[];
    }) {
        try {
            // First, get current stats
            const { data: currentStats } = await this.supabase
                .from('user_stats')
                .select('*')
                .eq('user_id', userId)
                .single();

            const newStats = {
                ...(currentStats || {}),
                ...updates,
                updated_at: new Date().toISOString()
            };

            // Calculate new level based on XP (simplified: 1000 XP per level)
            if (newStats.total_xp !== undefined) {
                newStats.level = Math.floor(newStats.total_xp / 1000) + 1;
            }

            // Update or insert
            let result;
            if (currentStats) {
                const { data, error } = await this.supabase
                    .from('user_stats')
                    .update(newStats)
                    .eq('user_id', userId)
                    .select()
                    .single();

                if (error) throw error;
                result = data;
            } else {
                const { data, error } = await this.supabase
                    .from('user_stats')
                    .insert({
                        user_id: userId,
                        ...newStats,
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (error) throw error;
                result = data;
            }

            return { success: true, stats: result };
        } catch (error: any) {
            console.error('[ActionService] Exception updating user stats:', error);
            return { success: false, error: 'Failed to update user stats' };
        }
    }

    async updateUserProfile(userId: string, updates: {
        learning_style?: string;
        learning_preferences?: any;
        quiz_preferences?: any;
        is_public?: boolean;
    }) {
        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select()
                .single();

            if (error) {
                console.error('[ActionService] Error updating profile:', error);
                return { success: false, error: error.message };
            }

            return { 
                success: true, 
                profile: data,
                message: `👤 Updated profile preferences`
            };
        } catch (error: any) {
            console.error('[ActionService] Exception updating profile:', error);
            return { success: false, error: 'Failed to update profile' };
        }
    }

    // ========== SOCIAL OPERATIONS ==========
    async createSocialPost(userId: string, postData: {
        content: string;
        privacy?: 'public' | 'followers' | 'private';
        group_name?: string;
    }) {
        try {
            let groupId = null;
            if (postData.group_name) {
                const { data: group } = await this.supabase
                    .from('social_groups')
                    .select('id')
                    .eq('name', postData.group_name)
                    .single();
                groupId = group?.id || null;
            }

            // First, ensure social user exists
            const { data: socialUser } = await this.supabase
                .from('social_users')
                .select('id')
                .eq('id', userId)
                .single();

            if (!socialUser) {
                const { data: profile } = await this.supabase
                    .from('profiles')
                    .select('full_name, username, email')
                    .eq('id', userId)
                    .single();

                await this.supabase
                    .from('social_users')
                    .insert({
                        id: userId,
                        username: profile?.username || `user_${userId.substring(0, 8)}`,
                        display_name: profile?.full_name || 'User',
                        email: profile?.email,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
            }

            const { data, error } = await this.supabase
                .from('social_posts')
                .insert({
                    author_id: userId,
                    content: postData.content,
                    privacy: postData.privacy || 'public',
                    group_id: groupId,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('[ActionService] Error creating social post:', error);
                return { success: false, error: error.message };
            }

            return {
                success: true,
                post: data,
                message: `📱 Posted: "${postData.content.substring(0, 50)}..."`,
                xp_reward: 20
            };
        } catch (error: any) {
            console.error('[ActionService] Exception creating social post:', error);
            return { success: false, error: 'Failed to create social post' };
        }
    }

    // ========== ACHIEVEMENTS ==========
    async awardAchievement(userId: string, badgeName: string) {
        try {
            // First, get badge by name
            const { data: badge } = await this.supabase
                .from('badges')
                .select('id, name, xp_reward')
                .eq('name', badgeName)
                .single();

            if (!badge) {
                return { success: false, error: `Badge "${badgeName}" not found` };
            }

            const { data, error } = await this.supabase
                .from('achievements')
                .insert({
                    user_id: userId,
                    badge_id: badge.id,
                    earned_at: new Date().toISOString()
                })
                .select(`id, earned_at, badges(name, description, icon, xp_reward)`)
                .single();

            if (error) {
                console.error('[ActionService] Error awarding achievement:', error);
                return { success: false, error: error.message };
            }

            // Add XP reward to user stats
            if (data.badges?.xp_reward) {
                await this.updateUserStats(userId, {
                    total_xp: data.badges.xp_reward
                });
            }

            return {
                success: true,
                achievement: data,
                message: `🏆 Earned achievement: ${data.badges?.name}!`,
                xp_reward: data.badges?.xp_reward || 0
            };
        } catch (error: any) {
            console.error('[ActionService] Exception awarding achievement:', error);
            return { success: false, error: 'Failed to award achievement' };
        }
    }

    // ========== AI USER MEMORY ==========
    async updateUserMemory(userId: string, memoryData: {
        fact_type: 'preference' | 'learning_style' | 'personal_fact' | 'skill_level' | 'interest';
        fact_key: string;
        fact_value: any;
        confidence_score?: number;
        source_session_id?: string;
    }) {
        try {
            // Check if fact already exists
            const { data: existing } = await this.supabase
                .from('ai_user_memory')
                .select('id, confidence_score, referenced_count')
                .eq('user_id', userId)
                .eq('fact_type', memoryData.fact_type)
                .eq('fact_key', memoryData.fact_key)
                .eq('fact_value', memoryData.fact_value)
                .maybeSingle();

            if (existing) {
                // Update existing fact
                const { data, error } = await this.supabase
                    .from('ai_user_memory')
                    .update({
                        confidence_score: Math.min(1.0, existing.confidence_score + 0.1),
                        last_referenced: new Date().toISOString(),
                        referenced_count: (existing.referenced_count || 0) + 1
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) throw error;
                return { success: true, memory: data };
            } else {
                // Insert new fact
                const { data, error } = await this.supabase
                    .from('ai_user_memory')
                    .insert({
                        user_id: userId,
                        fact_type: memoryData.fact_type,
                        fact_key: memoryData.fact_key,
                        fact_value: memoryData.fact_value,
                        confidence_score: memoryData.confidence_score || 0.7,
                        source_session_id: memoryData.source_session_id,
                        last_referenced: new Date().toISOString(),
                        referenced_count: 1,
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (error) throw error;
                return { success: true, memory: data };
            }
        } catch (error: any) {
            console.error('[ActionService] Exception updating user memory:', error);
            return { success: false, error: 'Failed to update user memory' };
        }
    }

    // ========== HELPER METHODS ==========
    private generateAISummary(content: string): string {
        if (content.length <= 200) return content;
        // Simple summary - in production, use actual AI
        const sentences = content.split(/[.!?]+/);
        return sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '...' : '');
    }

    private generateFlashcardsFromContent(content: string, count: number): Array<{ front: string, back: string }> {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
        const flashcards: Array<{ front: string, back: string }> = [];

        for (let i = 0; i < Math.min(count, sentences.length); i++) {
            const sentence = sentences[i].trim();
            const words = sentence.split(' ');

            if (words.length > 5) {
                // Create fill-in-the-blank style flashcard
                const blankIndex = Math.floor(words.length / 2);
                const front = [...words];
                front[blankIndex] = '______';

                flashcards.push({
                    front: front.join(' ') + '?',
                    back: sentence
                });
            }
        }

        // If not enough sentences, create definition cards
        if (flashcards.length < count) {
            const keyTerms = this.extractKeyTerms(content);
            for (let i = 0; i < Math.min(keyTerms.length, count - flashcards.length); i++) {
                flashcards.push({
                    front: `What is ${keyTerms[i]}?`,
                    back: `Definition or explanation for ${keyTerms[i]}`
                });
            }
        }

        return flashcards;
    }

    private extractKeyTerms(content: string): string[] {
        // Simple key term extraction
        const words = content.toLowerCase().split(/\s+/);
        const commonWords = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'have', 'from']);
        const terms = new Set<string>();
        
        for (const word of words) {
            const cleaned = word.replace(/[^\w]/g, '');
            if (cleaned.length > 4 && !commonWords.has(cleaned)) {
                terms.add(cleaned);
            }
        }
        
        return Array.from(terms).slice(0, 10);
    }

    private calculateNewEaseFactor(currentEaseFactor: number, difficultyRating: number): number {
        // SM-2 algorithm
        let newEF = currentEaseFactor + (0.1 - (5 - difficultyRating) * (0.08 + (5 - difficultyRating) * 0.02));

        if (newEF < 1.3) newEF = 1.3;
        if (newEF > 2.5) newEF = 2.5;

        return newEF;
    }

    // ========== ACTION PARSER ==========
    parseActionFromText(text: string): {
        action: string;
        params: Record<string, any>;
        confidence: number;
    } | null {
        const lowerText = text.toLowerCase();

        // Comprehensive action detection
        const actionPatterns = [
            // NOTE ACTIONS
            {
                pattern: /ACTION:\s*CREATE_NOTE\|([^|]+)\|([^|]*)\|([^|]*)\|([^|]*)/,
                action: 'CREATE_NOTE',
                extractor: (match: RegExpMatchArray) => ({
                    title: match[1].trim(),
                    content: match[2].trim(),
                    category: match[3].trim() as any || 'general',
                    tags: match[4].split(',').map((t: string) => t.trim()).filter((t: string) => t)
                })
            },
            {
                pattern: /ACTION:\s*UPDATE_NOTE\|([^|]+)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)/,
                action: 'UPDATE_NOTE',
                extractor: (match: RegExpMatchArray) => ({
                    noteTitle: match[1].trim(),
                    title: match[2].trim(),
                    content: match[3].trim(),
                    category: match[4].trim(),
                    tags: match[5].split(',').map((t: string) => t.trim()).filter((t: string) => t)
                })
            },
            {
                pattern: /ACTION:\s*DELETE_NOTE\|([^|]+)/,
                action: 'DELETE_NOTE',
                extractor: (match: RegExpMatchArray) => ({
                    noteTitle: match[1].trim()
                })
            },
            {
                pattern: /ACTION:\s*LINK_DOCUMENT_TO_NOTE\|([^|]+)\|([^|]+)/,
                action: 'LINK_DOCUMENT_TO_NOTE',
                extractor: (match: RegExpMatchArray) => ({
                    noteTitle: match[1].trim(),
                    documentTitle: match[2].trim()
                })
            },
            
            // FOLDER ACTIONS
            {
                pattern: /ACTION:\s*CREATE_FOLDER\|([^|]+)\|([^|]*)\|([^|]*)\|([^|]*)/,
                action: 'CREATE_FOLDER',
                extractor: (match: RegExpMatchArray) => ({
                    name: match[1].trim(),
                    description: match[2].trim(),
                    color: match[3].trim() || '#3B82F6',
                    parent_folder_name: match[4].trim() || null
                })
            },
            {
                pattern: /ACTION:\s*ADD_DOCUMENT_TO_FOLDER\|([^|]+)\|([^|]+)/,
                action: 'ADD_DOCUMENT_TO_FOLDER',
                extractor: (match: RegExpMatchArray) => ({
                    documentTitle: match[1].trim(),
                    folderName: match[2].trim()
                })
            },
            
            // SCHEDULE ACTIONS
            {
                pattern: /ACTION:\s*CREATE_SCHEDULE\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]*)\|([^|]*)\|([^|]*)/,
                action: 'CREATE_SCHEDULE',
                extractor: (match: RegExpMatchArray) => ({
                    title: match[1].trim(),
                    subject: match[2].trim(),
                    type: match[3].trim() as any || 'study',
                    start_time: match[4].trim(),
                    end_time: match[5].trim(),
                    description: match[6].trim(),
                    location: match[7].trim(),
                    color: match[8].trim() || '#3B82F6'
                })
            },
            {
                pattern: /ACTION:\s*UPDATE_SCHEDULE\|([^|]+)\|([^|]+)/,
                action: 'UPDATE_SCHEDULE',
                extractor: (match: RegExpMatchArray) => ({
                    itemTitle: match[1].trim(),
                    updates: JSON.parse(match[2].trim())
                })
            },
            {
                pattern: /ACTION:\s*DELETE_SCHEDULE\|([^|]+)/,
                action: 'DELETE_SCHEDULE',
                extractor: (match: RegExpMatchArray) => ({
                    itemTitle: match[1].trim()
                })
            },
            
            // FLASHCARD ACTIONS
            {
                pattern: /ACTION:\s*CREATE_FLASHCARDS_FROM_NOTE\|([^|]+)\|(\d+)/,
                action: 'CREATE_FLASHCARDS_FROM_NOTE',
                extractor: (match: RegExpMatchArray) => ({
                    noteTitle: match[1].trim(),
                    count: parseInt(match[2].trim())
                })
            },
            {
                pattern: /ACTION:\s*CREATE_FLASHCARD\|([^|]+)\|([^|]+)\|([^|]*)\|([^|]*)\|([^|]*)/,
                action: 'CREATE_FLASHCARD',
                extractor: (match: RegExpMatchArray) => ({
                    front: match[1].trim(),
                    back: match[2].trim(),
                    category: match[3].trim() || 'General',
                    difficulty: (match[4].trim() as any) || 'medium',
                    hint: match[5].trim() || null
                })
            },
            
            // LEARNING GOAL ACTIONS
            {
                pattern: /ACTION:\s*CREATE_LEARNING_GOAL\|([^|]+)\|([^|]*)\|([^|]*)\|([^|]*)/,
                action: 'CREATE_LEARNING_GOAL',
                extractor: (match: RegExpMatchArray) => ({
                    goal_text: match[1].trim(),
                    target_date: match[2].trim() || null,
                    category: match[3].trim() || 'general',
                    progress: parseInt(match[4].trim()) || 0
                })
            },
            {
                pattern: /ACTION:\s*UPDATE_LEARNING_GOAL\|([^|]+)\|(\d+)/,
                action: 'UPDATE_LEARNING_GOAL',
                extractor: (match: RegExpMatchArray) => ({
                    goalText: match[1].trim(),
                    progress: parseInt(match[2].trim())
                })
            },
            
            // QUIZ ACTIONS
            {
                pattern: /ACTION:\s*CREATE_QUIZ\|([^|]+)\|(\d+)\|([^|]*)\|([^|]*)/,
                action: 'CREATE_QUIZ',
                extractor: (match: RegExpMatchArray) => ({
                    title: match[1].trim(),
                    question_count: parseInt(match[2].trim()),
                    source_type: match[3].trim() || 'ai',
                    class_id: match[4].trim() || null
                })
            },
            {
                pattern: /ACTION:\s*RECORD_QUIZ_ATTEMPT\|([^|]+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)/,
                action: 'RECORD_QUIZ_ATTEMPT',
                extractor: (match: RegExpMatchArray) => ({
                    quizTitle: match[1].trim(),
                    score: parseInt(match[2].trim()),
                    total_questions: parseInt(match[3].trim()),
                    time_taken_seconds: parseInt(match[4].trim()),
                    xp_earned: parseInt(match[5].trim())
                })
            },
            
            // RECORDING ACTIONS
            {
                pattern: /ACTION:\s*CREATE_RECORDING\|([^|]+)\|([^|]+)\|(\d+)\|([^|]*)\|([^|]*)\|([^|]*)/,
                action: 'CREATE_RECORDING',
                extractor: (match: RegExpMatchArray) => ({
                    title: match[1].trim(),
                    subject: match[2].trim(),
                    duration: parseInt(match[3].trim()),
                    transcript: match[4].trim(),
                    summary: match[5].trim(),
                    document_title: match[6].trim()
                })
            },
            
            // PROFILE & STATS ACTIONS
            {
                pattern: /ACTION:\s*UPDATE_PROFILE\|([^|]+)/,
                action: 'UPDATE_PROFILE',
                extractor: (match: RegExpMatchArray) => ({
                    updates: JSON.parse(match[1].trim())
                })
            },
            {
                pattern: /ACTION:\s*UPDATE_STATS\|([^|]+)/,
                action: 'UPDATE_STATS',
                extractor: (match: RegExpMatchArray) => ({
                    updates: JSON.parse(match[1].trim())
                })
            },
            {
                pattern: /ACTION:\s*AWARD_ACHIEVEMENT\|([^|]+)/,
                action: 'AWARD_ACHIEVEMENT',
                extractor: (match: RegExpMatchArray) => ({
                    badgeName: match[1].trim()
                })
            },
            
            // SOCIAL ACTIONS
            {
                pattern: /ACTION:\s*CREATE_POST\|([^|]+)\|([^|]*)\|([^|]*)/,
                action: 'CREATE_POST',
                extractor: (match: RegExpMatchArray) => ({
                    content: match[1].trim(),
                    privacy: (match[2].trim() as any) || 'public',
                    group_name: match[3].trim() || null
                })
            },
            
            // MEMORY ACTIONS
            {
                pattern: /ACTION:\s*UPDATE_USER_MEMORY\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]*)/,
                action: 'UPDATE_USER_MEMORY',
                extractor: (match: RegExpMatchArray) => ({
                    fact_type: match[1].trim() as any,
                    fact_key: match[2].trim(),
                    fact_value: match[3].trim(),
                    confidence_score: parseFloat(match[4].trim()) || 0.7
                })
            }
        ];

        // First, check for explicit action markers
        for (const pattern of actionPatterns) {
            const match = text.match(pattern.pattern);
            if (match) {
                console.log(`[ActionParser] Found explicit action: ${pattern.action}`);
                return {
                    action: pattern.action,
                    params: pattern.extractor(match),
                    confidence: 0.95
                };
            }
        }

        // Fallback: Natural language detection
        if (lowerText.includes('create a note') || lowerText.includes('make a note')) {
            return {
                action: 'CREATE_NOTE',
                params: {
                    title: this.extractTitle(text) || 'New Note',
                    content: this.extractContent(text) || 'Note content',
                    category: 'general',
                    tags: this.extractTags(text)
                },
                confidence: 0.7
            };
        }

        if (lowerText.includes('make flashcards') && lowerText.includes('from note')) {
            const noteMatch = text.match(/from (?:my )?note[:\s]+"?([^"\n]+)"?/i);
            const countMatch = text.match(/(\d+)\s+(?:flashcards?|cards?)/i);
            
            return {
                action: 'CREATE_FLASHCARDS_FROM_NOTE',
                params: {
                    noteTitle: noteMatch ? noteMatch[1].trim() : this.extractTitle(text) || 'Recent Note',
                    count: countMatch ? parseInt(countMatch[1]) : 5
                },
                confidence: 0.8
            };
        }

        if (lowerText.includes('schedule') || lowerText.includes('calendar')) {
            return {
                action: 'CREATE_SCHEDULE',
                params: {
                    title: this.extractTitle(text) || 'Study Session',
                    subject: 'Study',
                    type: 'study',
                    start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
                    description: this.extractContent(text) || '',
                    location: '',
                    color: '#3B82F6'
                },
                confidence: 0.6
            };
        }

        if (lowerText.includes('learning goal') || lowerText.includes('set goal')) {
            return {
                action: 'CREATE_LEARNING_GOAL',
                params: {
                    goal_text: this.extractGoalText(text) || 'New Learning Goal',
                    target_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    category: 'general',
                    progress: 0
                },
                confidence: 0.7
            };
        }

        return null;
    }

    private extractTitle(text: string): string | null {
        const match = text.match(/"([^"]+)"/);
        return match ? match[1] : null;
    }

    private extractContent(text: string): string {
        const contentMatch = text.match(/Content:\s*([^\n]+)/);
        return contentMatch ? contentMatch[1] : 'Content extracted from conversation';
    }

    private extractGoalText(text: string): string | null {
        const match = text.match(/goal[:\s]+"?([^"\n]+)"?/i);
        return match ? match[1].trim() : null;
    }

    private extractTags(text: string): string[] {
        const tagsMatch = text.match(/Tags?:\s*([^\n]+)/);
        if (tagsMatch) {
            return tagsMatch[1]
                .split(/[,#\s]+/)
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0 && tag !== 'Tags' && tag !== 'Tag');
        }

        // Also look for hashtags
        const hashtags = text.match(/#(\w+)/g);
        return hashtags ? hashtags.map(tag => tag.substring(1)) : [];
    }
}