// context-service.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export class UserContextService {
    supabase;

    constructor(supabaseUrl, supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    // Add this method for action support - OPTIMIZED FOR ACCURACY
    async getActionableContext(userId: string) {
        try {
            // Run comprehensive parallel queries for full context
            const [
                notesResult,
                documentsResult,
                foldersResult,
                scheduleResult,
                goalsResult,
                quizzesResult
            ] = await Promise.all([
                // Get comprehensive notes list
                this.supabase.from('notes')
                    .select('id, title, category, tags, ai_summary')
                    .eq('user_id', userId)
                    .order('updated_at', { ascending: false })
                    .limit(50),

                // Get comprehensive documents list
                this.supabase.from('documents')
                    .select('id, title, type, processing_status')
                    .eq('user_id', userId)
                    .order('updated_at', { ascending: false })
                    .limit(50),

                // Get folder structure for organization
                this.supabase.from('document_folders')
                    .select('id, name, parent_folder_id, color')
                    .eq('user_id', userId)
                    .order('updated_at', { ascending: false }),

                // Get upcoming schedule
                this.supabase.from('schedule_items')
                    .select('id, title, start_time, subject, type')
                    .eq('user_id', userId)
                    .gte('start_time', new Date().toISOString())
                    .order('start_time', { ascending: true })
                    .limit(30),

                // Get all active goals
                this.supabase.from('user_learning_goals')
                    .select('id, goal_text, progress, target_date')
                    .eq('user_id', userId)
                    .eq('is_completed', false)
                    .order('updated_at', { ascending: false })
                    .limit(20),

                // Get recent quizzes
                this.supabase.from('quizzes')
                    .select('id, title')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(20)
            ]);

            return {
                notes: notesResult.data || [],
                documents: documentsResult.data || [],
                folders: foldersResult.data || [],
                schedule: scheduleResult.data || [],
                goals: goalsResult.data || [],
                quizzes: quizzesResult.data || [],
                flashcards: []  // Can be added if needed
            };
        } catch (error) {
            console.error('[ContextService] Error getting actionable context:', error);
            return this.getFallbackActionableContext();
        }
    }
async analyzeLearningPatterns(userId) {
        const [quizPatterns, notePatterns, schedulePatterns, chatPatterns, recordingPatterns] = await Promise.all([
            this.supabase.from('quiz_attempts')
                .select('score, percentage, created_at, time_taken_seconds, quizzes(title, source_type)')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50),

            this.supabase.from('notes')
                .select('category, tags, created_at, title, content')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50),

            this.supabase.from('schedule_items')
                .select('subject, type, start_time, end_time')
                .eq('user_id', userId)
                .order('start_time', { ascending: false })
                .limit(50),

            this.supabase.from('chat_sessions')
                .select('title, context_summary, last_message_at, message_count')
                .eq('user_id', userId)
                .order('last_message_at', { ascending: false })
                .limit(20),

            this.supabase.from('class_recordings')
                .select('subject, duration, created_at, summary')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(20)
        ]);

        const patterns = {
            strongSubjects: new Map(),
            weakSubjects: new Map(),
            studyTimes: new Map(),
            preferredNoteCategories: new Map(),
            frequentTopics: new Map(),
            studyConsistency: this.calculateStudyConsistency(chatPatterns.data || []),
            averageStudyDuration: 0,
            preferredQuizTypes: new Map(),
            topTags: new Map(),
            recentTopics: []
        };

        // Analyze quiz performance by subject
        quizPatterns.data?.forEach((attempt) => {
            const subject = attempt.quizzes?.title || 'Unknown';
            const sourceType = attempt.quizzes?.source_type || 'unknown';

            if (attempt.percentage >= 80) {
                patterns.strongSubjects.set(subject, (patterns.strongSubjects.get(subject) || 0) + 1);
            } else if (attempt.percentage <= 60) {
                patterns.weakSubjects.set(subject, (patterns.weakSubjects.get(subject) || 0) + 1);
            }

            patterns.preferredQuizTypes.set(sourceType, (patterns.preferredQuizTypes.get(sourceType) || 0) + 1);
        });

        // Analyze note-taking patterns
        notePatterns.data?.forEach((note) => {
            if (note.category) {
                patterns.preferredNoteCategories.set(
                    note.category,
                    (patterns.preferredNoteCategories.get(note.category) || 0) + 1
                );
            }

            // Extract tags
            note.tags?.forEach((tag) => {
                patterns.topTags.set(tag, (patterns.topTags.get(tag) || 0) + 1);
            });

            // Extract topics from content (simple keyword extraction)
            if (note.content) {
                this.extractTopics(note.content).forEach((topic) => {
                    patterns.frequentTopics.set(topic, (patterns.frequentTopics.get(topic) || 0) + 1);
                });
            }
        });

        // Analyze study times from schedule
        let totalDuration = 0;
        let sessionCount = 0;

        schedulePatterns.data?.forEach((schedule) => {
            const hour = new Date(schedule.start_time).getHours();
            const timeSlot = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
            patterns.studyTimes.set(timeSlot, (patterns.studyTimes.get(timeSlot) || 0) + 1);

            // Calculate duration
            const duration = new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime();
            totalDuration += duration;
            sessionCount++;
        });

        patterns.averageStudyDuration = sessionCount > 0 ? Math.round(totalDuration / sessionCount / 60000) : 0; // in minutes

        // Extract recent topics from chat sessions
        chatPatterns.data?.forEach((session) => {
            if (session.context_summary) {
                const topics = this.extractTopics(session.context_summary);
                topics.forEach((topic) => {
                    patterns.frequentTopics.set(topic, (patterns.frequentTopics.get(topic) || 0) + 1);
                });

                // Add to recent topics
                if (patterns.recentTopics.length < 10) {
                    patterns.recentTopics.push({
                        source: 'chat',
                        content: session.title,
                        date: session.last_message_at
                    });
                }
            }
        });

        // Extract topics from recordings
        recordingPatterns.data?.forEach((recording) => {
            if (recording.summary) {
                this.extractTopics(recording.summary).forEach((topic) => {
                    patterns.frequentTopics.set(topic, (patterns.frequentTopics.get(topic) || 0) + 1);
                });
            }

            if (patterns.recentTopics.length < 10) {
                patterns.recentTopics.push({
                    source: 'recording',
                    content: recording.subject,
                    date: recording.created_at
                });
            }
        });

        return patterns;
    }

    async analyzeStudyHabits(userId) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const [chatActivity, quizActivity, noteActivity] = await Promise.all([
            this.supabase.from('chat_sessions')
                .select('last_message_at, message_count')
                .eq('user_id', userId)
                .gte('last_message_at', thirtyDaysAgo),

            this.supabase.from('quiz_attempts')
                .select('created_at, time_taken_seconds')
                .eq('user_id', userId)
                .gte('created_at', thirtyDaysAgo),

            this.supabase.from('notes')
                .select('created_at, updated_at')
                .eq('user_id', userId)
                .gte('updated_at', thirtyDaysAgo)
        ]);

        // Calculate activity by day of week
        const dayActivity = new Map();
        const hourActivity = new Map();

        [...(chatActivity.data || []), ...(quizActivity.data || []), ...(noteActivity.data || [])].forEach((activity) => {
            const date = new Date(activity.last_message_at || activity.created_at || activity.updated_at);
            const day = date.toLocaleDateString('en-US', { weekday: 'long' });
            const hour = date.getHours();

            dayActivity.set(day, (dayActivity.get(day) || 0) + 1);
            hourActivity.set(hour, (hourActivity.get(hour) || 0) + 1);
        });

        // Find peak activity times
        const peakDay = Array.from(dayActivity.entries()).sort((a, b) => b[1] - a[1])[0];
        const peakHour = Array.from(hourActivity.entries()).sort((a, b) => b[1] - a[1])[0];

        return {
            mostActiveDay: peakDay ? peakDay[0] : 'Not enough data',
            mostActiveHour: peakHour ? `${peakHour[0]}:00` : 'Not enough data',
            dayActivity,
            hourActivity,
            averageSessionsPerWeek: Math.round((chatActivity.data?.length || 0) / 4.3),
            averageQuizzesPerWeek: Math.round((quizActivity.data?.length || 0) / 4.3),
            averageNotesPerWeek: Math.round((noteActivity.data?.length || 0) / 4.3)
        };
    }

    async analyzeTopicMastery(userId) {
        const { data: quizData } = await this.supabase
            .from('quiz_attempts')
            .select(`
        percentage, created_at,
        quizzes(title)
      `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100);

        const topicScores = new Map();
        const topicProgress = new Map();

        quizData?.forEach((attempt, index) => {
            const subject = attempt.quizzes?.title || 'Unknown';

            if (!topicScores.has(subject)) {
                topicScores.set(subject, []);
            }

            topicScores.get(subject).push({
                score: attempt.percentage,
                date: attempt.created_at,
                recency: index
            });
        });

        // Calculate mastery level for each topic
        topicScores.forEach((scores, subject) => {
            const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
            const recentScores = scores.slice(0, 3);
            const recentAvg = recentScores.reduce((sum, s) => sum + s.score, 0) / recentScores.length;

            // Calculate trend (improving, stable, declining)
            const trend = recentAvg > avgScore ? 'improving' : recentAvg < avgScore ? 'declining' : 'stable';

            topicProgress.set(subject, {
                masteryLevel: avgScore >= 90 ? 'expert' : avgScore >= 75 ? 'advanced' : avgScore >= 60 ? 'intermediate' : 'beginner',
                averageScore: Math.round(avgScore),
                recentScore: Math.round(recentAvg),
                trend,
                attemptCount: scores.length
            });
        });

        return topicProgress;
    }

    extractTopics(text) {
        if (!text) return [];

        // Remove common words and extract meaningful terms
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 4 && !this.isCommonWord(word));

        // Count frequency
        const frequency = new Map();
        words.forEach(word => {
            frequency.set(word, (frequency.get(word) || 0) + 1);
        });

        // Return top topics
        return Array.from(frequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
    }

    calculateStudyConsistency(sessions) {
        if (sessions.length < 2) return 1.0;

        let consistencyScore = 0;
        let dayCount = 0;

        for (let i = 1; i < sessions.length; i++) {
            const currentDate = new Date(sessions[i].last_message_at);
            const previousDate = new Date(sessions[i - 1].last_message_at);
            const timeDiff = Math.abs(currentDate.getTime() - previousDate.getTime());
            const dayDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

            if (dayDiff <= 2) {
                consistencyScore += 1;
            }
            dayCount++;
        }

        return dayCount > 0 ? consistencyScore / dayCount : 1.0;
    }

    isCommonWord(word) {
        const commonWords = [
            'the', 'and', 'for', 'with', 'this', 'that', 'have', 'from', 'they',
            'what', 'when', 'where', 'which', 'who', 'will', 'would', 'could',
            'should', 'about', 'into', 'through', 'during', 'before', 'after',
            'above', 'below', 'between', 'their', 'there', 'these', 'those',
            'then', 'than', 'some', 'such', 'very', 'more', 'most', 'been',
            'being', 'just', 'like', 'only', 'also', 'can', 'may', 'must'
        ];
        return commonWords.includes(word);
    }

    getFallbackContext(userId) {
        return {
            profile: null,
            stats: null,
            allNotes: [],
            allDocuments: [],
            recentQuizzes: [],
            learningSchedule: [],
            learningGoals: [],
            userMemory: [],
            achievements: [],
            flashcards: [],
            socialProfile: null,
            recentRecordings: [],
            documentFolders: [],
            noteTitleIndex: new Map(),
            documentTitleIndex: new Map(),
            learningPatterns: {
                strongSubjects: new Map(),
                weakSubjects: new Map(),
                studyTimes: new Map(),
                preferredNoteCategories: new Map(),
                frequentTopics: new Map(),
                studyConsistency: 1.0,
                averageStudyDuration: 0,
                preferredQuizTypes: new Map(),
                topTags: new Map(),
                recentTopics: []
            },
            studyHabits: {
                mostActiveDay: 'Not enough data',
                mostActiveHour: 'Not enough data',
                dayActivity: new Map(),
                hourActivity: new Map(),
                averageSessionsPerWeek: 0,
                averageQuizzesPerWeek: 0,
                averageNotesPerWeek: 0
            },
            topicMastery: new Map(),
            totalCounts: {
                notes: 0,
                documents: 0,
                quizzes: 0,
                recordings: 0,
                flashcards: 0,
                folders: 0
            }
        };
    }

    async getCrossSessionContext(userId, currentSessionId, currentMessage) {
        try {
            // Look back 14 days for comprehensive context
            const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

            // Get up to 10 recent sessions for better continuity
            const { data: recentSessions } = await this.supabase
                .from('chat_sessions')
                .select('id, title, context_summary, last_message_at, message_count, document_ids')
                .eq('user_id', userId)
                .neq('id', currentSessionId)
                .gte('last_message_at', fourteenDaysAgo)
                .order('last_message_at', { ascending: false })
                .limit(10);

            if (!recentSessions?.length) return null;

            const crossSessionContext = [];

            for (const session of recentSessions) {
                const sessionContext = {
                    sessionTitle: session.title,
                    lastActive: session.last_message_at,
                    messageCount: session.message_count,
                    documentIds: session.document_ids,
                    summary: null,
                    recentTopics: [],
                    keyMessages: []
                };

                // Use summary if available
                if (session.context_summary) {
                    sessionContext.summary = session.context_summary;
                }

                // Get key messages from past sessions for better understanding
                const { data: keyMessages } = await this.supabase
                    .from('chat_messages')
                    .select('content, role, timestamp, attached_document_ids, attached_note_ids')
                    .eq('user_id', userId)
                    .eq('session_id', session.id)
                    .eq('role', 'user')
                    .order('timestamp', { ascending: false })
                    .limit(3);  // Get top 3 messages for context

                if (keyMessages?.length) {
                    sessionContext.keyMessages = keyMessages.map((m) => ({
                        content: m.content.length > 150 ? m.content.substring(0, 150) + '...' : m.content,
                        timestamp: m.timestamp,
                        hasAttachments: (m.attached_document_ids?.length || 0) + (m.attached_note_ids?.length || 0) > 0
                    }));
                }

                crossSessionContext.push(sessionContext);
            }

            return crossSessionContext;
        } catch (error) {
            console.error('Error getting cross-session context:', error);
            return null;
        }
    }

    async updateUserMemory(userId, facts) {
        try {
            for (const fact of facts) {
                const { data: existing } = await this.supabase
                    .from('ai_user_memory')
                    .select('id, confidence_score, referenced_count')
                    .eq('user_id', userId)
                    .eq('fact_type', fact.fact_type)
                    .eq('fact_key', fact.fact_key)
                    .eq('fact_value', fact.fact_value)
                    .maybeSingle();

                if (existing) {
                    await this.supabase
                        .from('ai_user_memory')
                        .update({
                            confidence_score: Math.min(1.0, existing.confidence_score + 0.1),
                            last_referenced: new Date().toISOString(),
                            referenced_count: (existing.referenced_count || 0) + 1
                        })
                        .eq('id', existing.id);
                } else {
                    await this.supabase
                        .from('ai_user_memory')
                        .insert({
                            user_id: userId,
                            fact_type: fact.fact_type,
                            fact_key: fact.fact_key,
                            fact_value: fact.fact_value,
                            confidence_score: fact.confidence_score || 0.7,
                            source_session_id: fact.source_session_id,
                            last_referenced: new Date().toISOString(),
                            referenced_count: 1
                        });
                }
            }
        } catch (error) {
            console.error('Error updating user memory:', error);
        }
    }

    async recordTopicConnection(userId, fromSessionId, toSessionId, topic, strength = 0.8) {
        try {
            await this.supabase
                .from('learning_topic_connections')
                .insert({
                    user_id: userId,
                    from_session_id: fromSessionId,
                    to_session_id: toSessionId,
                    topic: topic.toLowerCase(),
                    connection_strength: strength
                });
        } catch (error) {
            console.error('Error recording topic connection:', error);
        }
    }

    // Smart search function to find notes/documents by partial title match
    searchUserContent(userContext, searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        const results = {
            notes: [],
            documents: [],
            exactMatches: {
                notes: [],
                documents: []
            }
        };

        // Search notes
        userContext.allNotes?.forEach(note => {
            const titleLower = note.title.toLowerCase();
            if (titleLower === query) {
                results.exactMatches.notes.push(note);
            } else if (titleLower.includes(query) || query.includes(titleLower)) {
                results.notes.push(note);
            }
        });

        // Search documents
        userContext.allDocuments?.forEach(doc => {
            const titleLower = doc.title.toLowerCase();
            const fileNameLower = doc.file_name.toLowerCase();

            if (titleLower === query || fileNameLower === query) {
                results.exactMatches.documents.push(doc);
            } else if (titleLower.includes(query) || fileNameLower.includes(query) ||
                query.includes(titleLower)) {
                results.documents.push(doc);
            }
        });

        // Sort by relevance (most recent first within each category)
        results.notes.sort((a, b) => b.updated_at - a.updated_at);
        results.documents.sort((a, b) => b.updated_at - a.updated_at);

        return results;
    }

    // Get content statistics for better context
    getContentStatistics(userContext) {
        const stats = {
            notesByCategory: new Map(),
            documentsByType: new Map(),
            totalSize: 0,
            recentActivity: {
                lastNoteDate: null,
                lastDocumentDate: null,
                lastQuizDate: null
            }
        };

        // Analyze notes
        userContext.allNotes?.forEach(note => {
            stats.notesByCategory.set(
                note.category,
                (stats.notesByCategory.get(note.category) || 0) + 1
            );

            if (!stats.recentActivity.lastNoteDate ||
                new Date(note.updated_at) > new Date(stats.recentActivity.lastNoteDate)) {
                stats.recentActivity.lastNoteDate = note.updated_at;
            }
        });

        // Analyze documents
        userContext.allDocuments?.forEach(doc => {
            stats.documentsByType.set(
                doc.file_type,
                (stats.documentsByType.get(doc.file_type) || 0) + 1
            );

            if (doc.file_size) {
                stats.totalSize += doc.file_size;
            }

            if (!stats.recentActivity.lastDocumentDate ||
                new Date(doc.updated_at) > new Date(stats.recentActivity.lastDocumentDate)) {
                stats.recentActivity.lastDocumentDate = doc.updated_at;
            }
        });

        // Last quiz
        if (userContext.recentQuizzes?.length > 0) {
            stats.recentActivity.lastQuizDate = userContext.recentQuizzes[0].created_at;
        }

        return stats;
    }
