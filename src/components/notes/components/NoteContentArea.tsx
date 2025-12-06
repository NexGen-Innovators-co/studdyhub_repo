// src/components/notes/components/NoteContentArea.tsx
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Chart, registerables } from 'chart.js';
import mermaid from 'mermaid';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Table as TableIcon,
  Strikethrough,
  Sparkles,
  Undo,
  Redo,
  Brain,
  XCircle,
  RotateCw,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Underline as UnderlineIcon,
  ChevronDown,
  Save,
  Hash,
  UploadCloud,
  Volume2,
  StopCircle,
  Menu,
  FileText,
  Download,
  Copy,
  Mic,
  MoreVertical,
  Settings,
  ChevronUp,
  RefreshCw,
  BookOpen,
  HelpCircle,
  ChevronRight,
  Plus, // Add Plus icon
  FilePlus, // Add FilePlus icon
  Lightbulb, // Add Lightbulb icon
} from 'lucide-react';

import { generateFlashcardsFromNote } from '../services/FlashCardServices';
import { generateInlineContent } from '../../../services/aiServices';
import { FlashcardDeck } from './FlashcardDeck';
import { InlineAIEditor } from './InlineAIEditor';
import { Note, UserProfile, NoteCategory } from '../../../types';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import { UniversalTutorial } from '@/components/notes/components/UniversalTutorial';
import { useTutorial } from '@/components/notes/hooks/useTutorials';
import { getNoteEditorTutorial } from '@/components/notes/config/tutorialConfigs';

/* ---------- Tiptap ---------- */
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';

/* ---------- Syntax Highlighting ---------- */
import { lowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import sql from 'highlight.js/lib/languages/sql';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';

lowlight.registerLanguage('javascript', javascript as any);
lowlight.registerLanguage('python', python as any);
lowlight.registerLanguage('java', java as any);
lowlight.registerLanguage('cpp', cpp as any);
lowlight.registerLanguage('sql', sql as any);
lowlight.registerLanguage('xml', xml as any);
lowlight.registerLanguage('bash', bash as any);
lowlight.registerLanguage('typescript', typescript as any);
lowlight.registerLanguage('json', json as any);
lowlight.registerLanguage('css', css as any);

/* ---------- Markdown to HTML ---------- */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import TurndownService from 'turndown';
import * as gfm from 'turndown-plugin-gfm';

Chart.register(...registerables);
mermaid.initialize({ startOnLoad: false });

const mdProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify);

const turndown = new TurndownService({ headingStyle: 'atx' });
turndown.use(gfm.gfm);

/* ---------- Custom Tiptap Nodes for Visuals ---------- */
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { DiagramWrapper } from './DiagramWrapper';
import { delay } from 'framer-motion';

/** Mermaid node */
const MermaidNode = Node.create({
  name: 'mermaid',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      code: {
        default: '',
        parseHTML: element => {
          const code = element.getAttribute('data-code');
          return code || '';
        },
        renderHTML: attributes => ({
          'data-mermaid': '',
          'data-code': attributes.code || ''
        }),
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-mermaid]',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return {};
          const element = dom as HTMLElement;
          const code = element.getAttribute('data-code') || '';
          return { code };
        }
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', {
      'data-mermaid': '',
      'data-code': HTMLAttributes.code || ''
    }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(DiagramWrapper);
  },
});

/** Chart.js node */
const ChartJsNode = Node.create({
  name: 'chartjs',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      config: {
        default: '{}',
        parseHTML: element => {
          const config = element.getAttribute('data-config');
          return config || '{}';
        },
        renderHTML: attributes => ({
          'data-chartjs': '',
          'data-config': attributes.config || '{}'
        }),
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-chartjs]',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return {};
          const element = dom as HTMLElement;
          const config = element.getAttribute('data-config') || '{}';
          return { config };
        }
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', {
      'data-chartjs': '',
      'data-config': HTMLAttributes.config || '{}'
    }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(DiagramWrapper);
  },
});

/** Graphviz (DOT) node */
const DotNode = Node.create({
  name: 'dot',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      code: {
        default: '',
        parseHTML: element => element.getAttribute('data-code') || '',
        renderHTML: attributes => ({ 'data-code': attributes.code }),
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-dot]',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return {};
          const element = dom as HTMLElement;
          return { code: element.getAttribute('data-code') || '' };
        }
      },
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return false;
          const element = dom as HTMLElement;
          const code = element.querySelector('code[class*="language-dot"], code[class*="language-graphviz"]');
          if (!code) return false;
          return { code: code.textContent || '' };
        }
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-dot': '',
      'data-code': HTMLAttributes.code
    })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(DiagramWrapper);
  },
});

export { ChartJsNode, MermaidNode, DotNode };

