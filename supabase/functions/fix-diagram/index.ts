import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.24.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DiagramFixRequest {
  diagramType: 'mermaid' | 'html' | 'code';
  originalContent: string;
  errorMessage: string;
  userProfile: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      diagramType, 
      originalContent, 
      errorMessage, 
      userProfile 
    }: DiagramFixRequest = await req.json()

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found')
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const systemPrompt = `You are an expert diagram and code fixing assistant. Your task is to analyze and fix broken diagrams/code.

**Your Role:**
- Identify and fix syntax errors, rendering issues, and structural problems
- Provide clear explanations of what was wrong and how you fixed it
- Offer preventive suggestions for future use

**Diagram Types:**
- **Mermaid**: Fix syntax errors, node connections, special characters, diagram structure
- **HTML**: Fix security issues, broken tags, CSS problems, JavaScript errors
- **Code**: Fix syntax errors, missing brackets/semicolons, formatting issues

**Output Format:**
Respond with a JSON object containing:
{
  "fixedContent": "The corrected content",
  "explanation": "Clear explanation of what was fixed",
  "suggestions": ["Array of preventive suggestions"]
}

**Guidelines:**
- Preserve the original intent and structure as much as possible
- Make minimal necessary changes to fix the issue
- Provide educational explanations
- Suggest best practices for prevention
- If unable to fix, explain why and suggest alternatives`

    const userPrompt = `Please fix this ${diagramType} content that has an error:

**Error Message:** ${errorMessage}

**Original Content:**
\`\`\`${diagramType}
${originalContent}
\`\`\`

**User Learning Style:** ${userProfile?.learning_style || 'balanced'}

Please analyze the error and provide a fixed version with explanation and suggestions.`

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt }
    ])

    const response = await result.response
    const text = response.text()

    // Try to parse as JSON
    let fixResult;
    try {
      fixResult = JSON.parse(text)
    } catch (parseError) {
      // If not valid JSON, create a structured response
      fixResult = {
        fixedContent: originalContent, // Return original if we can't parse
        explanation: "I analyzed the content but had trouble providing a structured fix. Please try the manual suggestions below.",
        suggestions: [
          "Check for syntax errors and typos",
          "Ensure proper formatting and indentation", 
          "Verify all brackets and quotes are balanced",
          "Test with simpler versions first"
        ]
      }
    }

    // Validate the response structure
    if (!fixResult.fixedContent) {
      fixResult.fixedContent = originalContent
    }
    if (!fixResult.explanation) {
      fixResult.explanation = "Unable to provide specific fix explanation"
    }
    if (!Array.isArray(fixResult.suggestions)) {
      fixResult.suggestions = ["Try checking the documentation for proper syntax"]
    }

    return new Response(
      JSON.stringify(fixResult),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in fix-diagram function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        fixedContent: '', 
        explanation: 'Unable to process fix request',
        suggestions: ['Please try again or check the content manually']
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})