// In context-service.ts, add this method to the UserContextService class:

async getUserContext(userId: string): Promise<any> {
    try {
        // Get basic user profile and stats
        const { data: profile } = await this.supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        const { data: stats } = await this.supabase
            .from('user_stats')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        // Get other context data using existing methods
        const [
            allNotes,
            allDocuments,
            learningSchedule,
            learningGoals,
            userMemory,
            achievements,
            flashcards,
            socialProfile,
            recentRecordings,
            documentFolders,
            recentQuizzes
        ] = await Promise.all([
            // Notes
            this.supabase.from('notes')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false })
                .limit(50),
            
            // Documents
            this.supabase.from('documents')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false })
                .limit(50),
            
            // Schedule items (next 7 days)
            this.supabase.from('schedule_items')
                .select('*')
                .eq('user_id', userId)
                .gte('start_time', new Date().toISOString())
                .lte('start_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
                .order('start_time', { ascending: true })
                .limit(20),
            
            // Learning goals
            this.supabase.from('user_learning_goals')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false })
                .limit(20),
            
            // User memory
            this.supabase.from('ai_user_memory')
                .select('*')
                .eq('user_id', userId)
                .order('last_referenced', { ascending: false })
                .limit(50),
            
            // Achievements
            this.supabase.from('achievements')
                .select('*, badges(*)')
                .eq('user_id', userId)
                .order('earned_at', { ascending: false })
                .limit(20),
            
            // Flashcards
            this.supabase.from('flashcards')
                .select('*')
                .eq('user_id', userId)
                .order('next_review_at', { ascending: true })
                .limit(30),
            
            // Social profile
            this.supabase.from('social_users')
                .select('*')
                .eq('id', userId)
                .maybeSingle(),
            
            // Recent recordings
            this.supabase.from('class_recordings')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10),
            
            // Document folders
            this.supabase.from('document_folders')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false }),
            
            // Recent quizzes
            this.supabase.from('quiz_attempts')
                .select('*, quizzes(*)')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10)
        ]);

        // Analyze learning patterns
        const learningPatterns = await this.analyzeLearningPatterns(userId);
        const studyHabits = await this.analyzeStudyHabits(userId);
        const topicMastery = await this.analyzeTopicMastery(userId);

        // Build title indexes for quick lookup
        const noteTitleIndex = new Map();
        const documentTitleIndex = new Map();
        
        allNotes.data?.forEach(note => {
            noteTitleIndex.set(note.title.toLowerCase(), note);
        });
        
        allDocuments.data?.forEach(doc => {
            documentTitleIndex.set(doc.title.toLowerCase(), doc);
        });

        // Calculate total counts
        const totalCounts = {
            notes: allNotes.data?.length || 0,
            documents: allDocuments.data?.length || 0,
            quizzes: recentQuizzes.data?.length || 0,
            recordings: recentRecordings.data?.length || 0,
            flashcards: flashcards.data?.length || 0,
            folders: documentFolders.data?.length || 0
        };

        return {
            profile: profile || null,
            stats: stats || null,
            allNotes: allNotes.data || [],
            allDocuments: allDocuments.data || [],
            recentQuizzes: recentQuizzes.data || [],
            learningSchedule: learningSchedule.data || [],
            learningGoals: learningGoals.data || [],
            userMemory: userMemory.data || [],
            achievements: achievements.data || [],
            flashcards: flashcards.data || [],
            socialProfile: socialProfile.data || null,
            recentRecordings: recentRecordings.data || [],
            documentFolders: documentFolders.data || [],
            noteTitleIndex,
            documentTitleIndex,
            learningPatterns,
            studyHabits,
            topicMastery,
            totalCounts
        };
    } catch (error) {
        console.error('[ContextService] Error getting user context:', error);
        return this.getFallbackContext(userId);
    }
}
 getFallbackActionableContext() {
        return {
            notes: [],
            documents: [],
            folders: [],
            schedule: [],
            goals: [],
            quizzes: [],
            flashcards: []
        };
    }
}