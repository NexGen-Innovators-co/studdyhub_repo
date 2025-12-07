// ============================================
// UPDATED TUTORIAL CONFIGURATIONS
// ============================================
import { Brain, FileText, MessageSquare, Calendar, Upload } from 'lucide-react';
import { TutorialConfig } from '../components/UniversalTutorial';

export const getNoteEditorTutorial = (isMobile: boolean, isExpanded: boolean): TutorialConfig => ({
  id: 'note-editor',
  name: 'Note Editor Guide',
  description: 'Learn how to use the powerful note editor',
  icon: MessageSquare as any,
  showProgress: true,
  completionMessage: "You're now a note-taking pro! Start creating amazing notes.",
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to Your Smart Note Editor!',
      description: 'This is your AI-powered note-taking workspace with advanced features for students and professionals.',
      position: 'center',
      tips: [
        'All changes save automatically',
        'Works offline and syncs when online',
        'Supports markdown, diagrams, and AI assistance',
      ],
    },
    {
      id: 'expand-toolbar',
      title: 'Expandable Toolbar',
      description: isMobile
        ? 'The toolbar can be scrolled horizontally. Tap and drag to see more tools.'
        : 'Click the expand button or scroll horizontally to access all tools. Some tools may be hidden on smaller screens.',
      elementSelector: isMobile
        ? '.lg\\:hidden.flex.items-center.overflow-x-scroll'
        : '[data-tutorial="expand-toolbar-button"]',
      position: isMobile ? 'bottom' : 'top',
      highlightPadding: isMobile ? 20 : 12,
      tips: ['Scroll or expand to see all tools', 'Frequently used tools are always visible'],
      actions: !isMobile ? [
        {
          label: 'Expand Toolbar',
          onClick: () => {
            const expandBtn = document.querySelector('[data-tutorial="expand-toolbar-button"]') as HTMLElement;
            if (expandBtn) {
              expandBtn.click();
            }
          }
        }
      ] : []
    },
    {
      id: 'basic-formatting',
      title: 'Basic Text Formatting',
      description: 'Bold, italic, underline, and other basic formatting tools.',
      elementSelector: '[data-tutorial="bold-button"]',
      position: 'right',
      highlightPadding: 8,
      tips: ['Select text first, then apply formatting', 'Multiple formats can be combined'],
      actions: !isMobile ? [
        {
          label: 'Show Formatting Tools',
          onClick: () => {
            // Expand toolbar first
            const expandBtn = document.querySelector('[data-tutorial="expand-toolbar-button"]') as HTMLElement;
            if (expandBtn && !isExpanded) {
              expandBtn.click();
            }
            // Scroll to formatting
            setTimeout(() => {
              const boldBtn = document.querySelector('[data-tutorial="bold-button"]');
              if (boldBtn) {
                boldBtn.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
              }
            }, 100);
          }
        }
      ] : []
    },
    {
      id: 'headings-lists',
      title: 'Headings & Lists',
      description: 'Use headings to organize content and lists for structured information.',
      elementSelector: '[data-tutorial="heading1-button"]',
      position: 'right',
      highlightPadding: 8,
      tips: ['H1 for main topics, H2 for subtopics', 'Use lists for step-by-step instructions'],
      actions: !isMobile ? [
        {
          label: 'Show Headings & Lists',
          onClick: () => {
            const headingBtn = document.querySelector('[data-tutorial="heading1-button"]');
            if (headingBtn) {
              headingBtn.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
          }
        }
      ] : []
    },
    {
      id: 'insert-elements',
      title: 'Insert Elements',
      description: 'Add links, images, tables, code blocks, and diagrams.',
      elementSelector: '[data-tutorial="insert-link-button"]',
      position: 'right',
      highlightPadding: 8,
      tips: ['Insert images with URLs', 'Tables help organize data', 'Code blocks for programming'],
      actions: !isMobile ? [
        {
          label: 'Show Insert Tools',
          onClick: () => {
            const insertBtn = document.querySelector('[data-tutorial="insert-link-button"]');
            if (insertBtn) {
              insertBtn.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
          }
        }
      ] : []
    },
    {
      id: 'diagrams-charts',
      title: 'Diagrams & Charts',
      description: 'Insert interactive charts, flowcharts, and graphs.',
      elementSelector: '[data-tutorial="insert-chart-button"]',
      position: 'right',
      highlightPadding: 8,
      tips: ['Perfect for visual learners', 'Supports Chart.js, Mermaid, and Graphviz'],
      actions: !isMobile ? [
        {
          label: 'Show Diagram Tools',
          onClick: () => {
            const chartBtn = document.querySelector('[data-tutorial="insert-chart-button"]');
            if (chartBtn) {
              chartBtn.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
          }
        }
      ] : []
    },
    {
      id: 'document-tools',
      title: 'Document Tools',
      description: 'Upload documents, regenerate notes, and access original files.',
      elementSelector: '[data-tutorial="upload-document-button"]',
      position: 'right',
      highlightPadding: 8,
      tips: ['Upload PDFs, Word docs, or audio', 'AI extracts key information'],
      actions: !isMobile ? [
        {
          label: 'Show Document Tools',
          onClick: () => {
            const uploadBtn = document.querySelector('[data-tutorial="upload-document-button"]');
            if (uploadBtn) {
              uploadBtn.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
          }
        }
      ] : []
    },
    {
      id: 'export-tools',
      title: 'Export & Download',
      description: 'Download your notes in various formats.',
      elementSelector: '[data-tutorial="download-markdown-button"]',
      position: 'right',
      highlightPadding: 8,
      tips: ['Keep backups of your notes', 'Share with others easily'],
      actions: !isMobile ? [
        {
          label: 'Show Export Tools',
          onClick: () => {
            const downloadBtn = document.querySelector('[data-tutorial="download-markdown-button"]');
            if (downloadBtn) {
              downloadBtn.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
          }
        }
      ] : []
    },
    {
      id: 'ai-assistant',
      title: 'AI Writing Assistant',
      description: isMobile
        ? 'Tap the sparkle icon to access AI features like rewrite, expand, summarize, or translate.'
        : 'Select text and click the sparkle icon to rewrite, expand, summarize, or translate with AI.',
      elementSelector: '[data-tutorial="ai-assistant-button"]',
      position: isMobile ? 'top' : 'bottom',
      highlightPadding: 8,
      tips: [
        'Improves writing quality instantly',
        'Supports multiple languages',
        'Great for summarizing long passages',
      ],
    },
    {
      id: 'flashcards',
      title: 'Auto-Generate Flashcards',
      description: isMobile
        ? 'Tap the Brain icon to generate flashcards from your notes. Perfect for exam prep!'
        : 'Click the Brain icon to turn your notes into study flashcards.',
      elementSelector: '[data-tutorial="flashcards-button"]',
      position: isMobile ? 'top' : 'left',
      highlightPadding: 8,
      tips: ['Creates question-answer pairs', 'Review anytime', 'Boosts retention'],
    },
    {
      id: 'text-to-speech',
      title: 'Text-to-Speech',
      description: 'Listen to your notes aloud. Great for proofreading or learning on the go.',
      elementSelector: '[data-tutorial="tts-button"]',
      position: isMobile ? 'bottom' : 'right',
      highlightPadding: 8,
      tips: ['Multiple voice options', 'Adjust speed', 'Learn while multitasking'],
    },
    {
      id: 'save-work',
      title: 'Save Your Work',
      description: isMobile
        ? 'Tap the Save icon to manually save your note. Auto-save is enabled by default.'
        : 'Click Save to manually save your note. Auto-save is enabled by default.',
      elementSelector: '[data-tutorial="save-button"]',
      position: isMobile ? 'bottom' : 'right',
      highlightPadding: 8,
      tips: ['Auto-save runs every few seconds', 'Manual save gives instant feedback'],
    },
    {
      id: 'help-tutorial',
      title: 'Need Help?',
      description: 'You can always access this tutorial again by tapping the Help icon.',
      elementSelector: '[data-tutorial="help-button"]',
      position: isMobile ? 'bottom' : 'right',
      highlightPadding: 8,
      tips: ['Restart tutorial anytime', 'Explore features at your own pace'],
    },
  ],
});