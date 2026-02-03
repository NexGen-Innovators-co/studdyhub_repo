import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export class UserContextService {
  private supabase;
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async getUserContext(userId: string) {
    try {
      const [
        profileResult,
        statsResult,
        recentNotesResult,
        recentDocumentsResult,
        recentQuizzesResult,
        learningScheduleResult,
        learningGoalsResult,
        userMemoryResult
      ] = await Promise.all([
        this.supabase.from('profiles').select('*').eq('id', userId).single(),
        this.supabase.from('user_stats').select('*').eq('user_id', userId).single(),
        this.supabase.from('notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(5),
        this.supabase.from('documents').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(5),
        this.supabase.from('quiz_attempts').select('*, quizzes(title, subject)').eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
        this.supabase.from('schedule_items').select('*').eq('user_id', userId).gte('start_time', new Date().toISOString()).order('start_time', { ascending: true }).limit(3),
        this.supabase.from('user_learning_goals').select('*').eq('user_id', userId).eq('is_completed', false).order('created_at', { ascending: false }).limit(3),
        this.supabase.from('ai_user_memory').select('*').eq('user_id', userId).order('last_referenced', { ascending: false }).limit(10)
      ]);

      const learningPatterns = await this.analyzeLearningPatterns(userId);

      return {
        profile: profileResult.data,
        stats: statsResult.data,
        recentNotes: recentNotesResult.data,
        recentDocuments: recentDocumentsResult.data,
        recentQuizzes: recentQuizzesResult.data,
        learningSchedule: learningScheduleResult.data,
        learningGoals: learningGoalsResult.data,
        userMemory: userMemoryResult.data,
        learningPatterns
      };
    } catch (error) {
      // console.error('Error getting user context:', error);
      return this.getFallbackContext(userId);
    }
  }

  async analyzeLearningPatterns(userId: string) {
    const [
      quizPatterns,
      notePatterns,
      schedulePatterns,
      chatPatterns
    ] = await Promise.all([
      this.supabase
        .from('quiz_attempts')
        .select('score, percentage, created_at, quizzes(subject)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      this.supabase
        .from('notes')
        .select('category, tags, created_at, title')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30),
      this.supabase
        .from('schedule_items')
        .select('subject, type, start_time')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .limit(20),
      this.supabase
        .from('chat_sessions')
        .select('title, context_summary, last_message_at')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false })
        .limit(10)
    ]);

    const patterns = {
      strongSubjects: new Map(),
      weakSubjects: new Map(),
      studyTimes: new Map(),
      preferredNoteCategories: new Map(),
      frequentTopics: new Map(),
      studyConsistency: this.calculateStudyConsistency(chatPatterns.data || [])
    };

    // Analyze quiz patterns
    quizPatterns.data?.forEach(attempt => {
      const subject = attempt.quizzes?.subject || 'Unknown';
      if (attempt.percentage >= 80) {
        patterns.strongSubjects.set(subject, (patterns.strongSubjects.get(subject) || 0) + 1);
      } else if (attempt.percentage <= 60) {
        patterns.weakSubjects.set(subject, (patterns.weakSubjects.get(subject) || 0) + 1);
      }
    });

    // Analyze note categories
    notePatterns.data?.forEach(note => {
      if (note.category) {
        patterns.preferredNoteCategories.set(note.category, (patterns.preferredNoteCategories.get(note.category) || 0) + 1);
      }
    });

    // Analyze study times
    schedulePatterns.data?.forEach(schedule => {
      const hour = new Date(schedule.start_time).getHours();
      const timeSlot = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      patterns.studyTimes.set(timeSlot, (patterns.studyTimes.get(timeSlot) || 0) + 1);
    });

    // Analyze frequent topics from chat sessions
    chatPatterns.data?.forEach(session => {
      if (session.context_summary) {
        const words = session.context_summary.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 4 && !this.isCommonWord(word)) {
            patterns.frequentTopics.set(word, (patterns.frequentTopics.get(word) || 0) + 1);
          }
        });
      }
    });

    return patterns;
  }

  private calculateStudyConsistency(sessions: any[]): number {
    if (sessions.length < 2) return 1.0;
    
    let consistencyScore = 0;
    let dayCount = 0;
    
    for (let i = 1; i < sessions.length; i++) {
      const currentDate = new Date(sessions[i].last_message_at);
      const previousDate = new Date(sessions[i-1].last_message_at);
      const dayDiff = Math.abs(currentDate.getDate() - previousDate.getDate());
      
      if (dayDiff <= 2) { // Sessions within 2 days
        consistencyScore += 1;
      }
      dayCount++;
    }
    
    return dayCount > 0 ? consistencyScore / dayCount : 1.0;
  }

  private isCommonWord(word: string): boolean {
    const commonWords = ['the', 'and', 'for', 'with', 'this', 'that', 'have', 'from', 'they', 'what'];
    return commonWords.includes(word);
  }

  private getFallbackContext(userId: string) {
    return {
      profile: null,
      stats: null,
      recentNotes: [],
      recentDocuments: [],
      recentQuizzes: [],
      learningSchedule: [],
      learningGoals: [],
      userMemory: [],
      learningPatterns: {
        strongSubjects: new Map(),
        weakSubjects: new Map(),
        studyTimes: new Map(),
        preferredNoteCategories: new Map(),
        frequentTopics: new Map(),
        studyConsistency: 1.0
      }
    };
  }

  async getCrossSessionContext(userId: string, currentSessionId: string, currentMessage: string) {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: recentSessions } = await this.supabase
        .from('chat_sessions')
        .select('id, title, context_summary, last_message_at, message_count')
        .eq('user_id', userId)
        .neq('id', currentSessionId)
        .gte('last_message_at', sevenDaysAgo)
        .order('last_message_at', { ascending: false })
        .limit(4);

      if (!recentSessions?.length) return null;

      const crossSessionContext = [];
      
      for (const session of recentSessions) {
        const sessionContext: any = {
          sessionTitle: session.title,
          lastActive: session.last_message_at,
          messageCount: session.message_count
        };

        if (session.context_summary) {
          sessionContext.summary = session.context_summary;
        }
        
        // Get key messages from other sessions
        const { data: keyMessages } = await this.supabase
          .from('chat_messages')
          .select('content, role, timestamp')
          .eq('user_id', userId)
          .eq('session_id', session.id)
          .eq('role', 'user')
          .order('timestamp', { ascending: false })
          .limit(3);
          
        if (keyMessages?.length) {
          sessionContext.recentTopics = keyMessages.map(m => ({
            content: m.content.length > 80 ? m.content.substring(0, 80) + '...' : m.content,
            timestamp: m.timestamp
          }));
        }

        crossSessionContext.push(sessionContext);
      }

      return crossSessionContext;
    } catch (error) {
      // console.error('Error getting cross-session context:', error);
      return null;
    }
  }

  async updateUserMemory(userId: string, facts: Array<{
    fact_type: string;
    fact_key: string;
    fact_value: any;
    confidence_score?: number;
    source_session_id?: string;
  }>) {
    try {
      for (const fact of facts) {
        // Check if fact already exists
        const { data: existing } = await this.supabase
          .from('ai_user_memory')
          .select('id, confidence_score, referenced_count')
          .eq('user_id', userId)
          .eq('fact_type', fact.fact_type)
          .eq('fact_key', fact.fact_key)
          .single();

        if (existing) {
          // Update existing fact with higher confidence
          await this.supabase
            .from('ai_user_memory')
            .update({
              fact_value: fact.fact_value,
              confidence_score: Math.max(existing.confidence_score, fact.confidence_score || 1.0),
              last_referenced: new Date().toISOString(),
              referenced_count: (existing.referenced_count || 0) + 1
            })
            .eq('id', existing.id);
        } else {
          // Insert new fact
          await this.supabase
            .from('ai_user_memory')
            .insert({
              user_id: userId,
              fact_type: fact.fact_type,
              fact_key: fact.fact_key,
              fact_value: fact.fact_value,
              confidence_score: fact.confidence_score || 1.0,
              source_session_id: fact.source_session_id,
              last_referenced: new Date().toISOString(),
              referenced_count: 1
            });
        }
      }
    } catch (error) {
      // console.error('Error updating user memory:', error);
    }
  }

  async recordTopicConnection(userId: string, fromSessionId: string, toSessionId: string, topic: string, strength: number = 0.8) {
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
      // console.error('Error recording topic connection:', error);
    }
  }
}
