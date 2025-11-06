// src/components/notes/components/NoteContentArea.tsx
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
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
} from 'lucide-react';

import { generateFlashcardsFromNote } from '../services/FlashCardServices';
import { generateInlineContent } from '../../../services/aiServices';
import { FlashcardDeck } from './FlashcardDeck';
import { InlineAIEditor } from './InlineAIEditor';
import { Note, UserProfile } from '../../../types';

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
import { lowlight } from 'lowlight';                     // default export only
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

/* lowlight is already an instance – just register the languages */
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
// Add this to your NoteContentArea.tsx file
// Replace the custom node definitions with these enhanced versions

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { DiagramWrapper } from './DiagramWrapper';

/** Chart.js node with proper parsing from code blocks */
const ChartJsNode = Node.create({
  name: 'chartjs',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      config: {
        default: '{}',
        parseHTML: element => element.getAttribute('data-config') || '{}',
        renderHTML: attributes => ({
          'data-config': attributes.config,
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
          return {
            config: element.getAttribute('data-config') || '{}'
          };
        }
      },
      // Parse from code blocks with language="chartjs"
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return false;
          const element = dom as HTMLElement;
          const code = element.querySelector('code[class*="language-chartjs"]');
          if (!code) return false;

          return {
            config: code.textContent || '{}'
          };
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

/** Mermaid node with proper parsing from code blocks */
const MermaidNode = Node.create({
  name: 'mermaid',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      code: {
        default: '',
        parseHTML: element => element.getAttribute('data-code') || '',
        renderHTML: attributes => ({
          'data-code': attributes.code,
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
          return {
            code: element.getAttribute('data-code') || ''
          };
        }
      },
      // Parse from code blocks with language="mermaid"
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return false;
          const element = dom as HTMLElement;
          const code = element.querySelector('code[class*="language-mermaid"]');
          if (!code) return false;

          return {
            code: code.textContent || ''
          };
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

/** Graphviz (DOT) node with proper parsing from code blocks */
const DotNode = Node.create({
  name: 'dot',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      code: {
        default: '',
        parseHTML: element => element.getAttribute('data-code') || '',
        renderHTML: attributes => ({
          'data-code': attributes.code,
        }),
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
          return {
            code: element.getAttribute('data-code') || ''
          };
        }
      },
      // Parse from code blocks with language="dot" or "graphviz"
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return false;
          const element = dom as HTMLElement;
          const code = element.querySelector('code[class*="language-dot"], code[class*="language-graphviz"]');
          if (!code) return false;

          return {
            code: code.textContent || ''
          };
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
}

export const NoteContentArea = forwardRef<any, NoteContentAreaProps>(
  ({ content, setContent, note, userProfile, title }, ref) => {
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

    // ✅ Fix 2: Convert AI Markdown responses before inserting
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

    // ✅ Universal Diagram Rendering & AI Markdown Processing Fix
    // Applies to Mermaid, Chart.js, and Graphviz (DOT) diagrams
    // Ensures diagrams render automatically when Markdown or AI content is inserted

    // --- Add this inside NoteContentArea.tsx ---

    // ✅ Fix 1: Auto-render diagrams from Markdown
    useEffect(() => {
      if (!editor) return;

      const html = editor.getHTML();
      const container = document.createElement('div');
      container.innerHTML = html;

      // 1️⃣ Convert Mermaid code blocks to custom nodes
      const mermaidBlocks = container.querySelectorAll('pre code.language-mermaid');
      mermaidBlocks.forEach((block) => {
        const code = block.textContent || '';
        const div = document.createElement('div');
        div.setAttribute('data-mermaid', '');
        div.setAttribute('data-code', code);
        block.parentElement?.replaceWith(div);
      });

      // 2️⃣ Convert Chart.js code blocks to custom nodes
      const chartBlocks = container.querySelectorAll('pre code.language-chartjs');
      chartBlocks.forEach((block) => {
        const config = block.textContent || '{}';
        const div = document.createElement('div');
        div.setAttribute('data-chartjs', '');
        div.setAttribute('data-config', config);
        block.parentElement?.replaceWith(div);
      });

      // 3️⃣ Convert DOT/Graphviz code blocks to custom nodes
      const dotBlocks = container.querySelectorAll('pre code.language-dot, pre code.language-graphviz');
      dotBlocks.forEach((block) => {
        const code = block.textContent || '';
        const div = document.createElement('div');
        div.setAttribute('data-dot', '');
        div.setAttribute('data-code', code);
        block.parentElement?.replaceWith(div);
      });

      // If any conversion occurred, re-set content in editor
      if (mermaidBlocks.length + chartBlocks.length + dotBlocks.length > 0) {
        // Defer content reset to prevent flushSync warning
        Promise.resolve().then(() => {
          if (editor?.commands) {
            editor.commands.setContent(container.innerHTML, false);
          }
        });
      }

    }, [editor, content]);



    // ✅ Fix 3: Reactive rendering for any unrendered diagrams
    useEffect(() => {
      const renderAllDiagrams = async () => {
        // Mermaid
        // ✅ Safe Mermaid rendering with graceful error handling
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
            //console.warn('Mermaid render error:', err);

            // Render friendly error message instead of bomb
            div.innerHTML = `
      <div style="
        border: 1px solid #ef4444;
        background: rgba(239,68,68,0.1);
        color: #ef4444;
        padding: 0.75rem;
        border-radius: 0.5rem;
        font-size: 0.85rem;
        font-family: system-ui, sans-serif;
      ">
        <strong>⚠️ Mermaid Diagram Error</strong><br>
        ${err.message ? err.message.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Invalid Mermaid syntax.'}
      </div>
    `;
            div.classList.add('mermaid-error');
          }
        }


        // Chart.js
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
            //console.warn('Chart.js render error:', err);
          }
        }

        // Graphviz (DOT)
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
            //console.warn('DOT render error:', err);
          }
        }
      };

      renderAllDiagrams();
    }, [editor?.getHTML()]);


    return (
      <div className="flex flex-col flex-1 bg-white dark:bg-gray-900">
        {/* Add custom styles for code highlighting */}
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

          .dark .ProseMirror pre {
            background: #0d1117;
            
          }

          

          .dark .ProseMirror code {
            background: #0d1117;
            color:rgb(199, 199, 199);
          }

          /* Syntax highlighting colors */
          .hljs-comment { color: #6a9955; }
          .hljs-keyword { color: #569cd6; }
          .hljs-string { color: #ce9178; }
          .hljs-number { color: #b5cea8; }
          .hljs-function { color: #dcdcaa; }
          .hljs-class { color: #4ec9b0; }
          .hljs-variable { color: #9cdcfe; }
          .hljs-operator { color: #d4d4d4; }
          .hljs-punctuation { color: #d4d4d4; }
          .hljs-attr { color: #9cdcfe; }
          .hljs-title { color: #dcdcaa; }
          .hljs-built_in { color: #4ec9b0; }
          .hljs-literal { color: #569cd6; }
          .hljs-tag { color: #569cd6; }
          .hljs-name { color: #4ec9b0; }
          .hljs-attribute { color: #9cdcfe; }

          /* Better table styling */
          .ProseMirror table {
            border-collapse: collapse;
            margin: 1rem 0;
            width: 100%;
          }

          .ProseMirror td,
          .ProseMirror th {
            border: 1px solid #d1d5db;
            padding: 0.5rem;
            text-align: left;
          }

          .dark .ProseMirror td,
          .dark .ProseMirror th {
            border-color: #374151;
          }

          .ProseMirror th {
            background: #f3f4f6;
            font-weight: 600;
          }

          .dark .ProseMirror th {
            background: #1f2937;
          }
          .mermaid-error {
            background: rgba(239,68,68,0.1);
            border: 1px solid #ef4444;
            color: #ef4444;
          }
          .dark .mermaid-error {
            background: rgba(239,68,68,0.2);
            border-color: #f87171;
            color: #fca5a5;
          }

        `}</style>

        {/* ---------- Toolbar ---------- */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 flex max-w-[100vw] gap-1 items-center overflow-x-auto">
          <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30" title="Undo"><Undo className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30" title="Redo"><Redo className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('bold') ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}`} title="Bold"><Bold className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('italic') ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}`} title="Italic"><Italic className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('underline') ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}`} title="Underline"><UnderlineIcon className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('strike') ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}`} title="Strike"><Strikethrough className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleCode().run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('code') ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}`} title="Inline Code"><Code className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}`} title="H1"><Heading1 className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}`} title="H2"><Heading2 className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('heading', { level: 3 }) ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}`} title="H3"><Heading3 className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('bulletList') ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}`} title="Bullet List"><List className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('orderedList') ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}`} title="Numbered List"><ListOrdered className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('blockquote') ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}`} title="Quote"><Quote className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${editor.isActive('codeBlock') ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : ''}`} title="Code Block"><Code className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="Left"><AlignLeft className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="Center"><AlignCenter className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="Right"><AlignRight className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <button
            onClick={() => {
              const url = prompt('Enter link URL:');
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Link"
          ><LinkIcon className="w-4 h-4" /></button>
          <button
            onClick={() => {
              const url = prompt('Enter image URL:');
              if (url) editor.chain().focus().setImage({ src: url }).run();
            }}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Image"
          ><ImageIcon className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="Table"><TableIcon className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          {/* Diagram dropdown */}
          <div className="relative group">
            <button className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-1" title="Insert Diagram">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-1 hidden group-hover:block z-10 min-w-[160px]">
              <button onClick={() => insertDiagram('chartjs')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded">Chart.js</button>
              <button onClick={() => insertDiagram('mermaid')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded">Mermaid</button>
              <button onClick={() => insertDiagram('dot')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded">Graphviz</button>
            </div>
          </div>

          <button onClick={startAI} className="p-2 rounded hover:bg-gradient-to-r hover:from-purple-500 hover:to-blue-500 hover:text-white" title="AI Edit"><Sparkles className="w-4 h-4" /></button>

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
        <div className="flex-1 overflow-auto max-h-[80vh] relative bg-white dark:bg-gray-900">
          <EditorContent editor={editor} className="h-full" />
        </div>

        {/* ---------- Status Bar ---------- */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 text-xs text-gray-600 dark:text-gray-400 flex justify-between bg-gray-50 dark:bg-gray-800">
          <span>
            {content.length} chars • {content.split(/\s+/).filter(Boolean).length} words
          </span>
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
          <div className="absolute right-4 top-16 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-900 dark:text-gray-100">Generate Flashcards</label>
              <button onClick={() => setShowMenu(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><XCircle className="w-4 h-4 text-gray-500" /></button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <input
                type="number"
                min={1}
                max={50}
                value={cardCount}
                onChange={e => setCardCount(Math.min(50, Math.max(1, +e.target.value)))}
                className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">flashcards</span>
            </div>

            <button
              onClick={generate}
              disabled={generating}
              className="w-full mb-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center gap-2 font-medium transition-all"
            >
              {generating ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate {cardCount} Cards
                </>
              )}
            </button>

            <button
              onClick={() => { setShowDeck(p => !p); setShowMenu(false); }}
              className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
            >
              {showDeck ? 'Hide' : 'Show'} Flashcards
            </button>
          </div>
        )}

        {/* ---------- Flashcard Deck ---------- */}
        {showDeck && (
          <div className="mt-6 border-t pt-6 pb-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
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