/* ---------- Component ---------- */
interface NoteContentAreaProps {
  content: string;
  setContent: (md: string) => void;
  note: Note | null; // Allow note to be null
  userProfile: UserProfile | null;
  title: string;
  setTitle: (title: string) => void;
  category: NoteCategory;
  setCategory: (category: NoteCategory) => void;
  tags: string;
  setTags: (tags: string) => void;
  onSave: () => void;
  onToggleNotesHistory?: () => void;
  isNotesHistoryOpen?: boolean;

  // Document actions
  isUploading: boolean;
  isGeneratingAI: boolean;
  isProcessingAudio: boolean;
  regenerateNoteFromDocument: () => void;
  handleViewOriginalDocument: () => void;
  documentId: string | null;

  // Export actions
  handleDownloadNote: () => void;
  handleDownloadPdf: () => void;
  handleDownloadHTML: () => void;
  handleDownloadTXT: () => void;
  handleDownloadWord: () => void;
  handleCopyNoteContent: () => void;

  // Text-to-speech
  handleTextToSpeech: () => void;
  isSpeaking: boolean;
  selectedVoiceURI: string | null;
  setSelectedVoiceURI: (uri: string) => void;
  voices: SpeechSynthesisVoice[];

  // File uploads
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  audioInputRef: React.RefObject<HTMLInputElement>;
  handleAudioFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
  isSummaryVisible: boolean;

  // Add new props for creating first note
  onCreateFirstNote?: () => void;
  onCreateFromTemplate?: () => void;
  onCreateFromDocument?: () => void;
}

