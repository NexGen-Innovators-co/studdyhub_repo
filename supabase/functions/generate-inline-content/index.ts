import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1';
import { createSubscriptionValidator, createErrorResponse as createSubErrorResponse } from '../utils/subscription-validator.ts';
// Constants
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const MAX_TEXT_LENGTH = 50000; // Prevent excessively long inputs
const MAX_CUSTOM_INSTRUCTION_LENGTH = 1000;
// Visual content detection patterns
const VISUAL_PATTERNS = {
  chart: /\b(chart|graph|plot|visualization|data|statistics|trend|comparison)\b/i,
  flowchart: /\b(process|workflow|steps|flow|procedure|algorithm|decision)\b/i,
  diagram: /\b(diagram|architecture|structure|relationship|connection|network)\b/i,
  timeline: /\b(timeline|history|chronology|sequence|events|progression)\b/i,
  mindmap: /\b(mindmap|mind map|concepts|brainstorm|ideas|branches)\b/i,
  table: /\b(table|comparison|versus|vs|compare|data|list|features)\b/i
};
// Enhanced prompt creation with visual content support
const createInlinePrompt = (
  selectedText: string,
  fullNoteContent: string,
  userProfile: any,
  actionType: string,
  customInstruction: string = ''
) => {
  const { learning_style = 'balanced', learning_preferences = {} } = userProfile || {};
  const { explanation_style = 'balanced', examples, difficulty = 'intermediate' } = learning_preferences || {};

  // Normalize text for reliable matching
  const normalizedSelected = selectedText.trim();
  const selectionIndex = fullNoteContent.indexOf(normalizedSelected);

  // Extract surrounding context (500 chars before/after) — helps AI understand flow
  const beforeContext = selectionIndex > 0
    ? fullNoteContent.slice(Math.max(0, selectionIndex - 500), selectionIndex)
    : '«START OF NOTE»';

  const afterContext = selectionIndex !== -1
    ? fullNoteContent.slice(selectionIndex + normalizedSelected.length, selectionIndex + normalizedSelected.length + 500)
    : '«END OF NOTE»';

  // Precise action instructions
  const actionInstructions = {
    expand: `Expand this section with more depth, examples, explanations, and details. Make it flow naturally with the surrounding content. Preserve the original tone, style, and formatting.`,
    summarize: `Replace the selected text with a concise, accurate summary that captures all key ideas in significantly fewer words. Keep it clear and integrated with the note's flow.`,
    rephrase: `Rewrite the selected text for better clarity, flow, or professionalism. Keep the exact same meaning and similar length. Match the tone and style of the surrounding note perfectly.`,
    explain: `Provide a clear, educational explanation of the selected concept. Break it down using analogies, examples, or step-by-step reasoning suited to the user's learning style.`,
    simplify: `Rewrite the selected text using simple, clear language. Eliminate jargon. Make it easy to understand while preserving all meaning.`,
    elaborate: `Greatly expand the selected section with comprehensive details, real-world examples, implications, and supporting explanations. Maintain logical flow with the rest of the note.`,
    example: `Add 1–3 concrete, relevant examples that illustrate the selected concept clearly. Insert them naturally within or after the selection.`,
    visualize: `Create a visual representation (Chart.js, Mermaid diagram, or table) that clearly illustrates the selected content. Include a brief caption explaining it.`,
    analyze: `Analyze the selected content deeply: break down components, discuss implications, strengths, weaknesses, and real-world relevance.`,
    compare: `Compare the concepts in the selected text with related ideas, showing similarities, differences, advantages, and trade-offs.`,
    question: `Generate 3–5 thoughtful, high-quality questions about the selected text to promote deeper understanding and critical thinking.`,
    default: `Improve or transform the selected text according to the user's request while ensuring it fits perfectly into the existing note structure and tone.`
  };

  const instruction = actionInstructions[actionType] || actionInstructions.default;

  return `You are an expert note-taking AI that performs precise inline edits.

CRITICAL RULES — FOLLOW EXACTLY:
- You are editing ONE specific section inside a larger note
- Return ONLY the new version of the selected text
- NEVER rewrite the entire note
- NEVER add introductions like "Here is your summary", "Expanded version:", or explanations outside the content
- NEVER wrap your response in \`\`\`markdown, \`\`\`md, \`\`\`text, or any code block
- NEVER use fenced code blocks unless explicitly creating a diagram (chartjs, mermaid, dot)
- Output raw, clean Markdown text directly — ready to insert
- Match the exact tone, style, formatting, and voice of the original note

USER LEARNING PROFILE:
- Learning Style: ${learning_style}
- Explanation Style: ${explanation_style}
- Include Examples: ${examples ? 'Yes' : 'Only if requested'}
- Difficulty Level: ${difficulty}

TASK:
${instruction}

${customInstruction ? `USER'S SPECIFIC INSTRUCTIONS:\n${customInstruction.trim()}\n` : ''}

CONTEXT — What comes BEFORE the selected text:
"""
${beforeContext.trim()}
"""

SELECTED TEXT (this must be replaced or enhanced):
"""
${normalizedSelected}
"""

CONTEXT — What comes AFTER the selected text:
"""
${afterContext.trim()}
"""

Now return ONLY the improved version of the selected text in clean Markdown. No fences. No extra text. No explanations. Just the content.`;
};
// Enhanced error response helper
const createErrorResponse = (error, status, code, details)=>{
  const errorBody = {
    error,
    code,
    details
  };
  console.error(`Edge function error [${status}]:`, {
    error,
    code,
    details
  });
  return new Response(JSON.stringify(errorBody), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json'
    }
  });
};
// Input validation helper
const validateRequestBody = (body)=>{
  const { selectedText, fullNoteContent, userProfile, actionType, customInstruction } = body;
  if (!selectedText?.trim()) {
    throw new Error('Selected text is required and cannot be empty');
  }
  if (selectedText.length > MAX_TEXT_LENGTH) {
    throw new Error(`Selected text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`);
  }
  if (!fullNoteContent?.trim()) {
    throw new Error('Full note content is required');
  }
  if (!userProfile || typeof userProfile !== 'object') {
    throw new Error('Valid user profile is required');
  }
  if (!actionType?.trim()) {
    throw new Error('Action type is required');
  }
  if (customInstruction && customInstruction.length > MAX_CUSTOM_INSTRUCTION_LENGTH) {
    throw new Error(`Custom instruction exceeds maximum length of ${MAX_CUSTOM_INSTRUCTION_LENGTH} characters`);
  }
  return {
    selectedText,
    fullNoteContent,
    userProfile,
    actionType,
    customInstruction
  };
};
serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: CORS_HEADERS
    });
  }
  // Only allow POST requests
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED', req.method);
  }
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing');
    }
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') || ''
        }
      }
    });
    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError) {
      return createErrorResponse('Authentication failed', 401, 'AUTH_ERROR', authError.message);
    }
    if (!user) {
      return createErrorResponse('Unauthorized - valid authentication required', 401, 'UNAUTHORIZED', authError);
    }

    // Check AI generation limit
    const validator = createSubscriptionValidator();
    const limitCheck = await validator.checkAiMessageLimit(user.id);
    
    if (!limitCheck.allowed) {
      return createSubErrorResponse(limitCheck.message || 'AI generation limit exceeded', 403);
    }

    // Parse and validate request body
    let requestBody;
    try {
      const rawBody = await req.json();
      requestBody = validateRequestBody(rawBody);
    } catch (parseError) {
      return createErrorResponse('Invalid request body', 400, 'VALIDATION_ERROR', parseError instanceof Error ? parseError.message : 'Unknown validation error');
    }
    // Check Gemini API key
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }
    // Create AI prompt
    const prompt = createInlinePrompt(requestBody.selectedText, requestBody.fullNoteContent, requestBody.userProfile, requestBody.actionType, requestBody.customInstruction);
    // Initialize Gemini AI with error handling
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 678907
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        }
      ]
    });
    // Generate content with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(()=>controller.abort(), 30000); // 30 second timeout
    try {
      const result = await model.generateContent(prompt);
      clearTimeout(timeoutId);
      const response = await result.response;
      const aiContent = response.text();
      if (!aiContent?.trim()) {
        throw new Error('AI generated empty response');
      }
      // Log successful generation (optional, for monitoring)
      console.log(`AI generation successful for user ${user.id}, action: ${requestBody.actionType}`);
      return new Response(JSON.stringify({
        generatedContent: aiContent,
        actionType: requestBody.actionType,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      });
    } catch (aiError) {
      clearTimeout(timeoutId);
      if (aiError instanceof Error && aiError.name === 'AbortError') {
        return createErrorResponse('AI generation timeout', 408, 'TIMEOUT_ERROR', aiError);
      }
      throw aiError; // Re-throw for general error handling
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error';
    const errorCode = error instanceof Error && error.name ? error.name : 'INTERNAL_ERROR';
    return createErrorResponse('Internal server error occurred', 500, errorCode, errorMessage);
  }
});
