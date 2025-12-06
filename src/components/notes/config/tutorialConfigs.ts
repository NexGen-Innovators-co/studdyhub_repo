// ============================================
// UPDATED TUTORIAL CONFIGURATIONS
// ============================================
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
      title: ' Welcome to Your Smart Note Editor!',
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
      title: ' Rich Text Formatting',
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
      title: ' AI Writing Assistant',
      description: isMobile
        ? 'Select text and tap the sparkle icon to rewrite, expand, summarize, or translate with AI.'
        : 'Select any text and click the sparkle icon to rewrite, expand, summarize, or translate.',
      elementSelector: isMobile
        ? "button:has(svg.lucide-sparkles)"
        : "button[title='AI Assist']",
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
      title: ' Auto-Generate Flashcards',
      description: isMobile
        ? 'Tap the Brain icon to generate flashcards from your notes. Perfect for exam prep!'
        : 'Click the Brain icon to turn your notes into study flashcards. Perfect for exam prep!',
      elementSelector: "button:has(svg.lucide-brain)",
      position: isMobile ? 'top' : 'left',
      highlightPadding: 8,
      tips: ['Creates question-answer pairs', 'Review anytime', 'Boosts retention'],
      actions: [
        {
          label: 'Open Flashcards Menu',
          onClick: () => {
            // Find the flashcards button and click it
            const flashcardsBtn = document.querySelector("button:has(svg.lucide-brain)") as HTMLElement;
            if (flashcardsBtn) {
              flashcardsBtn.click();
              // Small delay to allow menu to open
              setTimeout(() => {
                const menu = document.querySelector('[class*="animate-slide-in-down"]');
                if (menu) {
                  menu.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 100);
            }
          }
        }
      ]
    },
    {
      id: 'diagrams',
      title: ' Insert Diagrams & Charts',
      description: isMobile
        ? 'Tap the more options menu (⋮) to insert charts, flowcharts, and graphs.'
        : 'Add interactive charts, flowcharts, and graphs using Chart.js, Mermaid, and Graphviz.',
      elementSelector: isMobile 
        ? "button:has(svg.lucide-more-vertical)" 
        : "button[title='Insert Chart']",
      position: 'bottom',
      highlightPadding: 8,
      tips: ['Perfect for visual learners', 'Supports multiple diagram types', 'Edit anytime'],
      actions: isMobile ? [
        {
          label: 'Show Diagram Options',
          onClick: () => {
            const mobileMenuBtn = document.querySelector("button:has(svg.lucide-more-vertical)") as HTMLElement;
            if (mobileMenuBtn) {
              mobileMenuBtn.click();
              setTimeout(() => {
                const menu = document.querySelector('[class*="animate-slide-in-down"]');
                if (menu) {
                  menu.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 100);
            }
          }
        }
      ] : undefined
    },
    {
      id: 'uploads',
      title: ' Upload Documents & Audio',
      description: isMobile
        ? 'Use the upload icons in the expanded menu to upload PDFs, Word docs, or audio recordings.'
        : 'Upload PDFs, Word docs, or audio recordings to automatically generate notes using AI.',
      elementSelector: isMobile
        ? "button:has(svg.lucide-more-vertical)"
        : "button:has(svg.lucide-upload-cloud)",
      position: 'bottom',
      highlightPadding: 8,
      tips: ['Supports PDF, DOCX, TXT, MP3', 'AI extracts key information', 'Saves time on note-taking'],
      actions: isMobile ? [
        {
          label: 'Show Upload Options',
          onClick: () => {
            const mobileMenuBtn = document.querySelector("button:has(svg.lucide-more-vertical)") as HTMLElement;
            if (mobileMenuBtn) {
              mobileMenuBtn.click();
              setTimeout(() => {
                const menu = document.querySelector('[class*="animate-slide-in-down"]');
                if (menu) {
                  menu.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 100);
            }
          }
        }
      ] : undefined
    },
    {
      id: 'tts',
      title: ' Text-to-Speech',
      description: 'Listen to your notes aloud. Great for proofreading or learning on the go.',
      elementSelector: "button:has(svg.lucide-volume-2)",
      position: 'bottom',
      highlightPadding: 8,
      tips: ['Multiple voice options', 'Adjust speed', 'Learn while multitasking'],
    },
    {
      id: 'tts-help',
      title: ' Voice Guidance',
      description: 'The tutorial can read instructions aloud. Make sure your volume is up and browser permissions allow audio.',
      position: 'center',
      tips: [
        'Chrome, Edge, and Safari support text-to-speech',
        'Check browser permissions for audio',
        'Ensure your system volume is not muted',
        'Click the volume icon in the tutorial header to toggle voice guidance',
      ],
    },
    {
      id: 'history',
      title: ' Notes History',
      description: 'Access previous versions of your notes and restore them if needed.',
      elementSelector: "button:has(svg.lucide-book-open)",
      position: isMobile ? 'bottom' : 'right',
      highlightPadding: 8,
      tips: ['View all changes over time', 'Restore previous versions', 'Never lose your work'],
    },
    {
      id: 'save',
      title: 'Save Your Work',
      description: isMobile
        ? 'Tap the Save icon to manually save your note. Auto-save is enabled by default.'
        : 'Click Save to manually save your note. Auto-save is enabled by default.',
      elementSelector: "button:has(svg.lucide-save)",
      position: 'bottom',
      highlightPadding: 8,
      tips: ['Auto-save runs every few seconds', 'Manual save gives instant feedback', 'All changes are synced to the cloud'],
    },
    {
      id: 'export',
      title: ' Export & Share',
      description: isMobile
        ? 'Use the more options menu (⋮) to download your notes in various formats.'
        : 'Download your notes as PDF, Markdown, HTML, or Word documents.',
      elementSelector: isMobile
        ? "button:has(svg.lucide-more-vertical)"
        : "button:has(svg.lucide-download)",
      position: 'bottom',
      highlightPadding: 8,
      tips: ['Keep backups', 'Share with others', 'Print for offline use'],
      actions: isMobile ? [
        {
          label: 'Show Export Options',
          onClick: () => {
            const mobileMenuBtn = document.querySelector("button:has(svg.lucide-more-vertical)") as HTMLElement;
            if (mobileMenuBtn) {
              mobileMenuBtn.click();
              setTimeout(() => {
                // Find and highlight the export section
                const exportSection = document.querySelector('[class*="animate-slide-in-down"]');
                if (exportSection) {
                  exportSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 100);
            }
          }
        }
      ] : undefined
    },
  ],
});