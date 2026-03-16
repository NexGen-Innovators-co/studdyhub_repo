import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import {
  BookOpen,
  FileText,
  Lightbulb,
  ListChecks,
  Brain,
  Plus,
} from 'lucide-react';

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  content: string; // Markdown content template
  category: string; // Allow any custom category
}

export const TEMPLATES: NoteTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Note',
    description: 'Start with an empty page',
    icon: <Plus className="h-6 w-6" />,
    content: '',
    category: 'general',
  },
  {
    id: 'lecture',
    name: 'Lecture Notes',
    description: 'Structured for classroom notes',
    icon: <BookOpen className="h-6 w-6" />,
    content: `# Lecture Title

## Key Points
- 
- 
- 

## Important Definitions
- 

## Questions/Clarifications
- 

## Summary
`,
    category: 'general',
  },
  {
    id: 'study-guide',
    name: 'Study Guide',
    description: 'For exam preparation',
    icon: <FileText className="h-6 w-6" />,
    content: `# Study Guide

## Chapter/Topic: 

### Definitions
- 

### Key Concepts
1. 
2. 
3. 

### Practice Problems
- 

### Common Mistakes to Avoid
- 

### Review Checklist
- [ ] Understand all definitions
- [ ] Complete practice problems
- [ ] Review with study group
`,
    category: 'general',
  },
  {
    id: 'quick-thoughts',
    name: 'Quick Thoughts',
    description: 'Capture ideas and insights',
    icon: <Lightbulb className="h-6 w-6" />,
    content: `# Quick Thoughts

**Date:** ${new Date().toLocaleDateString()}

## Ideas
- 

## Insights
- 

## Action Items
- [ ] 
`,
    category: 'general',
  },
  {
    id: 'reading-notes',
    name: 'Reading Notes',
    description: 'Summarize what you read',
    icon: <ListChecks className="h-6 w-6" />,
    content: `# Reading Notes

## Book/Article: 
## Author: 

## Main Ideas
- 

## Key Takeaways
- 

## Quotes to Remember
> 

## Personal Reflections
- 

## Related Concepts
- 
`,
    category: 'general',
  },
  {
    id: 'mind-map',
    name: 'Mind Map Notes',
    description: 'Brainstorm with connections',
    icon: <Brain className="h-6 w-6" />,
    content: `# Mind Map: 

## Central Idea
(What's the main topic?)

## Branch 1: 
- Sub-point
- Sub-point

## Branch 2: 
- Sub-point
- Sub-point

## Branch 3: 
- Sub-point
- Sub-point

## Connections
(How do these branches relate?)
`,
    category: 'general',
  },
];

interface NotesTemplatePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: NoteTemplate) => void;
}

export const NotesTemplatePickerDialog: React.FC<NotesTemplatePickerDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle className="text-2xl">Choose a Note Template</DialogTitle>
          <DialogDescription>
            Start with a template structure or create a blank note from scratch
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className="group relative p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200 hover:shadow-md text-left"
            >
              <div className="flex items-start gap-3">
                <div className="text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-200">
                  {template.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {template.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
