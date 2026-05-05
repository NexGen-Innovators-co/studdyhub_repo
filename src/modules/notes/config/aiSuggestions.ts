// types/aiSuggestions.ts
export interface AISuggestion {
    id: string;
    label: string;
    actionType: string;
    description: string;
    icon: string;
    trigger: RegExp;
    priority: number;
  }
  
  // constants/aiSuggestions.ts
  export const AI_SUGGESTIONS: AISuggestion[] = [
    {
      id: 'explain-ai',
      label: 'Explain with AI',
      actionType: 'explain',
      description: 'Get detailed explanation',
      icon: '💡',
      trigger: /\b(what is|explain|how does|why|concept|theory|principle)\b/i,
      priority: 1
    },
    {
      id: 'visualize-ai',
      label: 'Create diagram',
      actionType: 'visualize',
      description: 'Generate visual representation',
      icon: '📊',
      trigger: /\b(diagram|chart|graph|flow|process|visual|structure|architecture)\b/i,
      priority: 2
    },
    {
      id: 'example-ai',
      label: 'Show examples',
      actionType: 'example',
      description: 'Add concrete examples',
      icon: '💼',
      trigger: /\b(example|instance|case|sample|demo)\b/i,
      priority: 3
    },
    {
      id: 'compare-ai',
      label: 'Compare concepts',
      actionType: 'compare',
      description: 'Show comparisons',
      icon: '⚖️',
      trigger: /\b(vs|versus|compare|difference|similarity|contrast)\b/i,
      priority: 4
    },
    {
      id: 'simplify-ai',
      label: 'Simplify',
      actionType: 'simplify',
      description: 'Make it simpler',
      icon: '🎯',
      trigger: /\b(complex|difficult|hard|complicated|confusing)\b/i,
      priority: 5
    }
  ];