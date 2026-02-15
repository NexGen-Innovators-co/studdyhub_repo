import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1';
import { createSubscriptionValidator, createErrorResponse } from '../utils/subscription-validator.ts';

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function createInlineContentPrompt(
	selectedText: string, 
	fullNoteContent: string, 
	userProfile: any, 
	actionType: string, 
	customInstruction: string, 
	attachedDocumentContent: string
) {
	let basePrompt = `You are an expert AI writing assistant for a note-taking app. Your job is to help users edit, expand, summarize, or rewrite selected text in their notes, following the user's intent and context.

USER PROFILE:
- Learning Style: ${userProfile?.learning_style || 'balanced'}
- Preferred Explanation Style: ${userProfile?.learning_preferences?.explanation_style || 'balanced'}

TASK: ${actionType}
`;

	// Detect if user wants a diagram
	let diagramRequested = false;
	const diagramKeywords = /\b(diagram|mermaid|flowchart|create\s+(?:a\s+)?chart|draw\s+(?:a\s+)?graph|visualization|visualize|uml|sequence\s+diagram|class\s+diagram|entity\s+relationship|mind\s+map)\b/i;
	
	if (customInstruction && customInstruction.trim()) {
		basePrompt += `\n\nCUSTOM USER INSTRUCTION (IMPORTANT - FOLLOW THIS CAREFULLY):\n${customInstruction}`;
		// console.log('[createPrompt] Custom instruction added to prompt');
		
		if (diagramKeywords.test(customInstruction)) {
			diagramRequested = true;
			// console.log('[createPrompt] Diagram requested via custom instruction');
		}
	}
	
	// Also check if the action type itself suggests visualization
	if (actionType === 'visualize' || actionType === 'diagram') {
		diagramRequested = true;
		// console.log('[createPrompt] Diagram requested via action type');
	}

	if (attachedDocumentContent && attachedDocumentContent.trim()) {
		basePrompt += `\nATTACHED DOCUMENT CONTEXT:\n${attachedDocumentContent.slice(0, 8000)}`;
	}

	basePrompt += `\n\nSELECTED TEXT:\n"""${selectedText}"""\n\nNOTE CONTEXT (for reference):\n"""${fullNoteContent.slice(0, 15000)}"""`;

	basePrompt += `\n\nRESPONSE INSTRUCTIONS:`;
	
	if (diagramRequested) {
		basePrompt += `\n- IMPORTANT: Generate a valid, working diagram that can be rendered.`;
		basePrompt += `\n- For Mermaid diagrams, use this EXACT format (including the backticks and language identifier):`;
		basePrompt += `\n\`\`\`mermaid`;
		basePrompt += `\ngraph TD`;
		basePrompt += `\n    A[Start] --> B[Process]`;
		basePrompt += `\n    B --> C[End]`;
		basePrompt += `\n\`\`\``;
		basePrompt += `\n- For Chart.js diagrams, use this EXACT format:`;
		basePrompt += `\n\`\`\`chartjs`;
		basePrompt += `\n{`;
		basePrompt += `\n  "type": "bar",`;
		basePrompt += `\n  "data": {`;
		basePrompt += `\n    "labels": ["Label 1", "Label 2"],`;
		basePrompt += `\n    "datasets": [{`;
		basePrompt += `\n      "label": "Dataset",`;
		basePrompt += `\n      "data": [10, 20]`;
		basePrompt += `\n    }]`;
		basePrompt += `\n  }`;
		basePrompt += `\n}`;
		basePrompt += `\n\`\`\``;
		basePrompt += `\n- CRITICAL: Keep the backticks and language identifiers (mermaid, chartjs, dot) exactly as shown.`;
		basePrompt += `\n- Do NOT add any text before or after the code block.`;
		basePrompt += `\n- Make sure the diagram syntax is 100% valid and will render without errors.`;
		basePrompt += `\n- Return ONLY the diagram code block, nothing else.`;
	} else {
		basePrompt += `\n- Return ONLY the generated content that should replace the selected text.`;
		basePrompt += `\n- Do NOT wrap your response in markdown code blocks unless specifically generating code.`;
		basePrompt += `\n- Do NOT repeat the prompt or selected text.`;
		basePrompt += `\n- Do NOT add explanations or preambles.`;
		
		if (actionType === 'summarize') {
			basePrompt += `\n- Create a concise, clear summary that captures the key points.`;
		} else if (actionType === 'expand' || actionType === 'elaborate') {
			basePrompt += `\n- Add detailed explanations, examples, and context.`;
			basePrompt += `\n- Make the content richer and more comprehensive.`;
		} else if (actionType === 'rephrase' || actionType === 'rewrite') {
			basePrompt += `\n- Rephrase for improved clarity, tone, or style.`;
			basePrompt += `\n- Maintain the original meaning while improving expression.`;
		} else if (actionType === 'simplify') {
			basePrompt += `\n- Use simpler language and shorter sentences.`;
			basePrompt += `\n- Make the content easier to understand.`;
		} else if (actionType === 'explain') {
			basePrompt += `\n- Provide a clear, detailed explanation of the concept.`;
			basePrompt += `\n- Break down complex ideas into understandable parts.`;
		} else if (actionType === 'example') {
			basePrompt += `\n- Provide concrete, practical examples.`;
			basePrompt += `\n- Show real-world applications or use cases.`;
		} else if (actionType === 'analyze') {
			basePrompt += `\n- Examine the content critically and provide insights.`;
			basePrompt += `\n- Discuss strengths, weaknesses, and implications.`;
		} else if (actionType === 'compare') {
			basePrompt += `\n- Compare and contrast different aspects or alternatives.`;
			basePrompt += `\n- Highlight similarities and differences.`;
		}
		
		basePrompt += `\n- Be helpful, clear, and concise.`;
		basePrompt += `\n- Match the user's learning style and preferences.`;
		basePrompt += `\n- Do NOT generate diagrams, flowcharts, mermaid code blocks, or chart code blocks unless the user explicitly asks for them in their custom instruction.`;
		basePrompt += `\n- Focus on providing clear, well-structured TEXT content only.`;
	}

	return basePrompt;
}

