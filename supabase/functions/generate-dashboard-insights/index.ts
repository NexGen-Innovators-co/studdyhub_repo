import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1';

// CORS headers for browser access
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { stats, userProfile } = await req.json();

    if (!stats) {
      throw new Error('Missing stats data');
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Server configuration error: GEMINI_API_KEY not set');
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

    const prompt = `
      You are an AI study coach analyzing a student's dashboard statistics.
      Based on the provided metrics, generate 3-5 personalized, actionable, and encouraging insights.
      
      USER STATS:
      ${JSON.stringify(stats, null, 2)}
      
      USER PROFILE:
      ${JSON.stringify(userProfile || {}, null, 2)}
      
      OUTPUT REQUIREMENTS:
      - Return ONLY a valid JSON array.
      - Each item in the array must be an object with the following fields:
        - "title": Short, catchy headline (e.g., "Morning Momentum", "Streak Risk").
        - "message": A 1-2 sentence friendly observation or tip.
        - "type": One of "success", "achievement" (green), "warning", "wellness" (yellow), "error", "risk" (red), "tip", "strategy" (purple), or "productivity" (blue).
        - "iconName": A suggested Lucid React icon name (e.g., "Flame", "Clock", "Trophy", "Brain", "Coffee", "Zap", "Target", "TrendingUp", "Lightbulb", "RefreshCw").
        - "action": Optional. A short text action button. To function correctly, it MUST contain one of these keywords based on the intended action:
            - To create a new schedule item: Use "Schedule" (e.g., "Schedule Session")
            - To create a note: Use "Note" or "Write" (e.g., "Write new note")
            - To start recording: Use "Recording" (e.g., "Start Recording")
            - To upload a document: Use "Upload" or "Document" (e.g., "Upload PDF")
            - To view notes: Use "Review" or "Read" (e.g., "Review Notes")
            - To go to quizzes: Use "Quiz" or "Test" (e.g., "Take a Quiz")
        
      TONE:
      - Supportive, slight gamification flavor, concise.
      - If stats are low or empty, be encouraging about starting.
      - If streak is broken, suggest restarting.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Clean up markdown code blocks if Gemini returns them
    const cleanJson = text.replace(/```json|```/g, '').trim();
    
    let insights = [];
    try {
        insights = JSON.parse(cleanJson);
    } catch (e) {
        console.error("Failed to parse JSON:", cleanJson);
        // Fallback to a single error insight if parsing fails
        insights = [{
            title: "Analysis Update",
            message: "We're calibrating your personalized insights. Check back after your next study session!",
            type: "info",
            iconName: "Bot"
        }];
    }

    return new Response(JSON.stringify({ insights }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-dashboard-insights:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }
    );
  }
});
