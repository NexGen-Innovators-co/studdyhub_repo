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

/** Chart.js node */
const ChartJsNode = Node.create({
  name: 'chartjs',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      config: {
        default: '{}',
        parseHTML: element => element.getAttribute('data-config') || '{}',
        renderHTML: attributes => ({ 'data-config': attributes.config }),
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
          return { config: element.getAttribute('data-config') || '{}' };
        }
      },
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return false;
          const element = dom as HTMLElement;
          const code = element.querySelector('code[class*="language-chartjs"]');
          if (!code) return false;
          return { config: code.textContent || '{}' };
        }
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-chartjs': '',
      'data-config': HTMLAttributes.config
    })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(DiagramWrapper);
  },
});

/** Mermaid node */
const MermaidNode = Node.create({
  name: 'mermaid',
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
        tag: 'div[data-mermaid]',
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
          const code = element.querySelector('code[class*="language-mermaid"]');
          if (!code) return false;
          return { code: code.textContent || '' };
        }
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-mermaid': '',
      'data-code': HTMLAttributes.code
    })];
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
  note: Note;
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
    setCategory,
    tags,
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
  }, ref) => {
    const initialHtml = content
      ? mdProcessor.processSync(content).toString()
      : '';

    const editor = useEditor({
      extensions: [
        StarterKit.configure({ codeBlock: false }),
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
      content: initialHtml,
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        const markdown = turndown.turndown(html);
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
        return turndown.turndown(html);
      },
      getInnerHTML: () => {
        return editor?.getHTML() || '';
      },
    }));

    useEffect(() => {
      if (!editor) return;
      const currentMd = turndown.turndown(editor.getHTML());
      if (content !== currentMd) {
        const html = mdProcessor.processSync(content).toString();
        editor.commands.setContent(html, false);
      }
    }, [content, editor]);

    /* ---------- Inline AI ---------- */
    const [showAI, setShowAI] = useState(false);
    const [aiPos, setAiPos] = useState({ top: 0, left: 0 });
    const [selectedText, setSelectedText] = useState('');
    const [generatedText, setGeneratedText] = useState('');
    const [actionType, setActionType] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Add these state variables with your existing state
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showDiagramsMenu, setShowDiagramsMenu] = useState(false);
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
      setIsLoading(true);
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
        setIsLoading(false);
      }
    };

    const acceptAI = () => {
      if (!editor) return;
      const htmlFromMd = mdProcessor.processSync(generatedText).toString();
      editor.chain().focus().insertContent(htmlFromMd, { parseOptions: { preserveWhitespace: true } }).run();
      setShowAI(false);
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
          noteId: note.id,
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
        mermaid: 'flowchart TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Result 1]\n    B -->|No| D[Result 2]',
        dot: 'digraph G {\n    A -> B\n    B -> C\n    A -> C\n}'
      };

      if (type === 'chartjs') {
        editor.chain().focus().insertContent({ type: 'chartjs', attrs: { config: defaults.chartjs } }).run();
      } else {
        editor.chain().focus().insertContent({ type, attrs: { code: defaults[type] } }).run();
      }
    };

    // Add this useEffect to close menus when clicking outside
    useEffect(() => {
      const handleClickOutside = () => {
        setShowExportMenu(false);
        setShowMoreMenu(false);
        setShowDiagramsMenu(false);
      };

      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }, []);
    // Auto-render diagrams
    useEffect(() => {
      if (!editor) return;

      const html = editor.getHTML();
      const container = document.createElement('div');
      container.innerHTML = html;

      const mermaidBlocks = container.querySelectorAll('pre code.language-mermaid');
      mermaidBlocks.forEach((block) => {
        const code = block.textContent || '';
        const div = document.createElement('div');
        div.setAttribute('data-mermaid', '');
        div.setAttribute('data-code', code);
        block.parentElement?.replaceWith(div);
      });

      const chartBlocks = container.querySelectorAll('pre code.language-chartjs');
      chartBlocks.forEach((block) => {
        const config = block.textContent || '{}';
        const div = document.createElement('div');
        div.setAttribute('data-chartjs', '');
        div.setAttribute('data-config', config);
        block.parentElement?.replaceWith(div);
      });

      const dotBlocks = container.querySelectorAll('pre code.language-dot, pre code.language-graphviz');
      dotBlocks.forEach((block) => {
        const code = block.textContent || '';
        const div = document.createElement('div');
        div.setAttribute('data-dot', '');
        div.setAttribute('data-code', code);
        block.parentElement?.replaceWith(div);
      });

      if (mermaidBlocks.length + chartBlocks.length + dotBlocks.length > 0) {
        Promise.resolve().then(() => {
          if (editor?.commands) {
            editor.commands.setContent(container.innerHTML, false);
          }
        });
      }
    }, [editor, content]);

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

    // UI State
    const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
      <div className="flex flex-col flex-1 mt-12 lg:mt-1 bg-white dark:bg-gray-900 overflow-y-auto  lg:mb-12">
        <style>{`
          .ProseMirror pre {
            background:rgb(240, 245, 247);
            color:rgb(41, 40, 40);
            font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
            margin: 1rem 0;
          }
          .dark .ProseMirror pre { background: #0d1117; }
          .dark .ProseMirror code { background: #0d1117; color:rgb(199, 199, 199); }
          .hljs-comment { color: #6a9955; }
          .hljs-keyword { color: #569cd6; }
          .hljs-string { color: #ce9178; }
          .hljs-number { color: #b5cea8; }
          .hljs-function { color: #dcdcaa; }
          .hljs-class { color: #4ec9b0; }
          .hljs-variable { color: #9cdcfe; }
          .ProseMirror table { border-collapse: collapse; margin: 1rem 0; width: 100%; }
          .ProseMirror td, .ProseMirror th { border: 1px solid #d1d5db; padding: 0.5rem; text-align: left; }
          .dark .ProseMirror td, .dark .ProseMirror th { border-color: #374151; }
          .ProseMirror th { background: #f3f4f6; font-weight: 600; }
          .dark .ProseMirror th { background: #1f2937; }
        `}</style>
        {/* ---------- FORMATTING TOOLBAR ---------- */}
        <div className="text-blue-600 dark:text-blue-400 overflow-x-auto flex items-center order-b border-gray-700 dark:border-gray-100 bg-gray-50 dark:bg-gray-800 p-2  shadow-lg">
        <button onClick={onToggleNotesHistory} className="p-2 rounded hover:bg-gray-200" title="History"><BookOpen className="w-4 h-4" /></button>
          {/* Existing basic formatting buttons */}
          <button onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30"><Undo className="w-4 h-4" /></button>
          <button onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30"><Redo className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-gray-300 mx-1" />

          <button onClick={() => editor?.chain().focus().toggleBold().run()} className={`p-2 rounded hover:bg-gray-200 ${editor?.isActive('bold') ? 'bg-blue-100 text-blue-600' : ''}`}><Bold className="w-4 h-4" /></button>
          <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={`p-2 rounded hover:bg-gray-200 ${editor?.isActive('italic') ? 'bg-blue-100 text-blue-600' : ''}`}><Italic className="w-4 h-4" /></button>
          <button onClick={() => editor?.chain().focus().toggleUnderline().run()} className={`p-2 rounded hover:bg-gray-200 ${editor?.isActive('underline') ? 'bg-blue-100 text-blue-600' : ''}`}><UnderlineIcon className="w-4 h-4" /></button>
          <button onClick={() => editor?.chain().focus().toggleStrike().run()} className={`p-2 rounded hover:bg-gray-200 ${editor?.isActive('strike') ? 'bg-blue-100 text-blue-600' : ''}`}><Strikethrough className="w-4 h-4" /></button>
          <button onClick={() => editor?.chain().focus().toggleCode().run()} className={`p-2 rounded hover:bg-gray-200 ${editor?.isActive('code') ? 'bg-blue-100 text-blue-600' : ''}`}><Code className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-gray-300 mx-1" />

          <button onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} className={`p-2 rounded hover:bg-gray-200 ${editor?.isActive('heading', { level: 1 }) ? 'bg-blue-100 text-blue-600' : ''}`}><Heading1 className="w-4 h-4" /></button>
          <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-2 rounded hover:bg-gray-200 ${editor?.isActive('heading', { level: 2 }) ? 'bg-blue-100 text-blue-600' : ''}`}><Heading2 className="w-4 h-4" /></button>
          <button onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} className={`p-2 rounded hover:bg-gray-200 ${editor?.isActive('heading', { level: 3 }) ? 'bg-blue-100 text-blue-600' : ''}`}><Heading3 className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-gray-300 mx-1" />

          <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className={`p-2 rounded hover:bg-gray-200 ${editor?.isActive('bulletList') ? 'bg-blue-100 text-blue-600' : ''}`}><List className="w-4 h-4" /></button>
          <button onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={`p-2 rounded hover:bg-gray-200 ${editor?.isActive('orderedList') ? 'bg-blue-100 text-blue-600' : ''}`}><ListOrdered className="w-4 h-4" /></button>
          <button onClick={() => editor?.chain().focus().toggleBlockquote().run()} className={`p-2 rounded hover:bg-gray-200 ${editor?.isActive('blockquote') ? 'bg-blue-100 text-blue-600' : ''}`}><Quote className="w-4 h-4" /></button>
          <button onClick={() => editor?.chain().focus().toggleCodeBlock().run()} className={`p-2 rounded hover:bg-gray-200 ${editor?.isActive('codeBlock') ? 'bg-blue-100 text-blue-600' : ''}`}><Code className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-gray-300 mx-1" />

          <button onClick={() => editor?.chain().focus().setTextAlign('left').run()} className="p-2 rounded hover:bg-gray-200"><AlignLeft className="w-4 h-4" /></button>
          <button onClick={() => editor?.chain().focus().setTextAlign('center').run()} className="p-2 rounded hover:bg-gray-200"><AlignCenter className="w-4 h-4" /></button>
          <button onClick={() => editor?.chain().focus().setTextAlign('right').run()} className="p-2 rounded hover:bg-gray-200"><AlignRight className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-gray-300 mx-1" />

          <button onClick={() => { const url = prompt('Enter link URL:'); if (url) editor?.chain().focus().setLink({ href: url }).run(); }} className="p-2 rounded hover:bg-gray-200"><LinkIcon className="w-4 h-4" /></button>
          <button onClick={() => { const url = prompt('Enter image URL:'); if (url) editor?.chain().focus().setImage({ src: url }).run(); }} className="p-2 rounded hover:bg-gray-200"><ImageIcon className="w-4 h-4" /></button>
          <button onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="p-2 rounded hover:bg-gray-200"><TableIcon className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Individual action buttons */}
          <button onClick={onSave} className="p-2 rounded hover:bg-gray-200" title="Save"><Save className="w-4 h-4" /></button>
          <button onClick={() => {/* Add hash/heading functionality */ }} className="p-2 rounded hover:bg-gray-200" title="Heading"><Hash className="w-4 h-4" /></button>

          {/* File upload buttons */}
          <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded hover:bg-gray-200" title="Upload File"><UploadCloud className="w-4 h-4" /></button>
          <button onClick={() => audioInputRef.current?.click()} className="p-2 rounded hover:bg-gray-200" title="Upload Audio"><Mic className="w-4 h-4" /></button>

          {/* Text-to-speech button */}
          <button onClick={handleTextToSpeech} className="p-2 rounded hover:bg-gray-200" title="Text to Speech">
            {isSpeaking ? <StopCircle className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Export buttons */}
          <button onClick={handleDownloadNote} className="p-2 rounded hover:bg-gray-200" title="Download Markdown"><Download className="w-4 h-4" /></button>
          <button onClick={handleDownloadPdf} className="p-2 rounded hover:bg-gray-200" title="Download PDF"><FileText className="w-4 h-4" /></button>
          <button onClick={handleCopyNoteContent} className="p-2 rounded hover:bg-gray-200" title="Copy Content"><Copy className="w-4 h-4" /></button>

          {/* More actions as individual buttons */}
          
          <button onClick={handleViewOriginalDocument} className="p-2 rounded hover:bg-gray-200" title="View Original"><FileText className="w-4 h-4" /></button>
          <button onClick={regenerateNoteFromDocument} className="p-2 rounded hover:bg-gray-200" title="Regenerate"><RefreshCw className="w-4 h-4" /></button>

          {/* Diagram buttons */}
          <button onClick={() => insertDiagram('chartjs')} className="p-2 rounded hover:bg-gray-200" title="Insert Chart">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
          <button onClick={() => insertDiagram('mermaid')} className="p-2 rounded hover:bg-gray-200" title="Insert Mermaid">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </button>
          <button onClick={() => insertDiagram('dot')} className="p-2 rounded hover:bg-gray-200" title="Insert Graphviz">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>

          {/* AI button */}
          <button onClick={startAI} className="p-2 rounded hover:bg-gradient-to-r hover:from-purple-500 hover:to-blue-500 hover:text-white" title="AI Assist"><Sparkles className="w-4 h-4" /></button>

          {/* Flashcards button */}
          <div className="ml-auto">
            <button
              onClick={() => setShowMenu(v => !v)}
              className="px-3 py-1.5 text-sm rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center gap-1.5 font-medium"
            >
              <Brain className="w-4 h-4" />
              Flashcards
              {savedCards.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-xs font-semibold">{savedCards.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* ---------- Editor ---------- */}
        <div className="flex-1 overflow-y-auto px-0 py-4 space-y-1">
          <EditorContent editor={editor} className="overflow-y-scroll max-h-screen" />
        </div>
        {/* ---------- Status Bar ---------- */}
        <div className="border-t px-4 py-2 text-xs text-gray-600 flex justify-between bg-gray-50 dark:bg-gray-800">
          <span>{content.length} chars • {content.split(/\s+/).filter(Boolean).length} words</span>
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Ready
            </span>
            • Tiptap • Markdown • AI • Diagrams
          </span>
        </div>

        {/* ---------- Inline AI Portal ---------- */}
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
            onReject={() => setShowAI(false)}
            onClearError={() => setError(null)}
          />,
          document.body
        )}

        {/* ---------- Flashcard Menu ---------- */}
        {showMenu && (
          <div className="absolute right-4 top-16 w-72 bg-white rounded-xl shadow-2xl border p-4 z-50">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold">Generate Flashcards</label>
              <button onClick={() => setShowMenu(false)} className="p-1 hover:bg-gray-100 rounded"><XCircle className="w-4 h-4" /></button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <input
                type="number"
                min={1}
                max={50}
                value={cardCount}
                onChange={e => setCardCount(Math.min(50, Math.max(1, +e.target.value)))}
                className="w-20 px-3 py-2 border rounded-lg"
              />
              <span className="text-sm">flashcards</span>
            </div>

            <button
              onClick={generate}
              disabled={generating}
              className="w-full mb-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-70 text-white rounded-lg flex items-center justify-center gap-2 font-medium"
            >
              {generating ? <><RotateCw className="w-4 h-4 animate-spin" />Generating…</> : <><Sparkles className="w-4 h-4" />Generate {cardCount} Cards</>}
            </button>

            <button
              onClick={() => { setShowDeck(p => !p); setShowMenu(false); }}
              className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
            >
              {showDeck ? 'Hide' : 'Show'} Flashcards
            </button>
          </div>
        )}

        {/* ---------- Flashcard Deck ---------- */}
        {showDeck && (
          <div className="mt-6 border-t pt-6 pb-6">
            <FlashcardDeck
              noteId={note.id}
              userId={userProfile?.id ?? ''}
              onGenerate={generate}
            />
          </div>
        )}
      </div>

    );
  }
);

NoteContentArea.displayName = 'NoteContentArea';