export const NoteContentArea = forwardRef<any, NoteContentAreaProps>(
  ({
    content,
    setContent,
    note,
    userProfile,
    title,
    setTitle,
    category,
    setTags,
    onSave,
    onToggleNotesHistory,
    isNotesHistoryOpen,
    isUploading,
    isGeneratingAI,
    isProcessingAudio,
    regenerateNoteFromDocument,
    handleViewOriginalDocument,
    documentId,
    handleDownloadNote,
    handleDownloadPdf,
    handleDownloadHTML,
    handleDownloadTXT,
    handleDownloadWord,
    handleCopyNoteContent,
    handleTextToSpeech,
    isSpeaking,
    selectedVoiceURI,
    setSelectedVoiceURI,
    voices,
    fileInputRef,
    handleFileSelect,
    audioInputRef,
    handleAudioFileSelect,
    isLoading,
    isSummaryVisible,
    // New props
    onCreateFirstNote,
    onCreateFromTemplate,
    onCreateFromDocument,
  }, ref) => {
    // Add state to track if we're in empty state
    const [isEmptyState, setIsEmptyState] = useState(false);

    // Check if we're in empty state
    useEffect(() => {
      const isEmpty = !note || !note.id || (!content.trim() && !isLoading);
      setIsEmptyState(isEmpty);
    }, [note, content, isLoading]);

    // Function to convert editor HTML back to markdown while preserving diagrams
    const convertEditorHtmlToMarkdown = (html: string): string => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      // Handle Chart.js nodes
      const chartNodes = tempDiv.querySelectorAll('div[data-chartjs]');
      chartNodes.forEach((node, index) => {
        const config = node.getAttribute('data-config');
        if (config && config.trim()) {
          const codeBlock = document.createElement('pre');
          const code = document.createElement('code');
          code.className = 'language-chartjs';
          code.textContent = config;
          codeBlock.appendChild(code);
          node.replaceWith(codeBlock);
        } else {
          node.remove();
        }
      });

      // Handle Mermaid nodes
      const mermaidNodes = tempDiv.querySelectorAll('div[data-mermaid]');
      mermaidNodes.forEach((node, index) => {
        const code = node.getAttribute('data-code');
        if (code && code.trim()) {
          const codeBlock = document.createElement('pre');
          const codeElement = document.createElement('code');
          codeElement.className = 'language-mermaid';
          codeElement.textContent = code;
          codeBlock.appendChild(codeElement);
          node.replaceWith(codeBlock);
        } else {
          node.remove();
        }
      });

      // Handle Graphviz (DOT) nodes
      const dotNodes = tempDiv.querySelectorAll('div[data-dot]');
      dotNodes.forEach((node, index) => {
        const code = node.getAttribute('data-code');
        if (code && code.trim()) {
          const codeBlock = document.createElement('pre');
          const codeElement = document.createElement('code');
          codeElement.className = 'language-dot';
          codeElement.textContent = code;
          codeBlock.appendChild(codeElement);
          node.replaceWith(codeBlock);
        } else {
          node.remove();
        }
      });

      const markdown = turndown.turndown(tempDiv.innerHTML);
      return markdown;
    };

    // Function to properly convert markdown to editor HTML with diagram support
    const convertMarkdownToEditorHtml = (markdown: string): string => {
      if (!markdown.trim()) return '';

      try {
        let html = mdProcessor.processSync(markdown).toString();

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        const mermaidCodeBlocks = tempDiv.querySelectorAll('pre code.language-mermaid');
        mermaidCodeBlocks.forEach((codeBlock) => {
          const code = codeBlock.textContent || '';
          const mermaidDiv = document.createElement('div');
          mermaidDiv.setAttribute('data-mermaid', '');
          mermaidDiv.setAttribute('data-code', code);
          codeBlock.parentElement?.replaceWith(mermaidDiv);
        });

        const chartjsCodeBlocks = tempDiv.querySelectorAll('pre code.language-chartjs');
        chartjsCodeBlocks.forEach((codeBlock) => {
          const config = codeBlock.textContent || '{}';
          const chartDiv = document.createElement('div');
          chartDiv.setAttribute('data-chartjs', '');
          chartDiv.setAttribute('data-config', config);
          codeBlock.parentElement?.replaceWith(chartDiv);
        });

        const dotCodeBlocks = tempDiv.querySelectorAll('pre code.language-dot, pre code.language-graphviz');
        dotCodeBlocks.forEach((codeBlock) => {
          const code = codeBlock.textContent || '';
          const dotDiv = document.createElement('div');
          dotDiv.setAttribute('data-dot', '');
          dotDiv.setAttribute('data-code', code);
          codeBlock.parentElement?.replaceWith(dotDiv);
        });

        return tempDiv.innerHTML;
      } catch (error) {
        console.error('Error converting markdown to HTML:', error);
        return markdown;
      }
    };

    // Then update the editor configuration:
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          codeBlock: false
        }),
        CodeBlockLowlight.configure({
          lowlight,
          defaultLanguage: 'javascript',
        }),
        Link.configure({ openOnClick: false, autolink: true }),
        Underline,
        Placeholder.configure({ placeholder: 'Start writing your note...' }),
        Image,
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        ChartJsNode,
        MermaidNode,
        DotNode,
      ],
      content: convertMarkdownToEditorHtml(content),
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        const markdown = convertEditorHtmlToMarkdown(html);
        setContent(markdown);
      },
      editorProps: {
        attributes: {
          class:
            'prose prose-sm sm:prose lg:prose-lg dark:prose-invert focus:outline-none min-h-full p-6 max-w-none',
        },
      },
    });

    useImperativeHandle(ref, () => ({
      getCurrentMarkdown: () => {
        if (!editor) return '';
        const html = editor.getHTML();
        return convertEditorHtmlToMarkdown(html);
      },
      getInnerHTML: () => {
        return editor?.getHTML() || '';
      },
    }));

    // Add this to your NoteContentArea component
    const debugEditorState = () => {
      if (!editor) return;

      const html = editor.getHTML();
      console.log("=== EDITOR STATE DEBUG ===");
      console.log("Editor HTML:", html);
    };

    const handleSave = () => {
      debugEditorState();
      onSave()
    };

    useEffect(() => {
      if (!editor) return;

      const timeoutId = setTimeout(() => {
        const currentMarkdown = convertEditorHtmlToMarkdown(editor.getHTML());

        if (content !== currentMarkdown && content.trim() !== currentMarkdown.trim()) {
          const html = convertMarkdownToEditorHtml(content);
          editor.commands.setContent(html, false);
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }, [content, editor]);

    /* ---------- Inline AI ---------- */
    const [showAI, setShowAI] = useState(false);
    const [aiPos, setAiPos] = useState({ top: 0, left: 0 });
    const [selectedText, setSelectedText] = useState('');
    const [generatedText, setGeneratedText] = useState('');
    const [actionType, setActionType] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showDiagramsMenu, setShowDiagramsMenu] = useState(false);
    const { isOpen, startTutorial, closeTutorial, completeTutorial } = useTutorial('note-editor');
    const [isToolbarExpanded, setIsToolbarExpanded] = useState(true);
    const startAI = () => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      if (from === to) {
        toast.info('Select some text first');
        return;
      }
      const text = editor.state.doc.textBetween(from, to, ' ');
      setSelectedText(text);

      const coords = editor.view.coordsAtPos(from);
      setAiPos({ top: coords.bottom + 10, left: coords.left });
      setShowAI(true);
    };

    const runAI = async (action: string, custom?: string) => {
      setError(null);
      setGeneratedText('');
      try {
        const result = await generateInlineContent(
          selectedText,
          content,
          userProfile!,
          action,
          custom
        );
        setGeneratedText(result);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsTyping(false);
      }
    };

    const acceptAI = () => {
      if (!editor) return;
      const htmlFromMd = mdProcessor.processSync(generatedText).toString();
      editor.chain().focus().insertContent(htmlFromMd, { parseOptions: { preserveWhitespace: true } }).run();
      setShowAI(false);
      setGeneratedText('');
    };

    const cancelAI = () => {
      setShowAI(false);
      setGeneratedText('');
    };

    /* ---------- Flashcards ---------- */
    const [showMenu, setShowMenu] = useState(false);
    const [cardCount, setCardCount] = useState(10);
    const [generating, setGenerating] = useState(false);
    const [showDeck, setShowDeck] = useState(false);
    const [savedCards, setSavedCards] = useState<any[]>([]);

    const generate = async () => {
      setGenerating(true);
      try {
        const res = await generateFlashcardsFromNote({
          noteContent: content,
          noteId: note?.id || '',
          userProfile: userProfile!,
          numberOfCards: cardCount,
        });
        setSavedCards(res.flashcards);
        setShowDeck(true);
        toast.success(`Generated ${res.flashcards.length} cards`);
      } catch {
        toast.error('Failed to generate flashcards');
      } finally {
        setGenerating(false);
        setShowMenu(false);
      }
    };

    const insertDiagram = (type: 'chartjs' | 'mermaid' | 'dot') => {
      if (!editor) return;

      const defaults = {
        chartjs: JSON.stringify({
          type: 'bar',
          data: {
            labels: ['Red', 'Blue', 'Yellow'],
            datasets: [{
              label: '# of Votes',
              data: [12, 19, 3],
              backgroundColor: ['rgba(255, 99, 132, 0.2)', 'rgba(54, 162, 235, 0.2)', 'rgba(255, 206, 86, 0.2)']
            }]
          }
        }, null, 2),
        mermaid: 'graph TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Result 1]\n    B -->|No| D[Result 2]',
        dot: 'digraph G {\n    A -> B\n    B -> C\n    A -> C\n}'
      };

      if (type === 'chartjs') {
        editor.chain().focus().insertContent({
          type: 'chartjs',
          attrs: { config: defaults.chartjs }
        }).run();
      } else {
        editor.chain().focus().insertContent({
          type,
          attrs: { code: defaults[type] }
        }).run();
      }
    };

    // Diagram rendering useEffect (only for visual rendering, doesn't affect content)
    useEffect(() => {
      const renderAllDiagrams = async () => {
        const mermaidDivs = document.querySelectorAll('div[data-mermaid]');
        for (const div of mermaidDivs) {
          const code = div.getAttribute('data-code');
          if (!code) continue;

          try {
            const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const { svg } = await mermaid.render(id, code);
            div.innerHTML = svg;
            div.classList.remove('mermaid-error');
          } catch (err: any) {
            div.innerHTML = `
              <div style="border: 1px solid #ef4444; background: rgba(239,68,68,0.1); color: #ef4444; padding: 0.75rem; border-radius: 0.5rem; font-size: 0.85rem; font-family: system-ui, sans-serif;">
                <strong>⚠️ Mermaid Diagram Error</strong><br>
                ${err.message ? err.message.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Invalid Mermaid syntax.'}
              </div>
            `;
            div.classList.add('mermaid-error');
          }
        }

        const chartDivs = document.querySelectorAll('div[data-chartjs]');
        for (const div of chartDivs) {
          const configText = div.getAttribute('data-config');
          if (!configText) continue;
          try {
            const config = JSON.parse(configText);
            const canvas = document.createElement('canvas');
            div.innerHTML = '';
            div.appendChild(canvas);
            new Chart(canvas, config);
          } catch (err) {
            // Silent fail
          }
        }

        const dotDivs = document.querySelectorAll('div[data-dot]');
        for (const div of dotDivs) {
          const code = div.getAttribute('data-code');
          if (!code) continue;
          try {
            if (!(window as any).Viz) {
              const script = document.createElement('script');
              script.src = 'https://cdn.jsdelivr.net/npm/viz.js@2.1.2/viz.js';
              script.async = true;
              await new Promise((resolve) => {
                script.onload = resolve;
                document.head.appendChild(script);
              });
              const renderScript = document.createElement('script');
              renderScript.src = 'https://cdn.jsdelivr.net/npm/viz.js@2.1.2/full.render.js';
              renderScript.async = true;
              await new Promise((resolve) => {
                renderScript.onload = resolve;
                document.head.appendChild(renderScript);
              });
            }
            const viz = new (window as any).Viz();
            const svg = await viz.renderSVGElement(code);
            div.innerHTML = '';
            div.appendChild(svg);
          } catch (err) {
            // Silent fail
          }
        }
      };

      renderAllDiagrams();
    }, [editor?.getHTML()]);
    const useMobileDetection = () => {
      const [isMobile, setIsMobile] = useState(false);

      useEffect(() => {
        const checkMobile = () => {
          setIsMobile(window.innerWidth < 1024);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
      }, []);

      return isMobile;
    };

    const isMobile = useMobileDetection();

    // Create dynamic tutorial config
    const NOTE_EDITOR_TUTORIAL = getNoteEditorTutorial(isMobile);
    // UI State
    const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showMobileFormatMenu, setShowMobileFormatMenu] = useState(false);
    const [showFlashcardsMenu, setShowFlashcardsMenu] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);

    const toolbarRef = useRef<HTMLDivElement>(null);
    const [hiddenIndices, setHiddenIndices] = useState<Set<number>>(new Set());
    const [hasOverflow, setHasOverflow] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // Define your toolbar groups as React nodes
    const toolbarItems: React.ReactNode[] = [
      // Navigation
      <React.Fragment key="nav">
        <button onClick={() => startTutorial()}>
          <HelpCircle className="w-4 h-4" />
        </button>
        <button
          onClick={onToggleNotesHistory}
          className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-md group"
          title="History"
        >
          <BookOpen className="w-4 h-4 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
        </button>
      </React.Fragment>,

      // History
      <React.Fragment key="history">
        <button
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!editor?.can().undo()}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md disabled:opacity-30 transition-all duration-200"
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={!editor?.can().redo()}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md disabled:opacity-30 transition-all duration-200"
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
      </React.Fragment>,

      // Text formatting
      <React.Fragment key="format">
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`p-2 rounded-md transition-all duration-200 ${editor?.isActive('bold') ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`p-2 rounded-md transition-all duration-200 ${editor?.isActive('italic') ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          className={`p-2 rounded-md transition-all duration-200 ${editor?.isActive('underline') ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          className={`p-2 rounded-md transition-all duration-200 ${editor?.isActive('strike') ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleCode().run()}
          className={`p-2 rounded-md transition-all duration-200 ${editor?.isActive('code') ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          title="Code"
        >
          <Code className="w-4 h-4" />
        </button>
      </React.Fragment>,

      // Headings
      <React.Fragment key="headings">
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded-md transition-all duration-200 ${editor?.isActive('heading', { level: 1 }) ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded-md transition-all duration-200 ${editor?.isActive('heading', { level: 2 }) ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 rounded-md transition-all duration-200 ${editor?.isActive('heading', { level: 3 }) ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </button>
      </React.Fragment>,

      // Lists & Blocks
      <React.Fragment key="lists">
        <button
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded-md transition-all duration-200 ${editor?.isActive('bulletList') ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded-md transition-all duration-200 ${editor?.isActive('orderedList') ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          title="Ordered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded-md transition-all duration-200 ${editor?.isActive('blockquote') ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </button>
      </React.Fragment>,

      // Alignment
      <React.Fragment key="alignment">
        <button
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().setTextAlign('right').run()}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
        </button>
      </React.Fragment>,

      // Insert
      <React.Fragment key="insert">
        <button
          onClick={() => { const url = prompt('Enter link URL:'); if (url) editor?.chain().focus().setLink({ href: url }).run(); }}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
          title="Insert Link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => { const url = prompt('Enter image URL:'); if (url) editor?.chain().focus().setImage({ src: url }).run(); }}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
          title="Insert Image"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
          title="Insert Table"
        >
          <TableIcon className="w-4 h-4" />
        </button>
      </React.Fragment>,

      // Diagrams
      <React.Fragment key="diagrams">
        <button
          onClick={() => insertDiagram('chartjs')}
          className="p-2 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
          title="Insert Chart"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </button>
        <button
          onClick={() => insertDiagram('mermaid')}
          className="p-2 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
          title="Insert Mermaid"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </button>
        <button
          onClick={() => insertDiagram('dot')}
          className="p-2 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
          title="Insert Graphviz"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          className={`p-2 rounded-md transition-all duration-200 ${editor?.isActive('codeBlock') ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          title="Code Block"
        >
          <Code className="w-4 h-4" />
        </button>
      </React.Fragment>,

      // Document actions
      <React.Fragment key="document">
        <button
          onClick={handleSave}
          className="p-2 rounded-md hover:bg-green-100 dark:hover:bg-green-900 hover:text-green-600 dark:hover:text-green-400 transition-all duration-200"
          title="Save"
        >
          <Save className="w-4 h-4" />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isGeneratingAI || isProcessingAudio || !userProfile}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          title="Upload Document"
        >
          {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
        </button>
        <button
          onClick={() => audioInputRef.current?.click()}
          disabled={isProcessingAudio || isUploading || isGeneratingAI || !userProfile}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          title="Upload Audio"
        >
          {isProcessingAudio ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
        </button>
        <button
          onClick={handleViewOriginalDocument}
          disabled={!documentId || isProcessingAudio}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          title="View Original"
        >
          <FileText className="w-4 h-4" />
        </button>
        <button
          onClick={regenerateNoteFromDocument}
          disabled={isUploading || isGeneratingAI || isProcessingAudio || !documentId}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          title="Regenerate"
        >
          {isGeneratingAI ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </React.Fragment>,

      // Export
      <React.Fragment key="export">
        <button
          onClick={handleDownloadNote}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
          title="Download Markdown"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={handleDownloadPdf}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
          title="Download PDF"
        >
          <FileText className="w-4 h-4" />
        </button>
        <button
          onClick={handleCopyNoteContent}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
          title="Copy Content"
        >
          <Copy className="w-4 h-4" />
        </button>
      </React.Fragment>,

      // TTS
      <React.Fragment key="tts">
        <select
          value={selectedVoiceURI || ''}
          onChange={(e) => setSelectedVoiceURI(e.target.value)}
          disabled={isSpeaking || voices.length === 0}
          className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all duration-200"
          title="Select Voice"
        >
          <option value="">Default Voice</option>
          {voices.map((voice, index) => (
            <option key={`${voice.voiceURI}-${index}`} value={voice.voiceURI}>
              {`${voice.name} (${voice.lang})`}
            </option>
          ))}
        </select>
        <button
          onClick={handleTextToSpeech}
          disabled={isUploading || isGeneratingAI || isProcessingAudio}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          title="Text to Speech"
        >
          {isSpeaking ? <StopCircle className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </React.Fragment>,

      // AI & Flashcards
      <React.Fragment key="ai">
        <button
          onClick={startAI}
          className="p-2 rounded-md bg-gradient-to-r from-blue-500 to-blue-500 hover:from-blue-600 hover:to-blue-600 text-white shadow-md hover:shadow-lg transition-all duration-200"
          title="AI Assist"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            setShowMenu(!showMenu);
            if (!showMenu) {
              setShowDeck(false);
            }
          }}
          className="px-3 py-2 text-sm rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center gap-1.5 font-medium shadow-md hover:shadow-lg transition-all duration-200"
          title="Flashcards Menu"
        >
          <Brain className="w-4 h-4" />
          <span className="hidden xl:inline">Flashcards</span>
          {savedCards.length > 0 && (
            <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-xs font-semibold">{savedCards.length}</span>
          )}
        </button>
      </React.Fragment>,
    ];

    useEffect(() => {
      if (!toolbarRef.current) return;

      const checkOverflow = () => {
        const container = toolbarRef.current;
        if (!container) return;

        if (isExpanded) {
          setHiddenIndices(new Set());
          setHasOverflow(false);
          return;
        }

        const children = Array.from(container.children) as HTMLElement[];
        const containerWidth = container.offsetWidth;
        let totalWidth = 0;
        const newHidden = new Set<number>();

        children.forEach((child, index) => {
          totalWidth += child.offsetWidth + 8;
          if (totalWidth > containerWidth - 1) {
            newHidden.add(index);
          }
        });

        setHiddenIndices(newHidden);
        setHasOverflow(newHidden.size > 0);
      };

      checkOverflow();

      const resizeObserver = new ResizeObserver(checkOverflow);
      resizeObserver.observe(toolbarRef.current);

      window.addEventListener('resize', checkOverflow);

      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', checkOverflow);
      };
    }, [editor, savedCards.length, isToolbarExpanded, isSummaryVisible, isExpanded]);

    // Render empty state when there's no note


    // Render normal editor when note exists
    return (
      <div className="flex flex-col h-full w-full overflow-hidden bg-white dark:bg-gray-900">
        {/* Hidden file inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          accept=".pdf,.txt,.doc,.docx,.md"
        />
        <input
          type="file"
          ref={audioInputRef}
          onChange={handleAudioFileSelect}
          style={{ display: 'none' }}
          accept="audio/*"
        />

        {/* ---------- RESPONSIVE FORMATTING TOOLBAR ---------- */}
        <div className="flex-shrink-0 relative border-b border-gray-300 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 shadow-sm">
          {/* Desktop Toolbar - Hidden on mobile */}
          <div className={`hidden lg:flex items-center gap-2 px-4 py-2 overflow-x-scroll modern-scrollbar in transition-all duration-300 ${isExpanded ? 'flex-wrap' : ''}`}>
            <div className={`flex items-center gap-2 flex-1 min-w-0 ${isExpanded ? 'flex-wrap' : ''}`} ref={toolbarRef}>
              {toolbarItems.map((item, index) => (
                <div
                  key={index}
                  data-index={index}
                  className={`flex items-center gap-1 px-2 py-1 bg-white/50 dark:bg-gray-700/50 rounded-lg transition-all duration-300 ${hiddenIndices.has(index) && !isExpanded ? 'opacity-0 w-0 p-0 m-0 overflow-hidden' : ''}`}
                  style={{
                    flexShrink: 0,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 flex-shrink-0 ml-2"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          {showMenu && !isMobile && (
            <div className="border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-lg animate-slide-in-down">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <label className="text-sm font-semibold text-gray-900 dark:text-white">
                      Generate Flashcards from Your Notes
                    </label>
                  </div>
                  <button
                    onClick={() => setShowMenu(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                    title="Close Menu"
                  >
                    <XCircle className="w-5 h-5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
                  </button>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={cardCount}
                      onChange={e => setCardCount(Math.min(50, Math.max(1, +e.target.value)))}
                      className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">flashcards</span>
                  </div>

                  <button
                    onClick={generate}
                    disabled={generating}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 font-medium transition-all shadow-md hover:shadow-lg"
                  >
                    {generating ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>Generating…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Generate {cardCount} Cards</span>
                      </>
                    )}
                  </button>

                  {savedCards.length > 0 && (
                    <button
                      onClick={() => {
                        setShowDeck(!showDeck);
                        setShowMenu(false);
                      }}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-all flex items-center gap-2"
                    >
                      <Brain className="w-4 h-4" />
                      {showDeck ? 'Hide' : 'View'} Flashcards ({savedCards.length})
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* Mobile Toolbar - Visible on mobile/tablet */}
          <div className="flex lg:hidden items-center overflow-x-scroll justify-between px-3 py-2">

            {/* ========== MOBILE ESSENTIAL FORMATTING ========== */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => startTutorial}
                className="p-2 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-900 hover:text-yellow-600 dark:hover:text-yellow-400 transition-all duration-200"
                title="Show Tutorial"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <button
                onClick={onToggleNotesHistory}
                className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-md group"
                title="History"
              >
                <BookOpen className="w-4 h-4 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
              </button>
            </div>

            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

            {/* ========== HISTORY GROUP ========== */}
            <button
              onClick={() => editor?.chain().focus().undo().run()}
              disabled={!editor?.can().undo()}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md disabled:opacity-30 transition-all duration-200"
              title="Undo"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor?.chain().focus().redo().run()}
              disabled={!editor?.can().redo()}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md disabled:opacity-30 transition-all duration-200"
              title="Redo"
            >
              <Redo className="w-4 h-4" />
            </button>

            <button
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={`p-2 rounded-lg ${editor?.isActive('bold') ? 'bg-blue-500 text-white' : 'hover:bg-white dark:hover:bg-gray-700'}`}
              title="Bold"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={`p-2 rounded-lg ${editor?.isActive('italic') ? 'bg-blue-500 text-white' : 'hover:bg-white dark:hover:bg-gray-700'}`}
              title="Italic"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className={`p-2 rounded-lg ${editor?.isActive('bulletList') ? 'bg-blue-500 text-white' : 'hover:bg-white dark:hover:bg-gray-700'}`}
              title="Bullet List"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={handleSave}
              className="p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 hover:text-green-600"
              title="Save"
            >
              <Save className="w-4 h-4" />
            </button>

            {/* ========== MOBILE ACTIONS ========== */}
            <div className="flex items-center gap-1">

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMobileFormatMenu(!showMobileFormatMenu);
                  setShowFlashcardsMenu(false);
                  setShowExportMenu(false);
                }}
                className="p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 hover:text-green-600"
                title="More Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              <button onClick={handleTextToSpeech} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200" title="Text to Speech">
                {isSpeaking ? <StopCircle className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                onClick={startAI}
                className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-500 text-white"
                title="AI Assist"
              >
                <Sparkles className="w-4 h-4" />
              </button>


              {/* Flashcards Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFlashcardsMenu(!showFlashcardsMenu);
                  setShowMobileFormatMenu(false);
                  setShowExportMenu(false);
                  if (!showFlashcardsMenu) {
                    setShowDeck(false);
                  }
                }}
                className="px-3 py-2 text-sm rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center gap-1.5 font-medium"
                title="Flashcards Menu"
              >
                <Brain className="w-4 h-4" />
                {savedCards.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-xs font-semibold">
                    {savedCards.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* ========== MOBILE EXPANDABLE MENUS ========== */}

          {/* Export Menu */}
          {showExportMenu && (
            <div className="lg:hidden border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 animate-slide-in-down">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    handleDownloadNote();
                    setShowExportMenu(false);
                  }}
                  className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex flex-col items-center justify-center"
                >
                  <Download className="w-4 h-4 mb-1" />
                  <span className="text-xs">Markdown</span>
                </button>
                <button
                  onClick={() => {
                    handleDownloadPdf();
                    setShowExportMenu(false);
                  }}
                  className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex flex-col items-center justify-center"
                >
                  <FileText className="w-4 h-4 mb-1" />
                  <span className="text-xs">PDF</span>
                </button>
                <button
                  onClick={() => {
                    handleDownloadHTML();
                    setShowExportMenu(false);
                  }}
                  className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex flex-col items-center justify-center"
                >
                  <Code className="w-4 h-4 mb-1" />
                  <span className="text-xs">HTML</span>
                </button>
                <button
                  onClick={() => {
                    handleCopyNoteContent();
                    setShowExportMenu(false);
                  }}
                  className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex flex-col items-center justify-center"
                >
                  <Copy className="w-4 h-4 mb-1" />
                  <span className="text-xs">Copy</span>
                </button>
                <button
                  onClick={() => {
                    handleDownloadWord();
                    setShowExportMenu(false);
                  }}
                  className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex flex-col items-center justify-center"
                >
                  <FileText className="w-4 h-4 mb-1" />
                  <span className="text-xs">DOCX</span>
                </button>
                <button
                  onClick={() => {
                    handleDownloadNote();
                    setShowExportMenu(false);
                  }}
                  className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex flex-col items-center justify-center"
                >
                  <FileText className="w-4 h-4 mb-1" />
                  <span className="text-xs">Notes</span>
                </button>
              </div>
            </div>
          )}

          {/* Flashcards Menu */}
          {showFlashcardsMenu && (
            <div className="lg:hidden border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 animate-slide-in-down">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-900 dark:text-white">
                  Generate Flashcards
                </label>
                <button
                  onClick={() => setShowFlashcardsMenu(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={cardCount}
                  onChange={e => setCardCount(Math.min(50, Math.max(1, +e.target.value)))}
                  className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">flashcards</span>
              </div>

              <button
                onClick={generate}
                disabled={generating}
                className="w-full mb-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-70 text-white rounded-lg flex items-center justify-center gap-2 font-medium"
              >
                {generating ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Generating…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate {cardCount} Cards</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setShowDeck(!showDeck);
                  setShowFlashcardsMenu(false);
                }}
                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium"
              >
                {showDeck ? 'Hide' : 'Show'} Flashcards
              </button>
            </div>
          )}

          {/* Mobile Expandable Menu */}
          {showMobileFormatMenu && (
            <div className="lg:hidden border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-2 animate-slide-in-down">
              <div className="grid grid-cols-9 gap-1">
                <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-all">
                  <UploadCloud className="w-4 h-4 " />
                </button>
                <button onClick={regenerateNoteFromDocument} className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-all">
                  <RefreshCw className="w-4 h-4 " />
                </button>
                <button onClick={handleViewOriginalDocument} className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-all">
                  <FileText className="w-4 h-4 " />
                </button>
                <button onClick={() => audioInputRef.current?.click()} className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-all">
                  <Mic className="w-4 h-4 " />
                </button>
                <button onClick={() => setShowExportMenu(true)} className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-all">
                  <Download className="w-4 h-4 " />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ---------- EDITOR CONTENT ---------- */}
        <div className="flex-1 max-h-full pb-6 overflow-y-auto relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="text-center">
                <RotateCw className="animate-spin mx-auto mb-4 text-blue-600 dark:text-blue-400" size={48} />
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Loading...</p>
              </div>
            </div>
          )}

          <div className="h-full max-w-full mx-auto py-4 sm:py-6">
            <EditorContent
              editor={editor}
              className="h-full  prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none"
            />
          </div>
        </div>

        {/* ---------- STATUS BAR ---------- */}
        <div className="flex-shrink-0 border-t border-gray-300 dark:border-gray-700 px-4 py-2 sm:py-3 bg-gray-50 dark:bg-gray-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-3">
              <span className="font-medium">{content.length} chars</span>
              <span className="hidden sm:inline">•</span>
              <span className="font-medium">{content.split(/\s+/).filter(Boolean).length} words</span>
            </div>
            <div className="flex items-center gap-2 text-2xs sm:text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="font-medium">Ready</span>
              </span>
              <span className="hidden md:inline">•</span>
              <span className="hidden md:inline text-gray-500 dark:text-gray-500">Tiptap • Markdown • AI • Diagrams</span>
            </div>
          </div>
        </div>

        {/* ---------- INLINE AI PORTAL ---------- */}
        {showAI && createPortal(
          <InlineAIEditor
            originalText={content}
            selectedText={selectedText}
            generatedText={generatedText}
            actionType={actionType}
            isTyping={isTyping}
            isLoading={isLoading}
            error={error ?? ''}
            position={aiPos}
            isVisible={showAI}
            onGenerate={runAI}
            onAccept={acceptAI}
            onReject={() => cancelAI()}
            onClearError={() => setError(null)}
          />,
          document.body
        )}

        {/* ---------- FLASHCARD DECK ---------- */}
        {showDeck && (
          <div className="border-t border-gray-300 dark:border-gray-700 p-4 sm:p-6 bg-gray-50 dark:bg-gray-800/50">
            <FlashcardDeck
              noteId={note?.id || ''}
              userId={userProfile?.id ?? ''}
              onGenerate={generate}
            />
          </div>
        )}

        {/* Tutorial Component */}
        <UniversalTutorial
          config={NOTE_EDITOR_TUTORIAL}
          isOpen={isOpen}
          onClose={closeTutorial}
          onComplete={completeTutorial}
        />
      </div>
    );
  }
);

NoteContentArea.displayName = 'NoteContentArea';