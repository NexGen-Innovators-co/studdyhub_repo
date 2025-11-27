// tutorialConfigs.ts
import { Brain, FileText, MessageSquare, Calendar, Upload } from 'lucide-react';
import { TutorialConfig } from '../components/UniversalTutorial';

export const getNoteEditorTutorial = (isMobile: boolean): TutorialConfig => ({
  id: 'note-editor',
  name: 'Note Editor Guide',
  description: 'Learn how to use the powerful note editor',
  icon: MessageSquare as any,
  showProgress: true,
  completionMessage: "You're now a note-taking pro! Start creating amazing notes.",
  steps: [
    {
      id: 'welcome',
      title: '👋 Welcome to Your Smart Note Editor!',
      description: 'This is your AI-powered note-taking workspace with advanced features for students and professionals.',
      position: 'center',
      tips: [
        'All changes save automatically',
        'Works offline and syncs when online',
        'Supports markdown, diagrams, and AI assistance',
      ],
    },
    {
      id: 'formatting',
      title: '🎨 Rich Text Formatting',
      description: isMobile
        ? 'Tap the formatting icons to style your text. Use the more options menu for advanced formatting.'
        : 'Use the toolbar to format your text with bold, italics, headings, lists, and more.',
      elementSelector: '.ProseMirror',
      position: 'top',
      highlightPadding: 12,
      keyboardShortcuts: isMobile ? [] : [
        { keys: 'Ctrl + B', action: 'Bold' },
        { keys: 'Ctrl + I', action: 'Italic' },
        { keys: 'Ctrl + U', action: 'Underline' },
      ],
      tips: ['Try typing and formatting as you go', 'Headings help organize long notes'],
    },
    {
      id: 'ai-assistant',
      title: '✨ AI Writing Assistant',
      description: isMobile
        ? 'Select text and tap the sparkle icon to rewrite, expand, summarize, or translate with AI.'
        : 'Select any text and click the sparkle icon to rewrite, expand, summarize, or translate.',
      elementSelector: "[title='AI Assist'], button:has(.lucide-sparkles)",
      position: 'bottom',
      highlightPadding: 8,
      tips: [
        'Improves writing quality instantly',
        'Supports multiple languages',
        'Great for summarizing long passages',
      ],
    },
    {
      id: 'flashcards',
      title: '🧠 Auto-Generate Flashcards',
      description: 'Turn your notes into study flashcards with one click. Perfect for exam prep!',
      elementSelector: "button:has(.lucide-brain), [class*='bg-gradient-to-r'][class*='from-blue-600']",
      position: isMobile ? 'bottom' : 'left',
      highlightPadding: 8,
      tips: ['Creates question-answer pairs', 'Review anytime', 'Boosts retention'],
    },
    {
      id: 'diagrams',
      title: '📊 Insert Diagrams & Charts',
      description: isMobile
        ? 'Tap the more options menu (⋮) to insert charts, flowcharts, and graphs.'
        : 'Add interactive charts, flowcharts, and graphs using Chart.js, Mermaid, and Graphviz.',
      elementSelector: isMobile 
        ? "[title='More Options']" 
        : "[title='Insert Chart']",
      position: 'bottom',
      highlightPadding: 8,
      tips: ['Perfect for visual learners', 'Supports multiple diagram types', 'Edit anytime'],
      actions: isMobile ? [
        {
          label: 'Show Diagram Options',
          onClick: () => {
            const mobileMenuBtn = document.querySelector("[title='More Options']");
            if (mobileMenuBtn) (mobileMenuBtn as HTMLElement).click();
          }
        }
      ] : undefined
    },
    {
      id: 'uploads',
      title: '📤 Upload Documents & Audio',
      description: 'Upload PDFs, Word docs, or audio recordings to automatically generate notes using AI.',
      elementSelector: isMobile
        ? "[title='More Options']"
        : "[title='Upload Document']",
      position: 'bottom',
      highlightPadding: 8,
      tips: ['Supports PDF, DOCX, TXT, MP3', 'AI extracts key information', 'Saves time on note-taking'],
      actions: isMobile ? [
        {
          label: 'Show Upload Options',
          onClick: () => {
            const mobileMenuBtn = document.querySelector("[title='More Options']");
            if (mobileMenuBtn) (mobileMenuBtn as HTMLElement).click();
          }
        }
      ] : undefined
    },
    {
      id: 'tts',
      title: '🔊 Text-to-Speech',
      description: 'Listen to your notes aloud. Great for proofreading or learning on the go.',
      elementSelector: "[title='Text to Speech'], .lucide-volume-2",
      position: 'bottom',
      highlightPadding: 8,
      tips: ['Multiple voice options', 'Adjust speed', 'Learn while multitasking'],
    },
    {
      id: 'export',
      title: '💾 Export & Share',
      description: 'Download your notes as PDF, Markdown, HTML, or Word documents.',
      elementSelector: isMobile
        ? "[title='More Options']"
        : "[title='Download Markdown']",
      position: 'bottom',
      highlightPadding: 8,
      tips: ['Keep backups', 'Share with others', 'Print for offline use'],
      actions: isMobile ? [
        {
          label: 'Show Export Options',
          onClick: () => {
            const mobileMenuBtn = document.querySelector("[title='More Options']");
            if (mobileMenuBtn) (mobileMenuBtn as HTMLElement).click();
          }
        }
      ] : undefined
    },
  ],
});