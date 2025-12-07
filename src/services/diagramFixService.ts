import { supabase } from '../integrations/supabase/client';
import { UserProfile } from '../types';

export interface DiagramFixRequest {
  diagramType: 'mermaid' | 'html' | 'code';
  originalContent: string;
  errorMessage: string;
  userProfile: UserProfile;
}

export interface DiagramFixResponse {
  fixedContent: string;
  explanation: string;
  suggestions: string[];
}

export const fixDiagram = async (request: DiagramFixRequest): Promise<DiagramFixResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('fix-diagram', {
      body: {
        diagramType: request.diagramType,
        originalContent: request.originalContent,
        errorMessage: request.errorMessage,
        userProfile: request.userProfile,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to fix diagram');
    }

    return {
      fixedContent: data.fixedContent || request.originalContent,
      explanation: data.explanation || 'Unable to provide a specific fix explanation.',
      suggestions: data.suggestions || ['Try simplifying the content', 'Check for syntax errors']
    };
  } catch (error) {
    //console.error('Error fixing diagram:', error);

    // Fallback fixes based on diagram type
    return generateFallbackFix(request);
  }
};

const generateFallbackFix = (request: DiagramFixRequest): DiagramFixResponse => {
  const { diagramType, originalContent, errorMessage } = request;

  let fixedContent = originalContent;
  let explanation = '';
  let suggestions: string[] = [];

  switch (diagramType) {
    case 'mermaid':
      // Common Mermaid fixes
      if (errorMessage.includes('syntax') || errorMessage.includes('parse')) {
        fixedContent = fixMermaidSyntax(originalContent);
        explanation = 'Applied common Mermaid syntax fixes';
        suggestions = [
          'Ensure proper node connections',
          'Check for special character escaping',
          'Verify diagram type syntax'
        ];
      }
      break;

    case 'html':
      // Common HTML fixes
      if (errorMessage.includes('script') || errorMessage.includes('security')) {
        fixedContent = sanitizeHtml(originalContent);
        explanation = 'Removed potentially problematic scripts and sanitized HTML';
        suggestions = [
          'Use inline styles instead of external scripts',
          'Avoid complex JavaScript interactions',
          'Use standard HTML elements'
        ];
      }
      break;

    case 'code':
      // Common code fixes
      fixedContent = fixCodeSyntax(originalContent);
      explanation = 'Applied basic syntax corrections';
      suggestions = [
        'Check for missing semicolons or brackets',
        'Verify proper indentation',
        'Ensure proper variable declarations'
      ];
      break;
  }

  return { fixedContent, explanation, suggestions };
};

const fixMermaidSyntax = (content: string): string => {
  let fixed = content;

  // Fix common issues
  fixed = fixed.replace(/[""]/g, '"'); // Replace smart quotes
  fixed = fixed.replace(/'/g, "'"); // Replace smart apostrophes
  fixed = fixed.replace(/–/g, '-'); // Replace en-dash with hyphen
  fixed = fixed.replace(/—/g, '--'); // Replace em-dash with double hyphen

  // Ensure proper spacing around arrows
  fixed = fixed.replace(/([A-Za-z0-9])(-->|->)([A-Za-z0-9])/g, '$1 $2 $3');

  // Fix node IDs with spaces
  fixed = fixed.replace(/\[([^\]]*)\s+([^\]]*)\]/g, '["$1 $2"]');

  return fixed;
};

const sanitizeHtml = (content: string): string => {
  // Remove potentially problematic elements
  let fixed = content;

  // Remove script tags
  fixed = fixed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers
  fixed = fixed.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Remove dangerous attributes
  fixed = fixed.replace(/\s*(javascript:|data:)[^"'\s>]*/gi, '');

  return fixed;
};

const fixCodeSyntax = (content: string): string => {
  let fixed = content;

  // Add missing semicolons at end of lines (JavaScript-like)
  fixed = fixed.replace(/^(\s*)([^;\s{}]+)(\s*)$/gm, '$1$2;$3');

  // Fix common quote issues
  fixed = fixed.replace(/[""]/g, '"');
  fixed = fixed.replace(/'/g, "'");

  return fixed;
};