// Supabase Edge Function: daily-notifications-engine
// Schedule: Daily at 6 AM UTC (configurable in config.toml)
// Purpose: Generate and send personalized daily engagement notifications

import { serve } from 'https://deno.land/std@0.195.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { logSystemError } from '../_shared/errorLogger.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface UserContext {
  user_id: string;
  email: string;
  timezone: string;
  engagement_tier: 'cold' | 'warm' | 'active' | 'very_active';
  last_active: string;
  chat_sessions_count: number;
  quiz_attempts_count: number;
  posts_count: number;
  group_interactions_count: number;
  notes_count: number;
  documents_count: number;
  quiz_streak: number;
  fullName: string;
}

interface NotificationPayload {
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  action_url: string;
  category: number;
}

interface NotificationLogEntry {
  user_id: string;
  notification_type: string;
  category: number;
  scheduled_send_at: string;
  opened_by_user: boolean;
  opened_at: string | null;
  deep_link_clicked: boolean;
  deep_link_clicked_at: string | null;
  action_taken: boolean;
  action_taken_at: string | null;
  personalization_data: Record<string, any>;
  message_template: string;
  deep_link_url: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: Calculate when notification should be sent (user's preferred time, in user's timezone, converted to UTC)
function calculateScheduledSendTime(timezone: string, preferredTime: string): string {
  try {
    // Parse preferred time (e.g., "14:30")
    const [prefHour, prefMin] = preferredTime.split(':').map(Number);
    
    // Create a date object for tomorrow at preferred time in user's timezone
    // Then convert back to UTC for storage
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Create formatter for target timezone to get the offset
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    // Get a reference point to calculate timezone offset
    const Parts = formatter.formatToParts(tomorrow);
    const tzDate = {
      year: parseInt(Parts.find(p => p.type === 'year')?.value || '2026'),
      month: parseInt(Parts.find(p => p.type === 'month')?.value || '01'),
      day: parseInt(Parts.find(p => p.type === 'day')?.value || '01'),
      hour: parseInt(Parts.find(p => p.type === 'hour')?.value || '0'),
      minute: parseInt(Parts.find(p => p.type === 'minute')?.value || '0'),
    };
    
    // Create UTC date for same moment
    const utcDate = new Date(tomorrow.toISOString());
    const utcYear = utcDate.getUTCFullYear();
    const utcMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
    const utcDay = String(utcDate.getUTCDate()).padStart(2, '0');
    const utcHour = String(utcDate.getUTCHours()).padStart(2, '0');
    const utcMin = String(utcDate.getUTCMinutes()).padStart(2, '0');
    
    // Calculate offset in minutes
    const tzTime = tzDate.hour * 60 + tzDate.minute;
    const utcTime = parseInt(utcHour) * 60 + parseInt(utcMin);
    const offsetMinutes = tzTime - utcTime;
    
    // Now create target datetime in user's timezone, then convert to UTC
    const targetInTz = new Date(`${tzDate.year}-${String(tzDate.month).padStart(2, '0')}-${String(tzDate.day).padStart(2, '0')}T${String(prefHour).padStart(2, '0')}:${String(prefMin).padStart(2, '0')}:00`);
    
    // Subtract the offset to get UTC time
    const utcScheduledTime = new Date(targetInTz.getTime() - offsetMinutes * 60 * 1000);
    
    return utcScheduledTime.toISOString();
  } catch (err) {
    console.error(`Error calculating scheduled time for ${timezone}/${preferredTime}:`, err);
    return new Date().toISOString(); // Fallback to now
  }
}

// Category 1: Study Planning Notification
function buildStudyPlanningNotification(user: UserContext): NotificationPayload | null {
  // Only send if user has active chat sessions
  if (user.chat_sessions_count === 0) return null;
  
  const messages = [
    `Good morning, ${user.fullName}! What are your top study goals for today? Your AI assistant is ready to help plan. ✨`,
    `Start your day strong! Your AI has personalized study tips based on your recent learning. Let's plan today's session.`,
    `Ready to conquer your studies? Your AI assistant is ready to help you design the perfect learning session. 🎯`,
    `New day, new study wins! Tell your AI what you want to accomplish and let it create a path. 🛤️`,
    `Let's make today count! Your AI study coach is queued and ready—what's first on your list? 📚`,
    `Planning wins: set one clear study goal and the AI will keep you on track all day. Ready? ✅`,
    `Kick off the day with a short study plan. Your AI can take it from here—just say the topic. 🧠`,
    `Think of one thing you want to learn today. We'll help turn it into a quick, focused session. 🔥`,
    `The fastest way to progress? A simple plan. Ask your AI to build one in seconds. 🚀`,
    `Today is a great day to learn something new. Tell your AI what you want to master first. 🎓`,
  ];
  
  const msg = messages[Math.floor(Math.random() * messages.length)];
  
  return {
    user_id: user.user_id,
    type: 'daily_study_planning',
    title: '📚 Daily Study Plan',
    message: msg,
    data: { category: 1, engagement_tier: user.engagement_tier },
    action_url: '/chat?context=daily-planning&source=notification',
    category: 1,
  };
}

// Category 2: Quiz Challenge Notification
function buildQuizChallengeNotification(user: UserContext): NotificationPayload | null {
  // Send if user has notes/documents but few quizzes, OR to 30% of active users randomly
  const hasContent = user.notes_count > 0 || user.documents_count > 0;
  const lowQuizActivity = user.quiz_attempts_count < 5;
  
  if (!hasContent || (user.engagement_tier === 'cold' && Math.random() > 0.3)) {
    return null;
  }
  
  const genreStreak = user.quiz_streak > 0 ? `You're on a ${user.quiz_streak}-day streak!` : 'Start a streak today!';
  
  const messages = [
    `🧠 Quick brain exercise! Take a 2-minute quiz based on your recent notes. Can you get a perfect score? ${genreStreak}`,
    `Test your knowledge! You studied recently—let's see what stuck. Quiz time? 📝`,
    `Your brain could use a challenge! Take a quick quiz on what you've been learning. 🔥`,
    `Want to keep your study streak alive? Try a quiz now and watch your progress grow! 📈`,
    `A quick quiz is the best way to lock in what you learned today. Ready when you are. 💡`,
    `See how much you remember from your latest notes. Quick quiz—just a few minutes! ⏱️`,
    `Let's turn your notes into a mini-quiz. It's fast, fun, and boosts retention. 🎯`,
    `Curious what you retained? Take a short quiz and find out—no pressure, all progress. ✅`,
    `Your brain is ready. Take a quiz now and celebrate the learning you already did. 🧠`,
    `Small quizzes are huge wins. Try one now and keep the streak going! 🕹️`,
  ];
  
  const msg = messages[Math.floor(Math.random() * messages.length)];
  
  return {
    user_id: user.user_id,
    type: 'daily_quiz_challenge',
    title: '🧠 Quiz Challenge',
    message: msg,
    data: { 
      category: 2, 
      engagement_tier: user.engagement_tier,
      quiz_streak: user.quiz_streak 
    },
    action_url: '/quizzes?auto-generate=true&source=daily-notification',
    category: 2,
  };
}

// Category 3: Study Group Nudge (only send if there's actual activity)
function buildGroupNudgeNotification(user: UserContext, recentGroupActivity: boolean): NotificationPayload | null {
  // Only send if there's actual recent group activity
  if (!recentGroupActivity || user.engagement_tier === 'cold') {
    return null;
  }
  
  const messages = [
    `💬 New activity in your study group! Someone asked a question. Help them out and strengthen your own knowledge!`,
    `Your study group is discussing something interesting. Join the conversation and share your thoughts! 🤝`,
    `Question of the Day in your group! Only a few people answered—what's your take? 💡`,
    `Someone just posted in your group — your perspective could spark the best answer. Jump in! 🚀`,
    `A peer just tagged you in a discussion. Add your insight and keep the momentum going. 💬`,
    `Your group is buzzing—share your view and help others learn too. Collaboration wins! 🤓`,
    `A group member asked for help. Your next message could be the one that clicks. ✨`,
    `Get involved in your study group today. A quick reply can make a big difference. 💡`,
    `Group work pays off. See what your teammates are sharing and join the conversation. 👥`,
    `Your study group is active right now—hop in and contribute while it's hot! 🔥`,
  ];
  
  const msg = messages[Math.floor(Math.random() * messages.length)];
  
  return {
    user_id: user.user_id,
    type: 'daily_group_nudge',
    title: '💬 Study Group Activity',
    message: msg,
    data: { category: 3, engagement_tier: user.engagement_tier },
    action_url: '/social/groups?sort=activity&source=notification',
    category: 3,
  };
}

// Category 4: Podcast Discovery
function buildPodcastDiscoveryNotification(user: UserContext): NotificationPayload | null {
  const messages = [
    `🎧 Your daily bite of knowledge! We curated an AI podcast on a topic you've been learning about. 10-min listen?`,
    `Discover something new! A short AI podcast on your recent interests. Perfect for a study break. 🎙️`,
    `New audio content ready! Listen to an AI podcast while you take a break from notes. 🎵`,
    `Need a mental reset? Try a quick podcast episode tailored to what you're studying. 🧠`,
    `A new podcast episode is waiting for you—perfect for a walk or a short break. 🎧`,
    `Listen while you commute: a curated podcast to help reinforce what you've learned. 🚗`,
    `Boost retention with a quick audio summary. Tap to play and keep learning on the go. 📱`,
    `Turn a coffee break into a study boost—this podcast is only a few minutes long. ☕`,
    `Fresh podcast drop! It’s tuned to your learning goals. Give it a listen today. 🔊`,
    `A short, focused podcast can make a big difference. Press play and keep the momentum. 🎶`,
  ];
  
  const msg = messages[Math.floor(Math.random() * messages.length)];
  
  return {
    user_id: user.user_id,
    type: 'daily_podcast_discovery',
    title: '🎧 Podcast Discovery',
    message: msg,
    data: { category: 4, engagement_tier: user.engagement_tier },
    action_url: '/podcasts?sort=recommended&source=notification',
    category: 4,
  };
}

// Category 5: Progress Tracking & Re-engagement
function buildProgressTrackingNotification(user: UserContext): NotificationPayload | null {
  // Different messages based on engagement tier
  if (user.engagement_tier === 'very_active' || user.engagement_tier === 'active') {
    // Celebration message for engaged users
    const messages = [
      `🔥 Amazing work this week! You're building great learning habits. Keep the momentum going! 💪`,
      `Your dedication is paying off! You're making real progress in your studies. Stay awesome! ✨`,
      `${user.quiz_streak > 0 ? `🔥 You're on a ${user.quiz_streak}-day quiz streak! Don't break it today!` : 'Keep up the great work!'}`,
      `You're consistently showing up — that's the hardest part. Keep it going! 🌟`,
      `Your focus is paying off. Today's study session will be another step forward. 📈`,
      `Small wins add up. Keep stacking them and you're building something great. 🧩`,
      `Your learning momentum is strong. Keep riding it and you'll be amazed at what you accomplish. 🚀`,
      `You're in a great groove. A little study session today keeps the streak alive. 🔥`,
    ];
    
    const msg = messages[Math.floor(Math.random() * messages.length)];
    
    return {
      user_id: user.user_id,
      type: 'daily_progress_celebration',
      title: '🏆 You\'re Crushing It!',
      message: msg,
      data: { category: 5, engagement_tier: user.engagement_tier, quiz_streak: user.quiz_streak },
      action_url: '/social/profile?tab=learning-summary',
      category: 5,
    };
  } else if (user.engagement_tier === 'warm') {
    // Gentle re-engagement for warming users
    const messages = [
      `We missed you! Your AI assistant has fresh study tips waiting. Come back and see what you've missed. 👋`,
      `You've built some great notes here. Let's quiz what you remember and refresh your learning! 📚`,
      `Your learning journey is waiting for you. Come back and see your progress! 🎯`,
      `A few minutes of review can make today feel like progress. Check out what you've already built. 🗂️`,
      `Your last session had momentum. Come back and pick up right where you left off. ✨`,
      `A quick study session today keeps your skills sharp. Ready when you are. 🧠`,
    ];
    
    const msg = messages[Math.floor(Math.random() * messages.length)];
    
    return {
      user_id: user.user_id,
      type: 'daily_progress_reengagement',
      title: '👋 Welcome Back!',
      message: msg,
      data: { category: 5, engagement_tier: user.engagement_tier },
      action_url: '/chat?context=welcome-back',
      category: 5,
    };
  } else {
    // Win-back message for cold users
    const messages = [
      `It's been a while! Your learning tools are waiting to help you get back on track. Ready to resume? 🚀`,
      `You had some great momentum before. Let's pick up where you left off and build new habits! 💪`,
      `We have personalized study recommendations just for you. Come see what's new! ✨`,
      `Take one small step today and you'll be amazed at how quickly it builds. Let's start. 📌`,
      `Even a short refresh session can make a big difference. Want to give it a try? 🧠`,
      `Your next study session is just one click away. Let's make it count. 🎯`,
    ];
    
    const msg = messages[Math.floor(Math.random() * messages.length)];
    
    return {
      user_id: user.user_id,
      type: 'daily_progress_winback',
      title: '🚀 Ready to Get Back?',
      message: msg,
      data: { category: 5, engagement_tier: user.engagement_tier },
      action_url: '/dashboard',
      category: 5,
    };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('[daily-notifications-engine] Starting daily notification generation...');
    
    // Check if this is a manual force run for a specific user
    let body: any = {};
    try {
      if (req.method === 'POST' || req.method === 'PUT') {
        body = await req.json();
      }
    } catch (e) {
      // No body is fine
    }

    const forceRunUserId = body?.force_run_for_user;
    
    const BATCH_SIZE = 200; // Process 200 users per batch to avoid memory issues
    let offset = 0;
    let totalProcessed = 0;
    let totalScheduled = 0;
    let totalErrors = 0;

    // Process users in batches
    while (true) {
      console.log(`[daily-notifications-engine] Fetching batch at offset ${offset}...`);

      // 1. Fetch batch of users with push notifications enabled
      let query = supabase
        .from('notification_preferences')
        .select('user_id, user_timezone, daily_categories, preferred_notification_times, max_notifications_per_day, push_notifications')
        .eq('push_notifications', true);

      // If force_run_for_user is specified, only process that user
      if (forceRunUserId) {
        query = query.eq('user_id', forceRunUserId);
        console.log(`[daily-notifications-engine] Force run for user: ${forceRunUserId}`);
      }

      const { data: batchPrefs, error: prefsError } = await query
        .order('user_id', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

      if (prefsError) {
        throw new Error(`Failed to fetch preferences batch: ${prefsError.message}`);
      }

      // Check if we're done
      if (!batchPrefs || batchPrefs.length === 0) {
        console.log('[daily-notifications-engine] Completed all batches');
        break;
      }

      const batchUserIds = batchPrefs.map((p: any) => p.user_id);
      console.log(`[daily-notifications-engine] Processing batch of ${batchUserIds.length} users`);

      // 2. Fetch profiles for this batch
      const { data: batchProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', batchUserIds);

      if (profilesError) {
        throw new Error(`Failed to fetch profiles batch: ${profilesError.message}`);
      }

      // 3. Fetch activity tracking for this batch
      const { data: batchActivity, error: activityError } = await supabase
        .from('user_activity_tracking')
        .select('user_id, engagement_tier, last_active, chat_sessions_count, quiz_attempts_count, posts_count, group_interactions_count, notes_count, documents_count, quiz_streak')
        .in('user_id', batchUserIds);

      if (activityError) {
        throw new Error(`Failed to fetch activity batch: ${activityError.message}`);
      }

      // 4. Build maps for this batch
      const prefsMap = new Map((batchPrefs || []).map((p: any) => [p.user_id, p]));
      const activityMap = new Map((batchActivity || []).map((a: any) => [a.user_id, a]));
      const profilesMap = new Map((batchProfiles || []).map((p: any) => [p.id, p]));

      const logsToInsert: NotificationLogEntry[] = [];
      const batchProcessed = batchPrefs.length;
      let batchSuccessCount = 0;
      let batchErrorCount = 0;

      // 5. Build notifications for each user in batch
      for (const userPref of batchPrefs) {
        try {
          const profile = profilesMap.get(userPref.user_id) as any;
          const activity = activityMap.get(userPref.user_id) as any;

          // Skip only if both profile AND activity are missing (new user with zero data)
          // If just activity is missing, use defaults for cold users
          if (!profile) {
            console.warn(`[daily-notifications-engine] No profile for user ${userPref.user_id}, skipping`);
            batchErrorCount++;
            continue;
          }

          // Provide default activity values for new users with no activity history
          const defaultActivity = {
            engagement_tier: 'cold' as const,
            last_active: new Date().toISOString(),
            chat_sessions_count: 0,
            quiz_attempts_count: 0,
            posts_count: 0,
            group_interactions_count: 0,
            notes_count: 0,
            documents_count: 0,
            quiz_streak: 0,
          };

          const activityData = activity || defaultActivity;

          const userContext: UserContext = {
            user_id: profile.id,
            email: profile.email,
            timezone: userPref.user_timezone || 'UTC',
            engagement_tier: activityData.engagement_tier,
            last_active: activityData.last_active,
            chat_sessions_count: activityData.chat_sessions_count,
            quiz_attempts_count: activityData.quiz_attempts_count,
            posts_count: activityData.posts_count,
            group_interactions_count: activityData.group_interactions_count,
            notes_count: activityData.notes_count,
            documents_count: activityData.documents_count,
            quiz_streak: activityData.quiz_streak,
            fullName: profile.full_name || profile.email.split('@')[0],
          };

          const enabledCategories = userPref.daily_categories || {};
          const sendTimes = userPref.preferred_notification_times || {};
          const maxPerDay = userPref.max_notifications_per_day || 3;

          const userNotifications: NotificationPayload[] = [];

          // Category 1: Study Planning (morning)
          if (enabledCategories.study_planning) {
            const notif = buildStudyPlanningNotification(userContext);
            if (notif) {
              const scheduledTime = calculateScheduledSendTime(userContext.timezone, sendTimes.study_planning?.[0] || '08:00');
              userNotifications.push({ ...notif, scheduledTime } as any);
            }
          }

          // Category 2: Quiz Challenge (afternoon)
          if (enabledCategories.quiz_challenge) {
            const notif = buildQuizChallengeNotification(userContext);
            if (notif) {
              const scheduledTime = calculateScheduledSendTime(userContext.timezone, sendTimes.quiz_challenge?.[0] || '14:00');
              userNotifications.push({ ...notif, scheduledTime } as any);
            }
          }

          // Category 3: Group Nudge (needs to check recent activity)
          if (enabledCategories.group_nudge) {
            // TODO: Query for recent group activity in the last 24 hours
            const notif = buildGroupNudgeNotification(userContext, true); // Placeholder
            if (notif) {
              const scheduledTime = calculateScheduledSendTime(userContext.timezone, sendTimes.group_nudge?.[0] || '17:00');
              userNotifications.push({ ...notif, scheduledTime } as any);
            }
          }

          // Category 4: Podcast Discovery (can have multiple times)
          if (enabledCategories.podcast_discovery) {
            const times = Array.isArray(sendTimes.podcast_discovery) ? sendTimes.podcast_discovery : ['19:00'];
            for (const time of times) {
              const notif = buildPodcastDiscoveryNotification(userContext);
              if (notif) {
                const scheduledTime = calculateScheduledSendTime(userContext.timezone, time);
                userNotifications.push({ ...notif, scheduledTime } as any);
              }
            }
          }

          // Category 5: Progress Tracking (flexible - send at random time between 7-9 PM)
          if (enabledCategories.progress_tracking) {
            const notif = buildProgressTrackingNotification(userContext);
            if (notif) {
              // Random time between 19:00 and 21:00
              const randomHour = 19 + Math.floor(Math.random() * 2);
              const randomMin = Math.floor(Math.random() * 60);
              const randomTime = `${String(randomHour).padStart(2, '0')}:${String(randomMin).padStart(2, '0')}`;
              const scheduledTime = calculateScheduledSendTime(userContext.timezone, randomTime);
              userNotifications.push({ ...notif, scheduledTime } as any);
            }
          }

          // Enforce max per day limit
          const finalNotifications = userNotifications.slice(0, maxPerDay);

          // Prepare logs for insertion (with calculated scheduled_send_at times, NOT sending immediately)
          for (const notif of finalNotifications) {
            logsToInsert.push({
              user_id: notif.user_id,
              notification_type: notif.type,
              category: notif.category,
              scheduled_send_at: (notif as any).scheduledTime,
              opened_by_user: false,
              opened_at: null,
              deep_link_clicked: false,
              deep_link_clicked_at: null,
              action_taken: false,
              action_taken_at: null,
              personalization_data: { engagement_tier: userContext.engagement_tier },
              message_template: notif.message,
              deep_link_url: notif.action_url,
            });
          }

          batchSuccessCount++;
        } catch (err) {
          console.error(`Error processing user ${userPref.user_id}:`, err);
          batchErrorCount++;
        }
      }

      console.log(`[daily-notifications-engine] Batch complete: ${batchSuccessCount} successful, ${batchErrorCount} errors, ${logsToInsert.length} notifications scheduled`);

      // 6. Insert logs for this batch
      if (logsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('daily_notification_log')
          .insert(logsToInsert);

        if (insertError) {
          console.error('[daily-notifications-engine] Error inserting batch logs:', insertError);
          totalErrors += logsToInsert.length;
        } else {
          console.log(`[daily-notifications-engine] Inserted ${logsToInsert.length} notification logs for batch`);
          totalScheduled += logsToInsert.length;
        }
      }

      // Move to next batch
      totalProcessed += batchProcessed;
      offset += BATCH_SIZE;
    }

    console.log(`[daily-notifications-engine] Processing complete - Processed: ${totalProcessed}, Scheduled: ${totalScheduled}, Errors: ${totalErrors}`);

    // Return summary
    return new Response(
      JSON.stringify({
        success: true,
        users_processed: totalProcessed,
        notifications_scheduled: totalScheduled,
        errors: totalErrors,
        message: `Processed ${totalProcessed} users. ${totalScheduled} notifications scheduled for delivery. Dispatcher will send them at scheduled times.`,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[daily-notifications-engine] Fatal error:', error);
    
    try {
      await logSystemError(supabase, {
        source: 'daily-notifications-engine',
        message: error.message,
        details: { stack: error.stack },
        severity: 'error',
      });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
