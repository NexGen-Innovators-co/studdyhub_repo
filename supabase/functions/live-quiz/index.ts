import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Helper: Generate random join code
function generateJoinCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Helper: Extract user ID from JWT
function getUserIdFromRequest(req: Request): string | null {
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt || typeof jwt !== 'string') return null;
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    return payload.sub || null;
  } catch (error) {
    // console.error('Error extracting user ID:', error);
    return null;
  }
}

// Helper: Insert questions for a session
async function insertLiveQuizQuestions(supabase: any, sessionId: string, questions: any[]) {
  const questionInserts = questions.map((q, idx) => ({
    session_id: sessionId,
    question_index: idx,
    question_text: q.question_text || q.question,
    options: q.options,
    correct_answer: q.correct_answer ?? q.correctAnswer ?? q.correct_option,
    explanation: q.explanation || null,
    time_limit: q.time_limit || 30,
    status: 'pending'
  }));

  return await supabase.from('live_quiz_questions').insert(questionInserts);
}

// Helper: Mark unanswered questions as incorrect
async function markUnansweredAsIncorrect(supabase: any, sessionId: string, questionId: string) {
  const now = new Date().toISOString();
  
  // Get all players who are playing
  const { data: players } = await supabase
    .from('live_quiz_players')
    .select('user_id')
    .eq('session_id', sessionId)
    .eq('is_playing', true);

  if (!players || players.length === 0) return;

  for (const player of players) {
    // Check if player answered this question
    const { data: existingAnswer } = await supabase
      .from('live_quiz_answers')
      .select('id')
      .eq('question_id', questionId)
      .eq('user_id', player.user_id)
      .maybeSingle();

    if (!existingAnswer) {
      // Record zero-point answer for unanswered question
      await supabase
        .from('live_quiz_answers')
        .insert({
          session_id: sessionId,
          question_id: questionId,
          user_id: player.user_id,
          answer_index: -1,
          is_correct: false,
          points_awarded: 0,
          answered_at: now,
          status: 'timeout'
        });
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // Parse request body
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { action } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get user ID from JWT
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid or missing token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- Individual Auto Mode Actions ---
    if (action === 'initialize-individual-progress') {
      // IMPLEMENTATION: Create player_question_progress rows for all players and questions in the session
      const { session_id } = body;
      if (!session_id) {
        return new Response(JSON.stringify({ error: 'session_id is required' }), { status: 400, headers: corsHeaders });
      }
      // Fetch all players in the session
      const { data: players, error: playerError } = await supabase
        .from('live_quiz_players')
        .select('user_id')
        .eq('session_id', session_id)
        .eq('is_playing', true);
      if (playerError || !players || players.length === 0) {
        return new Response(JSON.stringify({ error: 'No players found for session' }), { status: 404, headers: corsHeaders });
      }
      // Fetch all questions in the session
      const { data: questions, error: questionError } = await supabase
        .from('live_quiz_questions')
        .select('id, question_index')
        .eq('session_id', session_id);
      if (questionError || !questions || questions.length === 0) {
        return new Response(JSON.stringify({ error: 'No questions found for session' }), { status: 404, headers: corsHeaders });
      }
      // Prepare inserts for all player/question pairs
      const progressRows = [];
      for (const player of players) {
        for (const question of questions) {
          progressRows.push({
            session_id,
            player_id: player.user_id,
            question_id: question.id,
            question_index: question.question_index,
            points_awarded: 0,
            time_spent: 0,
            status: 'pending',
          });
        }
      }
      // Insert all progress rows (in batches if needed)
      let errorOccurred = false;
      for (let i = 0; i < progressRows.length; i += 1000) {
        const batch = progressRows.slice(i, i + 1000);
        const { error: insertError } = await supabase
          .from('player_question_progress')
          .insert(batch);
        if (insertError) {
          errorOccurred = true;
          break;
        }
      }
      if (errorOccurred) {
        return new Response(JSON.stringify({ error: 'Failed to initialize player progress' }), { status: 500, headers: corsHeaders });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    } else if (action === 'get-individual-quiz-state') {
      // IMPLEMENTATION: Return full IndividualQuizState for a player
      const { session_id, player_id } = body;
      if (!session_id || !player_id) {
        return new Response(JSON.stringify({ error: 'session_id and player_id are required' }), { status: 400, headers: corsHeaders });
      }
      // Get session
      const { data: session } = await supabase
        .from('live_quiz_sessions')
        .select('*')
        .eq('id', session_id)
        .single();
      if (!session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: corsHeaders });
      }
      // Get all questions
      const { data: questions } = await supabase
        .from('live_quiz_questions')
        .select('*')
        .eq('session_id', session_id)
        .order('question_index');
      // Get player progress
      const { data: playerProgress } = await supabase
        .from('player_question_progress')
        .select('*')
        .eq('session_id', session_id)
        .eq('player_id', player_id)
        .order('question_index');
      // Get leaderboard
      const { data: allProgress } = await supabase
        .from('player_question_progress')
        .select('player_id, points_awarded, is_correct, time_spent, status')
        .eq('session_id', session_id);
      const { data: players } = await supabase
        .from('live_quiz_players')
        .select('user_id, display_name')
        .eq('session_id', session_id);

      const playerIds = (players || []).map((p: any) => p.user_id).filter(Boolean);
      const { data: profiles } = playerIds.length
        ? await supabase
            .from('profiles')
            .select('id, avatar_url')
            .in('id', playerIds)
        : { data: [] };
      // Calculate leaderboard
      const leaderboardMap = {};
      for (const row of allProgress || []) {
        if (!leaderboardMap[row.player_id]) {
          const profile = profiles?.find((p: any) => p.id === row.player_id);
          leaderboardMap[row.player_id] = {
            player_id: row.player_id,
            display_name: players?.find(p => p.user_id === row.player_id)?.display_name || '',
            avatar_url: profile?.avatar_url || null,
            score: 0,
            questions_attempted: 0,
            questions_correct: 0,
            total_time_spent: 0,
            accuracy: 0,
            current_question_idx: 0,
            status: 'active',
          };
        }
        leaderboardMap[row.player_id].score += row.points_awarded || 0;
        leaderboardMap[row.player_id].total_time_spent += row.time_spent || 0;
        if (row.status === 'answered' || row.status === 'timeout' || row.status === 'skipped') {
          leaderboardMap[row.player_id].questions_attempted += 1;
        }
        if (row.is_correct) {
          leaderboardMap[row.player_id].questions_correct += 1;
        }
      }
      for (const pid in leaderboardMap) {
        const l = leaderboardMap[pid];
        l.accuracy = l.questions_attempted > 0 ? l.questions_correct / l.questions_attempted : 0;
      }
      const leaderboard = Object.values(leaderboardMap);
      // Find current question index for player
      let currentQuestionIndex = 0;
      if (playerProgress && playerProgress.length > 0) {
        const nextPending = playerProgress.findIndex(p => p.status === 'pending');
        currentQuestionIndex = nextPending === -1 ? playerProgress.length - 1 : nextPending;
      }
      return new Response(JSON.stringify({
        session,
        questions: questions || [],
        playerProgress: playerProgress || [],
        currentQuestionIndex,
        leaderboard
      }), { status: 200, headers: corsHeaders });
    } else if (action === 'submit-answer-individual') {
      try {
        // IMPLEMENTATION: Validate answer, calculate score, update progress
        const { session_id, player_id, question_id, selected_option, time_spent } = body;
        
        if (!session_id || !player_id || !question_id || typeof selected_option !== 'number') {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
        }

        // 1. Fetch Question. We use select('*') to avoid errors if time_limit column is missing
        const { data: question, error: qError } = await supabase
          .from('live_quiz_questions')
          .select('*') 
          .eq('id', question_id)
          .single();
          
        if (qError || !question) {
             console.error('Question fetch error:', qError);
             return new Response(JSON.stringify({ error: 'Question not found', details: qError }), { status: 404, headers: corsHeaders });
        }

        // 2. Score Calculation
        const is_correct = question.correct_answer === selected_option;
        let points_awarded = 0;
        let safeSpent = 0;

        // Ensure time_spent is a valid integer for Postgres
        try {
           safeSpent = Math.round(Math.max(0, parseFloat(String(time_spent || 0))));
        } catch (e) {
           safeSpent = 0; 
        }
        
        if (is_correct) {
            const basePoints = 1000;
            // Handle possibility of missing time_limit column
            const limit = question.time_limit || 30;
            
            let multiplier = 1;
            if (limit > 0) {
                const ratio = safeSpent / limit;
                multiplier = Math.max(0.5, 1 - (ratio * 0.5));
            }
            points_awarded = Math.round(basePoints * multiplier);
        }

        // 3. Update Progress
        const { error: updateError } = await supabase
          .from('player_question_progress')
          .update({
            selected_option,
            is_correct,
            points_awarded,
            time_spent: safeSpent, // Use the sanitized integer
            status: 'answered',
            answered_at: new Date().toISOString()
          })
          .eq('session_id', session_id)
          .eq('player_id', player_id)
          .eq('question_id', question_id);

        if (updateError) {
          console.error('Progress update error:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to update answer', details: updateError }), { status: 500, headers: corsHeaders });
        }

        // 4. Update Overall Player Score
        // We accumulate the points for this player in this session
        // Note: This is an efficient way but if concurrency is high might need a function.
        // For now, fetching total and updating is acceptable for individual mode.
        
        const { data: allProgress } = await supabase
          .from('player_question_progress')
          .select('points_awarded')
          .eq('session_id', session_id)
          .eq('player_id', player_id);
          
        const totalScore = (allProgress || []).reduce((sum: number, r: any) => sum + (r.points_awarded || 0), 0);

        await supabase
          .from('live_quiz_players')
          .update({ score: totalScore, last_answered_at: new Date().toISOString() })
          .eq('session_id', session_id)
          .eq('user_id', player_id);

        return new Response(JSON.stringify({ success: true, is_correct, points_awarded }), { status: 200, headers: corsHeaders });
      } catch (err: any) {
        console.error('submit-answer-individual Exception:', err);
        return new Response(JSON.stringify({ error: 'Internal Server Error', message: err.message }), { status: 500, headers: corsHeaders });
      }
    } else if (action === 'advance-individual') {
      // IMPLEMENTATION: Manually advance player to next question
      const { session_id, player_id, current_question_id } = body;
      if (!session_id || !player_id || !current_question_id) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
      }
      // Mark current question as skipped if still pending
      await supabase
        .from('player_question_progress')
        .update({ status: 'skipped' })
        .eq('session_id', session_id)
        .eq('player_id', player_id)
        .eq('question_id', current_question_id)
        .eq('status', 'pending');
      // Find next question index
      const { data: progress } = await supabase
        .from('player_question_progress')
        .select('question_index, status')
        .eq('session_id', session_id)
        .eq('player_id', player_id)
        .order('question_index');
      let nextIndex = 0;
      if (progress && progress.length > 0) {
        nextIndex = progress.findIndex(p => p.status === 'pending');
      }
      return new Response(JSON.stringify({ success: true, nextIndex }), { status: 200, headers: corsHeaders });
    } else if (action === 'check-individual-timeout') {
      // IMPLEMENTATION: Check and handle timeouts for individual mode
      const { session_id, player_id, question_id, timeout_seconds } = body;
      if (!session_id || !player_id || !question_id || !timeout_seconds) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
      }
      // Get progress row
      const { data: progress } = await supabase
        .from('player_question_progress')
        .select('status, time_spent')
        .eq('session_id', session_id)
        .eq('player_id', player_id)
        .eq('question_id', question_id)
        .single();
      if (!progress) {
        return new Response(JSON.stringify({ error: 'Progress not found' }), { status: 404, headers: corsHeaders });
      }
      if (progress.status === 'pending' && progress.time_spent >= timeout_seconds) {
        await supabase
          .from('player_question_progress')
          .update({ status: 'timeout' })
          .eq('session_id', session_id)
          .eq('player_id', player_id)
          .eq('question_id', question_id);
        return new Response(JSON.stringify({ timeout: true }), { status: 200, headers: corsHeaders });
      }
      return new Response(JSON.stringify({ timeout: false }), { status: 200, headers: corsHeaders });
    } else if (action === 'get-realtime-leaderboard') {
      // IMPLEMENTATION: Return leaderboard for individual mode
      const { session_id } = body;
      if (!session_id) {
        return new Response(JSON.stringify({ error: 'session_id is required' }), { status: 400, headers: corsHeaders });
      }
      const { data: allProgress } = await supabase
        .from('player_question_progress')
        .select('player_id, points_awarded, is_correct, time_spent, status')
        .eq('session_id', session_id);
      const { data: players } = await supabase
        .from('live_quiz_players')
        .select('user_id, display_name')
        .eq('session_id', session_id);

      const playerIds = (players || []).map((p: any) => p.user_id).filter(Boolean);
      const { data: profiles } = playerIds.length
        ? await supabase
            .from('profiles')
            .select('id, avatar_url')
            .in('id', playerIds)
        : { data: [] };
      // Calculate leaderboard
      const leaderboardMap = {};
      for (const row of allProgress || []) {
        if (!leaderboardMap[row.player_id]) {
          const profile = profiles?.find((p: any) => p.id === row.player_id);
          leaderboardMap[row.player_id] = {
            player_id: row.player_id,
            display_name: players?.find(p => p.user_id === row.player_id)?.display_name || '',
            avatar_url: profile?.avatar_url || null,
            score: 0,
            questions_attempted: 0,
            questions_correct: 0,
            total_time_spent: 0,
            accuracy: 0,
            current_question_idx: 0,
            status: 'active',
          };
        }
        leaderboardMap[row.player_id].score += row.points_awarded || 0;
        leaderboardMap[row.player_id].total_time_spent += row.time_spent || 0;
        if (row.status === 'answered' || row.status === 'timeout' || row.status === 'skipped') {
          leaderboardMap[row.player_id].questions_attempted += 1;
        }
        if (row.is_correct) {
          leaderboardMap[row.player_id].questions_correct += 1;
        }
      }
      for (const pid in leaderboardMap) {
        const l = leaderboardMap[pid];
        l.accuracy = l.questions_attempted > 0 ? l.questions_correct / l.questions_attempted : 0;
      }
      const leaderboard = Object.values(leaderboardMap);
      return new Response(JSON.stringify({ leaderboard }), { status: 200, headers: corsHeaders });
    }

    // Route based on action
    if (action === 'create-session') {
      const { quiz_id, questions, host_role, advance_mode, question_time_limit, scheduled_start_time, allow_late_join } = body;

      if (!quiz_id && !questions) {
        return new Response(
          JSON.stringify({ error: 'Either quiz_id or questions is required' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Set defaults
      const finalHostRole = host_role || 'participant';
      const finalAdvanceMode = advance_mode || 'auto';
      const finalTimeLimit = question_time_limit || 30;
      const finalAllowLateJoin = allow_late_join !== undefined ? allow_late_join : true;

      // Generate join code
      const joinCode = generateJoinCode();

      let finalQuizId = quiz_id;

      // If custom questions are provided, create a quiz record first
      if (questions && Array.isArray(questions)) {
        const { data: newQuiz, error: quizError } = await supabase
          .from('quizzes')
          .insert({
            title: 'Live Quiz - Custom',
            user_id: userId,
            source_type: 'live_custom',
            questions: questions.map((q, idx) => ({
              question: q.question_text,
              options: q.options,
              correct_answer: q.correct_answer,
              explanation: q.explanation || '',
            })),
          })
          .select()
          .single();

        if (quizError) {
          // console.error('Quiz creation error:', quizError);
          return new Response(
            JSON.stringify({ error: `Failed to create quiz: ${quizError.message}` }),
            { status: 500, headers: corsHeaders }
          );
        }

        finalQuizId = newQuiz.id;
      }

      // Create session
      const { data: session, error: sessionError } = await supabase
        .from('live_quiz_sessions')
        .insert({
          quiz_id: finalQuizId,
          host_user_id: userId,
          join_code: joinCode,
          status: 'waiting',
          host_role: finalHostRole,
          advance_mode: finalAdvanceMode,
          quiz_mode: body.quiz_mode || 'synchronized',
          scheduled_start_time: scheduled_start_time || null,
          allow_late_join: finalAllowLateJoin,
          config: {
            question_time_limit: finalTimeLimit,
            auto_advance: finalAdvanceMode === 'auto',
            quiz_mode: body.quiz_mode || 'synchronized'
          }
        })
        .select()
        .single();

      if (sessionError) {
        // console.error('Session creation error:', sessionError);
        return new Response(
          JSON.stringify({ error: `Failed to create session: ${sessionError.message}` }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Add host based on their role
      if (finalHostRole === 'participant') {
        // Host plays as participant
        const { error: playerError } = await supabase
          .from('live_quiz_players')
          .insert({
            session_id: session.id,
            user_id: userId,
            display_name: 'Host',
            score: 0,
            is_host: true,
            is_playing: true,
          });

        if (playerError) {
          // console.error('Player insertion error:', playerError);
          // Clean up session if player insertion fails
          await supabase.from('live_quiz_sessions').delete().eq('id', session.id);
          return new Response(
            JSON.stringify({ error: `Failed to add host: ${playerError.message}` }),
            { status: 500, headers: corsHeaders }
          );
        }
      } else {
        // Host is mediator only
        const { error: playerError } = await supabase
          .from('live_quiz_players')
          .insert({
            session_id: session.id,
            user_id: userId,
            display_name: 'Mediator',
            score: 0,
            is_host: true,
            is_playing: false,
            is_mediator: true,
          });

        if (playerError) {
          // console.error('Mediator insertion error:', playerError);
          await supabase.from('live_quiz_sessions').delete().eq('id', session.id);
          return new Response(
            JSON.stringify({ error: `Failed to add mediator: ${playerError.message}` }),
            { status: 500, headers: corsHeaders }
          );
        }
      }

      // Insert questions
      let questionsToInsert: any[] = [];
      
      if (questions && Array.isArray(questions)) {
        // Use custom questions
        questionsToInsert = questions;
      } else if (finalQuizId) {
        // Load from quiz - questions are stored in the 'questions' JSONB field
        const { data: quiz, error: quizError } = await supabase
          .from('quizzes')
          .select('questions')
          .eq('id', finalQuizId)
          .single();

        if (quizError) {
          // console.error('Quiz fetch error:', quizError);
          await supabase.from('live_quiz_sessions').delete().eq('id', session.id);
          return new Response(
            JSON.stringify({ error: `Failed to fetch quiz: ${quizError.message}` }),
            { status: 404, headers: corsHeaders }
          );
        }

        if (!quiz) {
          // console.error('Quiz not found:', finalQuizId);
          await supabase.from('live_quiz_sessions').delete().eq('id', session.id);
          return new Response(
            JSON.stringify({ error: 'Quiz not found' }),
            { status: 404, headers: corsHeaders }
          );
        }

        // Extract questions - handle different possible formats
        let questions = quiz.questions;
        if (!questions) {
          questions = [];
        }
        if (typeof questions === 'string') {
          try {
            questions = JSON.parse(questions);
          } catch (e) {
            // console.error('Failed to parse questions JSON:', e);
            questions = [];
          }
        }

        if (!Array.isArray(questions) || questions.length === 0) {
          // console.error('Quiz has no questions or questions is not an array:', quiz);
          await supabase.from('live_quiz_sessions').delete().eq('id', session.id);
          return new Response(
            JSON.stringify({ error: 'Quiz has no questions' }),
            { status: 404, headers: corsHeaders }
          );
        }

        questionsToInsert = questions;
      }

      const { error: questionsError } = await insertLiveQuizQuestions(
        supabase,
        session.id,
        questionsToInsert
      );

      if (questionsError) {
        // console.error('Questions insertion error:', questionsError);
        await supabase.from('live_quiz_sessions').delete().eq('id', session.id);
        return new Response(
          JSON.stringify({ error: `Failed to load questions: ${questionsError.message}` }),
          { status: 500, headers: corsHeaders }
        );
      }

      // --- PATCH: Auto-initialize player_question_progress for individual_auto mode ---
      if ((body.quiz_mode || (session.config && session.config.quiz_mode)) === 'individual_auto') {
        // Fetch all players in the session
        const { data: players, error: playerError } = await supabase
          .from('live_quiz_players')
          .select('user_id')
          .eq('session_id', session.id)
          .eq('is_playing', true);
        if (!playerError && players && players.length > 0) {
          // Fetch all questions in the session
          const { data: questions, error: questionError } = await supabase
            .from('live_quiz_questions')
            .select('id, question_index')
            .eq('session_id', session.id);
          if (!questionError && questions && questions.length > 0) {
            // Prepare inserts for all player/question pairs
            const progressRows = [];
            for (const player of players) {
              for (const question of questions) {
                progressRows.push({
                  session_id: session.id,
                  player_id: player.user_id,
                  question_id: question.id,
                  question_index: question.question_index,
                  points_awarded: 0,
                  time_spent: 0,
                  status: 'pending',
                });
              }
            }
            // Insert all progress rows (in batches if needed)
            for (let i = 0; i < progressRows.length; i += 1000) {
              const batch = progressRows.slice(i, i + 1000);
              await supabase.from('player_question_progress').insert(batch);
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ session, join_code: joinCode }),
        { status: 201, headers: corsHeaders }
      );

    } else if (action === 'join-session') {
      const { join_code, display_name } = body;

      if (!join_code || !display_name) {
        return new Response(
          JSON.stringify({ error: 'join_code and display_name are required' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Find session
      const { data: session, error: sessionError } = await supabase
        .from('live_quiz_sessions')
        .select('*')
        .eq('join_code', join_code.toUpperCase())
        .single();

      if (sessionError || !session) {
        return new Response(
          JSON.stringify({ error: 'Session not found. Please check the code.' }),
          { status: 200, headers: corsHeaders }
        );
      }

      // Check if session is active
      if (!['waiting', 'in_progress'].includes(session.status)) {
        return new Response(
          JSON.stringify({ error: 'This quiz session has ended.' }),
          { status: 200, headers: corsHeaders }
        );
      }

      // Check allow_late_join policy
      if (session.status === 'in_progress' && session.allow_late_join === false) {
        return new Response(
          JSON.stringify({ error: 'The quiz has already started. Late entries are not allowed.' }),
          { status: 200, headers: corsHeaders }
        );
      }

      // Check if already joined
      const { data: existingPlayer } = await supabase
        .from('live_quiz_players')
        .select('*')
        .eq('session_id', session.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingPlayer) {
        return new Response(
          JSON.stringify({ session, player: existingPlayer, alreadyJoined: true }),
          { status: 200, headers: corsHeaders }
        );
      }

      // Add player
      const { data: player, error: playerError } = await supabase
        .from('live_quiz_players')
        .insert({
          session_id: session.id,
          user_id: userId,
          display_name,
          score: 0,
          is_host: false,
          is_playing: true,
        })
        .select()
        .single();

      if (playerError) {
        // console.error('Player join error:', playerError);
        return new Response(
          JSON.stringify({ error: `Failed to join: ${playerError.message}` }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ session, player }),
        { status: 201, headers: corsHeaders }
      );

    } else if (action === 'start-session') {
      const { session_id } = body;

      if (!session_id) {
        return new Response(
          JSON.stringify({ error: 'session_id is required' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Verify host
      const { data: session, error: sessionError } = await supabase
        .from('live_quiz_sessions')
        .select('*')
        .eq('id', session_id)
        .single();

      if (sessionError || !session) {
        return new Response(
          JSON.stringify({ error: 'Session not found' }),
          { status: 404, headers: corsHeaders }
        );
      }

      if (session.host_user_id !== userId) {
        return new Response(
          JSON.stringify({ error: 'Only host can start the quiz' }),
          { status: 403, headers: corsHeaders }
        );
      }

      // Update session status
      const now = new Date();
      const { data: updated, error: updateError } = await supabase
        .from('live_quiz_sessions')
        .update({
          status: 'in_progress',
          start_time: now.toISOString(),
        })
        .eq('id', session_id)
        .select()
        .single();

      if (updateError) {
        // console.error('Session start error:', updateError);
        return new Response(
          JSON.stringify({ error: `Failed to start session: ${updateError.message}` }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Start first question
      const { data: firstQuestion, error: questionError } = await supabase
        .from('live_quiz_questions')
        .select('*')
        .eq('session_id', session_id)
        .eq('question_index', 0)
        .single();

      if (!questionError && firstQuestion) {
        const timeLimit = firstQuestion.time_limit || 30;
        const endTime = new Date(now.getTime() + timeLimit * 1000);
        await supabase
          .from('live_quiz_questions')
          .update({
            start_time: now.toISOString(),
            end_time: endTime.toISOString(),
            status: 'active'
          })
          .eq('id', firstQuestion.id);
      }

      return new Response(
        JSON.stringify({ session: updated }),
        { status: 200, headers: corsHeaders }
      );

    } else if (action === 'submit-answer') {
      const { session_id, question_id, answer_index, time_taken } = body;

      if (!session_id || !question_id || typeof answer_index !== 'number') {
        return new Response(
          JSON.stringify({ error: 'session_id, question_id, and answer_index are required' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Verify session is in progress
      const { data: session, error: sessionError } = await supabase
        .from('live_quiz_sessions')
        .select('status')
        .eq('id', session_id)
        .single();

      if (sessionError || !session || session.status !== 'in_progress') {
        return new Response(
          JSON.stringify({ error: 'Session not found or not in progress' }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Get question
      const { data: question, error: questionError } = await supabase
        .from('live_quiz_questions')
        .select('*')
        .eq('id', question_id)
        .eq('session_id', session_id)
        .single();

      if (questionError || !question) {
        return new Response(
          JSON.stringify({ error: 'Question not found' }),
          { status: 404, headers: corsHeaders }
        );
      }

      // Check if question is still open
      if (question.end_time && new Date(question.end_time) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Question is closed' }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Check if already answered
      const { data: existingAnswer } = await supabase
        .from('live_quiz_answers')
        .select('id, answer_index, status')
        .eq('question_id', question_id)
        .eq('user_id', userId)
        .maybeSingle();

      // If there's an existing real answer (not a timeout), block the submission
      if (existingAnswer && existingAnswer.answer_index !== -1) {
        return new Response(
          JSON.stringify({ error: 'Already answered this question' }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Calculate correctness and points
      const isCorrect = answer_index === question.correct_answer;
      
      let pointsAwarded = 0;
      if (isCorrect) {
        const basePoints = 100;
        const timeTaken = time_taken || (question.start_time
          ? Math.floor((Date.now() - new Date(question.start_time).getTime()) / 1000)
          : 0);
        const timeLimit = question.time_limit || 30;
        const timeBonus = Math.max(0, Math.floor((timeLimit - timeTaken) * 2));
        pointsAwarded = basePoints + timeBonus;
      }

      // If there's an existing timeout answer (-1), update it. Otherwise insert new.
      if (existingAnswer && existingAnswer.answer_index === -1) {
        // Update the timeout placeholder with the actual answer
        const { error: updateError } = await supabase
          .from('live_quiz_answers')
          .update({
            answer_index,
            is_correct: isCorrect,
            points_awarded: pointsAwarded,
            answered_at: new Date().toISOString(),
            time_taken: time_taken,
            status: 'answered'
          })
          .eq('id', existingAnswer.id);

        if (updateError) {
          // console.error('Answer update error:', updateError);
          return new Response(
            JSON.stringify({ error: `Failed to update answer: ${updateError.message}` }),
            { status: 500, headers: corsHeaders }
          );
        }
      } else {
        // Insert new answer
        const { error: answerError } = await supabase
          .from('live_quiz_answers')
          .insert({
            session_id,
            question_id,
            user_id: userId,
            answer_index,
            is_correct: isCorrect,
            points_awarded: pointsAwarded,
            answered_at: new Date().toISOString(),
            time_taken: time_taken,
            status: 'answered'
          });

        if (answerError) {
          // console.error('Answer submission error:', answerError);
          return new Response(
            JSON.stringify({ error: `Failed to submit answer: ${answerError.message}` }),
            { status: 500, headers: corsHeaders }
          );
        }
      }

      // Update player score
      // When updating from timeout (-1) to real answer, we need to add the points
      // When inserting new answer, we add the points
      if (isCorrect && pointsAwarded > 0) {
        const { data: player } = await supabase
          .from('live_quiz_players')
          .select('score')
          .eq('session_id', session_id)
          .eq('user_id', userId)
          .eq('is_playing', true)
          .single();

        if (player) {
          // If we updated from timeout, the old answer had 0 points, so just add pointsAwarded
          // If we inserted new, same thing - just add pointsAwarded
          await supabase
            .from('live_quiz_players')
            .update({
              score: player.score + pointsAwarded,
              last_answered_at: new Date().toISOString(),
            })
            .eq('session_id', session_id)
            .eq('user_id', userId);
        }
      }

      return new Response(
        JSON.stringify({ is_correct: isCorrect, points_awarded: pointsAwarded }),
        { status: 201, headers: corsHeaders }
      );

    } else if (action === 'next-question') {
      // console.log('[next-question] Request body:', JSON.stringify(body));
      const headersObj: Record<string, string> = {};
      for (const [key, value] of req.headers.entries()) {
        headersObj[String(key)] = String(value);
      }
      // console.log('[next-question] Request headers:', JSON.stringify(headersObj));

      const { session_id } = body;

      if (!session_id) {
        return new Response(
          JSON.stringify({ error: 'session_id is required' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Verify host
      const { data: session } = await supabase
        .from('live_quiz_sessions')
        .select('host_user_id, advance_mode')
        .eq('id', session_id)
        .single();

      if (!session || session.host_user_id !== userId) {
        return new Response(
          JSON.stringify({ error: 'Only host can advance questions' }),
          { status: 403, headers: corsHeaders }
        );
      }

      // Get all questions
      const { data: questions } = await supabase
        .from('live_quiz_questions')
        .select('*')
        .eq('session_id', session_id)
        .order('question_index');

      if (!questions || questions.length === 0) {
        // console.log('No questions found');
        return new Response(
          JSON.stringify({ error: 'No questions found' }),
          { status: 404, headers: corsHeaders }
        );
      }

      // Find current question
      const now = new Date();
      const currentQuestion = questions.find(
        (q) => q.start_time && (!q.end_time || new Date(q.end_time) > now)
      );

      if (currentQuestion) {
        // Mark unanswered questions as incorrect
        await markUnansweredAsIncorrect(supabase, session_id, currentQuestion.id);

        // Close current question
        await supabase
          .from('live_quiz_questions')
          .update({ 
            end_time: now.toISOString(),
            status: 'completed'
          })
          .eq('id', currentQuestion.id);

        const nextIndex = currentQuestion.question_index + 1;
        
        if (nextIndex < questions.length) {
          // Start next question
          const timeLimit = questions[nextIndex].time_limit || 30;
          const endTime = new Date(now.getTime() + timeLimit * 1000);
          await supabase
            .from('live_quiz_questions')
            .update({
              start_time: now.toISOString(),
              end_time: endTime.toISOString(),
              status: 'active'
            })
            .eq('session_id', session_id)
            .eq('question_index', nextIndex);

          return new Response(
            JSON.stringify({ 
              success: true, 
              next_question_index: nextIndex,
              end_time: endTime.toISOString()
            }),
            { status: 200, headers: corsHeaders }
          );
        } else {
          // No more questions - end session
          await supabase
            .from('live_quiz_sessions')
            .update({
              status: 'completed',
              end_time: now.toISOString(),
            })
            .eq('id', session_id);

          return new Response(
            JSON.stringify({ 
              success: true, 
              session_completed: true 
            }),
            { status: 200, headers: corsHeaders }
          );
        }
      }

      return new Response(
        JSON.stringify({ success: false, error: 'No active question found' }),
        { status: 404, headers: corsHeaders }
      );

    } else if (action === 'advance-question-auto') {
      const { session_id } = body;

      if (!session_id) {
        return new Response(
          JSON.stringify({ error: 'session_id is required' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Get session config
      const { data: session } = await supabase
        .from('live_quiz_sessions')
        .select('*')
        .eq('id', session_id)
        .single();

      if (!session || session.status !== 'in_progress') {
        return new Response(
          JSON.stringify({ error: 'Session not in progress' }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Get all questions
      const { data: questions } = await supabase
        .from('live_quiz_questions')
        .select('*')
        .eq('session_id', session_id)
        .order('question_index');

      if (!questions || questions.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No questions found' }),
          { status: 404, headers: corsHeaders }
        );
      }

      // Find current question
      const now = new Date();
      const currentQuestion = questions.find(
        (q) => q.start_time && (!q.end_time || new Date(q.end_time) > now)
      );

      if (currentQuestion) {
        // Mark unanswered questions as incorrect
        await markUnansweredAsIncorrect(supabase, session_id, currentQuestion.id);

        // Close current question
        await supabase
          .from('live_quiz_questions')
          .update({ 
            end_time: now.toISOString(),
            status: 'completed'
          })
          .eq('id', currentQuestion.id);

        const nextIndex = currentQuestion.question_index + 1;
        
        if (nextIndex < questions.length) {
          // Start next question
          const timeLimit = questions[nextIndex].time_limit || 30;
          const endTime = new Date(now.getTime() + timeLimit * 1000);
          
          await supabase
            .from('live_quiz_questions')
            .update({
              start_time: now.toISOString(),
              end_time: endTime.toISOString(),
              status: 'active'
            })
            .eq('session_id', session_id)
            .eq('question_index', nextIndex);

          return new Response(
            JSON.stringify({ 
              success: true, 
              next_question_index: nextIndex,
              end_time: endTime.toISOString()
            }),
            { status: 200, headers: corsHeaders }
          );
        } else {
          // No more questions - end session
          await supabase
            .from('live_quiz_sessions')
            .update({
              status: 'completed',
              end_time: now.toISOString(),
            })
            .eq('id', session_id);

          return new Response(
            JSON.stringify({ 
              success: true, 
              session_completed: true 
            }),
            { status: 200, headers: corsHeaders }
          );
        }
      }

      return new Response(
        JSON.stringify({ success: false, error: 'No active question found' }),
        { status: 404, headers: corsHeaders }
      );

    }  else if (action === 'check-question-timeout') {
  const { session_id } = body;

  if (!session_id) {
    return new Response(
      JSON.stringify({ error: 'session_id is required' }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Get session to check advance mode
  const { data: session } = await supabase
    .from('live_quiz_sessions')
    .select('advance_mode, status')
    .eq('id', session_id)
    .single();

  if (!session) {
    return new Response(
      JSON.stringify({ error: 'Session not found' }),
      { status: 404, headers: corsHeaders }
    );
  }

  // Get current question
  const { data: currentQuestion } = await supabase
    .from('live_quiz_questions')
    .select('*')
    .eq('session_id', session_id)
    .not('start_time', 'is', null)
    .is('end_time', null)
    .order('question_index', { ascending: false })
    .limit(1)
    .maybeSingle(); // Use maybeSingle instead of single

  if (currentQuestion) {
    const now = new Date();
    const endTime = new Date(currentQuestion.end_time || 0);
    
    // Add logging to debug
    // console.log(`Timeout check - Now: ${now}, End: ${endTime}, Advance mode: ${session.advance_mode}`);
    
    if (now > endTime) {
      // console.log(`Question ${currentQuestion.id} has timed out`);
      
      // Mark unanswered questions as incorrect
      await markUnansweredAsIncorrect(supabase, session_id, currentQuestion.id);

      // Update question status to completed (not timeout)
      await supabase
        .from('live_quiz_questions')
        .update({
          end_time: now.toISOString(),
          status: 'completed'
        })
        .eq('id', currentQuestion.id);

      // Check if we should auto-advance
      if (session.advance_mode === 'auto') {
        // console.log('Auto-advance mode enabled, attempting to advance...');
        
        // Get all questions to find next one
        const { data: allQuestions } = await supabase
          .from('live_quiz_questions')
          .select('*')
          .eq('session_id', session_id)
          .order('question_index');

        if (allQuestions && allQuestions.length > 0) {
          const nextIndex = currentQuestion.question_index + 1;
          
          if (nextIndex < allQuestions.length) {
            // Start next question
            const timeLimit = allQuestions[nextIndex].time_limit || 30;
            const nextEndTime = new Date(now.getTime() + timeLimit * 1000);
            
            // console.log(`Starting next question ${nextIndex} with ${timeLimit}s limit`);
            
            await supabase
              .from('live_quiz_questions')
              .update({
                start_time: now.toISOString(),
                end_time: nextEndTime.toISOString(),
                status: 'active'
              })
              .eq('session_id', session_id)
              .eq('question_index', nextIndex);

            // Return success with next question info
            return new Response(
              JSON.stringify({ 
                timeout: true,
                question_id: currentQuestion.id,
                auto_advanced: true,
                next_question_index: nextIndex,
                next_question_end_time: nextEndTime.toISOString()
              }),
              { status: 200, headers: corsHeaders }
            );
          } else {
            // No more questions - end session
            // console.log('No more questions, ending session');
            await supabase
              .from('live_quiz_sessions')
              .update({
                status: 'completed',
                end_time: now.toISOString(),
              })
              .eq('id', session_id);

            return new Response(
              JSON.stringify({ 
                timeout: true,
                session_completed: true
              }),
              { status: 200, headers: corsHeaders }
            );
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          timeout: true,
          question_id: currentQuestion.id,
          auto_advanced: false
        }),
        { status: 200, headers: corsHeaders }
      );
    }
  } else {
    // No active question found, check if we need to start one
    // console.log('No active question found, checking if we should start one');
    
    const { data: sessionForCheck } = await supabase
      .from('live_quiz_sessions')
      .select('status')
      .eq('id', session_id)
      .single();

    if (sessionForCheck?.status === 'in_progress') {
      // Session is in progress but no active question
      // Try to find the next pending question
      const { data: pendingQuestions } = await supabase
        .from('live_quiz_questions')
        .select('*')
        .eq('session_id', session_id)
        .eq('status', 'pending')
        .order('question_index')
        .limit(1);

      if (pendingQuestions && pendingQuestions.length > 0) {
        const nextQuestion = pendingQuestions[0];
        const now = new Date();
        const timeLimit = nextQuestion.time_limit || 30;
        const endTime = new Date(now.getTime() + timeLimit * 1000);
        
        await supabase
          .from('live_quiz_questions')
          .update({
            start_time: now.toISOString(),
            end_time: endTime.toISOString(),
            status: 'active'
          })
          .eq('id', nextQuestion.id);

        return new Response(
          JSON.stringify({ 
            timeout: false,
            started_new_question: true,
            question_id: nextQuestion.id
          }),
          { status: 200, headers: corsHeaders }
        );
      }
    }
  }

  return new Response(
    JSON.stringify({ timeout: false }),
    { status: 200, headers: corsHeaders }
  );} else if (action === 'end-session') {
      const { session_id } = body;

      if (!session_id) {
        return new Response(
          JSON.stringify({ error: 'session_id is required' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Verify host
      const { data: session } = await supabase
        .from('live_quiz_sessions')
        .select('host_user_id')
        .eq('id', session_id)
        .single();

      if (!session || session.host_user_id !== userId) {
        return new Response(
          JSON.stringify({ error: 'Only host can end the quiz' }),
          { status: 403, headers: corsHeaders }
        );
      }

      // End session
      const { error: updateError } = await supabase
        .from('live_quiz_sessions')
        .update({
          status: 'completed',
          end_time: new Date().toISOString(),
        })
        .eq('id', session_id);

      if (updateError) {
        // console.error('Session end error:', updateError);
        return new Response(
          JSON.stringify({ error: `Failed to end session: ${updateError.message}` }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: corsHeaders }
      );

    } else if (action === 'refresh-session') {
  const { session_id } = body;

  if (!session_id) {
    return new Response(
      JSON.stringify({ error: 'session_id is required' }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Get session
  const { data: session } = await supabase
    .from('live_quiz_sessions')
    .select('*')
    .eq('id', session_id)
    .single();

  if (!session) {
    return new Response(
      JSON.stringify({ error: 'Session not found' }),
      { status: 404, headers: corsHeaders }
    );
  }

  // Get players
  const { data: players } = await supabase
    .from('live_quiz_players')
    .select('*')
    .eq('session_id', session_id)
    .order('score', { ascending: false });

  const playerIds = (players || []).map((p: any) => p.user_id).filter(Boolean);
  const { data: profiles } = playerIds.length
    ? await supabase
        .from('profiles')
        .select('id, avatar_url')
        .in('id', playerIds)
    : { data: [] };


  const playersWithAvatars = (players || []).map((p: any) => {
    const profile = profiles?.find((profileRow: any) => profileRow.id === p.user_id);
    return { ...p, avatar_url: profile?.avatar_url || null };
  });

  // Get all questions
  const { data: questions } = await supabase
    .from('live_quiz_questions')
    .select('*')
    .eq('session_id', session_id)
    .order('question_index');

  // Get current question (active or most recent)
  const now = new Date().toISOString();
  
  // First try to find active question
  const { data: activeQuestion } = await supabase
    .from('live_quiz_questions')
    .select('*')
    .eq('session_id', session_id)
    .not('start_time', 'is', null)
    .or(`end_time.is.null,end_time.gt.${now}`)
    .order('question_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  let currentQuestion = activeQuestion;
  
  // If no active question, find the most recently completed one
  if (!currentQuestion) {
    const { data: recentQuestion } = await supabase
      .from('live_quiz_questions')
      .select('*')
      .eq('session_id', session_id)
      .not('start_time', 'is', null)
      .not('end_time', 'is', null)
      .order('question_index', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    currentQuestion = recentQuestion;
  }

  // Check if auto-advance should have happened
  let needs_advance = false;
  if (currentQuestion && session.advance_mode === 'auto') {
    const questionEndTime = new Date(currentQuestion.end_time || 0);
    const currentTime = new Date();
    
    if (currentTime > questionEndTime && currentQuestion.status !== 'completed') {
      needs_advance = true;
      
      // Auto-advance the question
      await supabase
        .from('live_quiz_questions')
        .update({
          status: 'completed',
          end_time: currentTime.toISOString()
        })
        .eq('id', currentQuestion.id);
      
      // Mark unanswered
      await markUnansweredAsIncorrect(supabase, session_id, currentQuestion.id);
      
      // Find and start next question
      const nextIndex = currentQuestion.question_index + 1;
      const nextQuestion = questions?.find(q => q.question_index === nextIndex);
      
      if (nextQuestion) {
        const timeLimit = nextQuestion.time_limit || 30;
        const nextEndTime = new Date(currentTime.getTime() + timeLimit * 1000);
        
        await supabase
          .from('live_quiz_questions')
          .update({
            start_time: currentTime.toISOString(),
            end_time: nextEndTime.toISOString(),
            status: 'active'
          })
          .eq('id', nextQuestion.id);
        
        currentQuestion = nextQuestion;
      } else if (nextIndex >= (questions?.length || 0)) {
        // End session if no more questions
        await supabase
          .from('live_quiz_sessions')
          .update({
            status: 'completed',
            end_time: currentTime.toISOString(),
          })
          .eq('id', session_id);
      }
    }
  }

  return new Response(
    JSON.stringify({
      session,
      players: playersWithAvatars,
      questions: questions || [],
      current_question: currentQuestion,
      needs_advance,
      refreshed_at: new Date().toISOString()
    }),
    { status: 200, headers: corsHeaders }
  );} else if (action === 'get-session-state') {
  const { session_id } = body;

  if (!session_id) {
    return new Response(
      JSON.stringify({ error: 'session_id is required' }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Get session
  const { data: session, error: sessionError } = await supabase
    .from('live_quiz_sessions')
    .select('*')
    .eq('id', session_id)
    .single();

  if (sessionError || !session) {
    return new Response(
      JSON.stringify({ error: 'Session not found' }),
      { status: 404, headers: corsHeaders }
    );
  }

  // Get players
  const { data: players } = await supabase
    .from('live_quiz_players')
    .select('*')
    .eq('session_id', session_id)
    .order('score', { ascending: false });

  const playerIds = (players || []).map((p: any) => p.user_id).filter(Boolean);
  const { data: profiles } = playerIds.length
    ? await supabase
        .from('profiles')
        .select('id, avatar_url')
        .in('id', playerIds)
    : { data: [] };

  // Get all questions
  const { data: questions } = await supabase
    .from('live_quiz_questions')
    .select('*')
    .eq('session_id', session_id)
    .order('question_index');

  // Get all answers
  const { data: answersRaw } = await supabase
    .from('live_quiz_answers')
    .select('*')
    .eq('session_id', session_id);
    
  const answers = (answersRaw || []).map((a: any) => ({
    ...a,
    selected_option: a.answer_index
  }));

  const now = new Date();

  // Check for Scheduled Auto-Start
  if (session.status === 'waiting' && session.scheduled_start_time) {
    const scheduledTime = new Date(session.scheduled_start_time);
    if (now >= scheduledTime) {
      // Auto-start the session
      const { error: startError } = await supabase
        .from('live_quiz_sessions')
        .update({
          status: 'in_progress',
          start_time: now.toISOString(),
        })
        .eq('id', session_id)
        .eq('status', 'waiting'); // Atomic check
      
      if (!startError) {
         session.status = 'in_progress';
         session.start_time = now.toISOString();

         // Start first question immediately
         const firstQuestion = questions?.find(q => q.question_index === 0);
         if (firstQuestion) {
            const timeLimit = firstQuestion.time_limit || 30;
            const endTime = new Date(now.getTime() + timeLimit * 1000);
            
            await supabase
              .from('live_quiz_questions')
              .update({
                start_time: now.toISOString(),
                end_time: endTime.toISOString(),
                status: 'active'
              })
              .eq('id', firstQuestion.id);
            
            // Update local state so it returns properly below
            firstQuestion.start_time = now.toISOString();
            firstQuestion.end_time = endTime.toISOString();
            firstQuestion.status = 'active';
         }
      }
    }
  }

  // Check for auto-advance if session is in progress
  let currentQuestion = null;
  
  if (session.status === 'in_progress') {
    // Find active question
    const activeQuestion = questions?.find(q => 
      q.start_time && (!q.end_time || new Date(q.end_time) > now)
    );
    
    if (activeQuestion) {
      currentQuestion = activeQuestion;
      
      // Check if question should auto-advance
      if (session.advance_mode === 'auto' && activeQuestion.end_time) {
        const endTime = new Date(activeQuestion.end_time);
        if (now > endTime) {
          // Question timed out, auto-advance
          // console.log(`Question ${activeQuestion.id} timed out, auto-advancing...`);
          
          // Mark as completed
          await supabase
            .from('live_quiz_questions')
            .update({
              end_time: now.toISOString(),
              status: 'completed'
            })
            .eq('id', activeQuestion.id);
          
          // Mark unanswered
          await markUnansweredAsIncorrect(supabase, session_id, activeQuestion.id);
          
          // Find next question
          const nextIndex = activeQuestion.question_index + 1;
          const nextQuestion = questions?.find(q => q.question_index === nextIndex);
          
          if (nextQuestion) {
            const timeLimit = nextQuestion.time_limit || 30;
            const nextEndTime = new Date(now.getTime() + timeLimit * 1000);
            
            await supabase
              .from('live_quiz_questions')
              .update({
                start_time: now.toISOString(),
                end_time: nextEndTime.toISOString(),
                status: 'active'
              })
              .eq('session_id', session_id)
              .eq('question_index', nextIndex);
            
            currentQuestion = {
              ...nextQuestion,
              start_time: now.toISOString(),
              end_time: nextEndTime.toISOString(),
              status: 'active'
            };
          } else {
            // No more questions - end session
            await supabase
              .from('live_quiz_sessions')
              .update({
                status: 'completed',
                end_time: now.toISOString(),
              })
              .eq('id', session_id);
          }
        }
      }
    } else {
      // No active question, find pending one
      const pendingQuestion = questions?.find(q => q.status === 'pending');
      if (pendingQuestion && session.advance_mode === 'auto') {
        // Start the pending question
        const timeLimit = pendingQuestion.time_limit || 30;
        const endTime = new Date(now.getTime() + timeLimit * 1000);
        
        await supabase
          .from('live_quiz_questions')
          .update({
            start_time: now.toISOString(),
            end_time: endTime.toISOString(),
            status: 'active'
          })
          .eq('id', pendingQuestion.id);
        
        currentQuestion = {
          ...pendingQuestion,
          start_time: now.toISOString(),
          end_time: endTime.toISOString(),
          status: 'active'
        };
      }
    }
  }

  const playersWithAvatars = (players || []).map((p: any) => {
    const profile = profiles?.find((profileRow: any) => profileRow.id === p.user_id);
    return { ...p, avatar_url: profile?.avatar_url || null };
  });
  return new Response(
    JSON.stringify({
      session,
      players: playersWithAvatars,
      questions: questions || [],
      current_question: currentQuestion,
      answers: answers || [],
    }),
    { status: 200, headers: corsHeaders }
  );}else if (action === 'test') {
      // Simple test endpoint
      return new Response(
        JSON.stringify({ 
          message: 'Live Quiz Edge Function is working!',
          actions: ['create-session', 'join-session', 'start-session', 'submit-answer', 'next-question', 'advance-question-auto', 'check-question-timeout', 'end-session', 'get-session-state']
        }),
        { status: 200, headers: corsHeaders }
      );
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}` }),
        { status: 400, headers: corsHeaders }
      );
    }
  } catch (error: any) {
    // console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