async function generateInlineContentWithGemini(prompt: string): Promise<string> {
	const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
	if (!geminiApiKey) throw new Error('Gemini API key not configured');

	const genAI = new GoogleGenerativeAI(geminiApiKey);
	const model = genAI.getGenerativeModel({
		model: 'gemini-2.0-flash',
		generationConfig: {
			temperature: 0.7,
			topP: 0.9,
			topK: 40,
			maxOutputTokens: 2048
		}
	});

	const result = await model.generateContent(prompt);
	const response = await result.response;
	let aiContent = await response.text();

	// Clean up the response intelligently
	aiContent = aiContent.trim();
	
	// Check if this is a diagram response (contains code blocks for diagrams)
	const hasDiagramBlock = /```(?:mermaid|chartjs|dot)/.test(aiContent);
	
	if (hasDiagramBlock) {
		// For diagrams, preserve the code blocks but remove any wrapper
		// Remove outer markdown wrapper if AI added one
		if (aiContent.startsWith('```markdown') || aiContent.startsWith('```md')) {
			aiContent = aiContent.replace(/^```(?:markdown|md)\n/, '').replace(/```$/, '').trim();
		}
		// Keep the diagram code blocks intact
		// console.log('[generate-inline-content] Diagram detected, preserving code blocks');
	} else {
		// For regular text, remove any unnecessary markdown wrappers
		// but preserve intentional code blocks (for actual code examples)
		if (aiContent.startsWith('```') && aiContent.endsWith('```')) {
			// Check if this is a wrapper around the entire response
			const lines = aiContent.split('\n');
			if (lines.length > 2 && lines[0].startsWith('```') && lines[lines.length - 1] === '```') {
				// Remove the wrapper
				aiContent = lines.slice(1, -1).join('\n').trim();
			}
		}
	}

	return aiContent;
}

serve(async (req) => {
	// console.log('[generate-inline-content] Incoming request:', req.method);

	if (req.method === 'OPTIONS') {
		// console.log('[generate-inline-content] OPTIONS preflight');
		return new Response('ok', { headers: CORS_HEADERS });
	}

	if (req.method !== 'POST') {
		// console.warn('[generate-inline-content] Method not allowed:', req.method);
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
		});
	}

	try {
		const body = await req.json();
		// console.log('[generate-inline-content] Request body keys:', Object.keys(body));
		// console.log('[generate-inline-content] Action type:', body.actionType);
		// console.log('[generate-inline-content] Custom instruction:', body.customInstruction || '(none)');
		// console.log('[generate-inline-content] Custom instruction length:', (body.customInstruction || '').length);

		const { 
			selectedText, 
			fullNoteContent, 
			userProfile, 
			actionType, 
			customInstruction, 
			attachedDocumentContent, 
			selectionRange 
		} = body;

		if (!selectedText || !selectedText.trim()) {
			// console.warn('[generate-inline-content] Missing selectedText');
			return createErrorResponse('Selected text is required', 400);
		}

		if (!userProfile || !userProfile.id) {
			// console.warn('[generate-inline-content] Missing userProfile or userProfile.id');
			return createErrorResponse('User profile is required', 400);
		}

		// Validate AI message limit
		const validator = createSubscriptionValidator();
		const limitCheck = await validator.checkAiMessageLimit(userProfile.id);
		// console.log('[generate-inline-content] AI message limit check:', limitCheck);

		if (!limitCheck.allowed) {
			// console.warn('[generate-inline-content] AI message limit exceeded:', limitCheck.message);
			return createErrorResponse(limitCheck.message || 'AI generation limit exceeded', 403);
		}

		// Compose prompt
		const prompt = createInlineContentPrompt(
			selectedText, 
			fullNoteContent, 
			userProfile, 
			actionType, 
			customInstruction || '', 
			attachedDocumentContent || ''
		);
		// console.log('[generate-inline-content] Generated prompt length:', prompt.length);
		// console.log('[generate-inline-content] Action type:', actionType);
		// console.log('[generate-inline-content] Custom instruction:', customInstruction);

		// Generate content
		let generatedContent = '';
		try {
			generatedContent = await generateInlineContentWithGemini(prompt);
			// console.log('[generate-inline-content] AI generated content length:', generatedContent.length);
			// console.log('[generate-inline-content] Content preview:', generatedContent.slice(0, 200));
		} catch (aiError) {
			// console.error('[generate-inline-content] AI generation failed:', aiError);
			return new Response(JSON.stringify({ 
				error: 'AI generation failed', 
				details: aiError instanceof Error ? aiError.message : 'Unknown error' 
			}), {
				status: 500,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		}

		// Validate the generated content
		if (!generatedContent || !generatedContent.trim()) {
			// console.error('[generate-inline-content] Empty content generated');
			return createErrorResponse('AI generated empty content', 500);
		}

		// Return result
		// console.log('[generate-inline-content] Returning result successfully');
		return new Response(JSON.stringify({ generatedContent }), {
			status: 200,
			headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
		});

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		// console.error('[generate-inline-content] Unexpected error:', errorMessage);
		// console.error('[generate-inline-content] Error stack:', error instanceof Error ? error.stack : 'No stack');
		
		return new Response(JSON.stringify({ 
			error: 'Failed to generate inline content', 
			details: errorMessage 
		}), {
			status: 500,
			headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
		});
	}
});
