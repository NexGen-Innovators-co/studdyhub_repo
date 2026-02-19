// src/components/quizzes/hooks/useQuizTracking.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { toast } from 'sonner';
import { QuizAttempt, UserStats, Achievement, Badge } from '../../../types/EnhancedClasses';
import { trackCourseResourceCompletion } from '../../../services/courseProgressService';

export const useQuizTracking = (userId: string) => {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [recentAchievements, setRecentAchievements] = useState<Achievement[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [bestAttempts, setBestAttempts] = useState<Record<string, QuizAttempt>>({});

  // Calculate XP based on performance
  const calculateXP = (score: number, totalQuestions: number, timeTaken: number): number => {
    const baseXP = 10;
    const scoreMultiplier = score / totalQuestions;
    const timeBonus = timeTaken < 300 ? 5 : 0; // Bonus for completing under 5 minutes
    const perfectBonus = score === totalQuestions ? 20 : 0;

    return Math.floor(baseXP * totalQuestions * scoreMultiplier + timeBonus + perfectBonus);
  };

  // Calculate level from XP
  const calculateLevel = (xp: number): number => {
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  };

  // Fetch user stats
  const fetchUserStats = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoadingStats(true);

      // Fetch stats
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setUserStats(data);
      } else {
        // Create initial stats
        const initialStats = {
          user_id: userId,
          total_xp: 0,
          level: 1,
          current_streak: 0,
          longest_streak: 0,
          total_quizzes_attempted: 0,
          total_quizzes_completed: 0,
          average_score: 0,
          total_study_time_seconds: 0,
          badges_earned: [],
          last_activity_date: new Date().toISOString(),
        };

        const { data: newStats, error: insertError } = await supabase
          .from('user_stats')
          .insert(initialStats)
          .select()
          .single();

        if (insertError) throw insertError;
        setUserStats(newStats);
      }

      // Fetch best attempts for each quiz
      const { data: attempts, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', userId);

      if (!attemptsError && attempts) {
        const best: Record<string, QuizAttempt> = {};
        attempts.forEach(attempt => {
          if (!best[attempt.quiz_id] || attempt.percentage > best[attempt.quiz_id].percentage) {
            best[attempt.quiz_id] = attempt;
          }
        });
        setBestAttempts(best);
      }
    } catch (error) {
      toast.error('Failed to load user statistics');
    } finally {
      setIsLoadingStats(false);
    }
  }, [userId]);

  // Record quiz attempt
  const recordQuizAttempt = async (
    quizId: string,
    score: number,
    totalQuestions: number,
    answers: QuizAttempt['answers'],
    timeTaken: number,
    isExamMode: boolean = false
  ): Promise<QuizAttempt | null> => {
    if (!userId) return null;

    try {
      const percentage = Math.round((score / totalQuestions) * 100);
      
      // Check if this is a retake and if we should award XP
      const existingBest = bestAttempts[quizId];
      const isNewBest = !existingBest || percentage > existingBest.percentage;
      
      // Only award XP if it's the first attempt or a new high score
      // Apply 1.5x multiplier for exam mode
      let xpEarned = isNewBest ? calculateXP(score, totalQuestions, timeTaken) : 0;
      if (isExamMode && xpEarned > 0) {
        xpEarned = Math.floor(xpEarned * 1.5);
      }

      const attempt = {
        quiz_id: quizId,
        user_id: userId,
        score,
        total_questions: totalQuestions,
        percentage,
        time_taken_seconds: timeTaken,
        answers,
        xp_earned: xpEarned,
      };

      const { data, error } = await supabase
        .from('quiz_attempts')
        .insert(attempt)
        .select()
        .single();

      if (error) throw error;

      // Update user stats
      if (xpEarned > 0) {
        await updateUserStats(xpEarned, percentage, timeTaken, score === totalQuestions);
        toast.success(`Quiz completed! +${xpEarned} XP earned! 🎉`);
      } else {
        // Still update streak and last activity even if no XP earned
        await updateUserStats(0, percentage, timeTaken, score === totalQuestions);
        toast.success(`Quiz completed! (No new XP for retake)`);
      }

      // Check for new achievements
      await checkAchievements();

      // Refresh best attempts
      await fetchUserStats();

      // Track course progress (fire-and-forget)
      trackCourseResourceCompletion(userId, 'quiz', quizId, { score: percentage });

      return data;
    } catch (error) {

      toast.error('Failed to save quiz results');
      return null;
    }
  };

  // Update user stats after quiz
  const updateUserStats = async (
    xpEarned: number,
    percentage: number,
    timeTaken: number,
    isPerfect: boolean
  ) => {
    if (!userStats) return;

    const newTotalXP = userStats.total_xp + xpEarned;
    const newLevel = calculateLevel(newTotalXP);
    const leveledUp = newLevel > userStats.level;

    const today = new Date().toISOString().split('T')[0];
    const lastActivityDate = userStats.last_activity_date?.split('T')[0];

    let newStreak = userStats.current_streak;
    if (lastActivityDate) {
      const daysDiff = Math.floor(
        (new Date(today).getTime() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 0) {
        // Same day, keep streak
      } else if (daysDiff === 1) {
        // Next day, increment streak
        newStreak += 1;
      } else {
        // Streak broken
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    const newLongestStreak = Math.max(userStats.longest_streak, newStreak);
    const totalQuizzes = userStats.total_quizzes_completed + 1;
    const newAverageScore = (
      (userStats.average_score * userStats.total_quizzes_completed + percentage) / totalQuizzes
    );

    const updates = {
      total_xp: newTotalXP,
      level: newLevel,
      current_streak: newStreak,
      longest_streak: newLongestStreak,
      total_quizzes_attempted: userStats.total_quizzes_attempted + 1,
      total_quizzes_completed: totalQuizzes,
      average_score: newAverageScore,
      total_study_time_seconds: userStats.total_study_time_seconds + timeTaken,
      last_activity_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_stats')
      .update(updates)
      .eq('user_id', userId);

    if (error) throw error;

    setUserStats({ ...userStats, ...updates });

    if (leveledUp) {
      toast.success(`🎉 Level Up! You're now level ${newLevel}!`, {
        duration: 5000,
      });
    }

    if (isPerfect) {
      toast.success('🌟 Perfect Score! Incredible work!', {
        duration: 4000,
      });
    }
  };

  // Check for new achievements
  const checkAchievements = async () => {
    if (!userStats) return;

    try {
      // Fetch all badges
      const { data: badges, error: badgesError } = await supabase
        .from('badges')
        .select('*');

      if (badgesError) throw badgesError;

      // Fetch user's existing achievements
      const { data: existingAchievements, error: achievementsError } = await supabase
        .from('achievements')
        .select('badge_id')
        .eq('user_id', userId);

      if (achievementsError) throw achievementsError;

      const earnedBadgeIds = new Set(existingAchievements?.map(a => a.badge_id) || []);
      const newAchievements: Achievement[] = [];

      // Check each badge requirement
      for (const badge of badges || []) {
        if (earnedBadgeIds.has(badge.id)) continue;

        let earned = false;

        switch (badge.requirement_type) {
          case 'quiz_count':
            earned = userStats.total_quizzes_completed >= badge.requirement_value;
            break;
          case 'streak':
            earned = userStats.current_streak >= badge.requirement_value;
            break;
          case 'xp':
            earned = userStats.total_xp >= badge.requirement_value;
            break;
          case 'score':
            earned = userStats.average_score >= badge.requirement_value;
            break;
          case 'perfect_score':
            // Check recent perfect scores
            const { data: attempts } = await supabase
              .from('quiz_attempts')
              .select('percentage')
              .eq('user_id', userId)
              .eq('percentage', 100)
              .limit(badge.requirement_value);
            earned = (attempts?.length || 0) >= badge.requirement_value;
            break;
        }

        if (earned) {
          const { data: achievement, error: insertError } = await supabase
            .from('achievements')
            .insert({
              user_id: userId,
              badge_id: badge.id,
            })
            .select('*, badge:badges(*)')
            .single();

          if (!insertError && achievement) {
            newAchievements.push(achievement);

            // Award badge XP
            await supabase
              .from('user_stats')
              .update({
                total_xp: userStats.total_xp + badge.xp_reward,
                badges_earned: [...userStats.badges_earned, badge.id],
              })
              .eq('user_id', userId);

            toast.success(`🏆 New Badge Unlocked: ${badge.name}! +${badge.xp_reward} XP`, {
              duration: 6000,
            });
          }
        }
      }

      if (newAchievements.length > 0) {
        setRecentAchievements(newAchievements);
        await fetchUserStats();
      }
    } catch (error) {

    }
  };

  // Get quiz history with attempts
  const getQuizHistory = async (limit = 10, offset = 0) => {
    try {
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select(`
          *,
          quiz:quizzes(id, title, class_id)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data;
    } catch (error) {

      return [];
    }
  };

  useEffect(() => {
    if (userId) {
      fetchUserStats();
    }
  }, [userId, fetchUserStats]);

  return {
    userStats,
    recentAchievements,
    isLoadingStats,
    bestAttempts,
    recordQuizAttempt,
    fetchUserStats,
    getQuizHistory,
    calculateLevel,
  };
};
