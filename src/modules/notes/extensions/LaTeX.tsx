// LaTeX extension for Tiptap
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Extend Tiptap commands
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    latex: {
      insertLaTeX: (attrs: { latex: string; displayMode?: boolean }) => ReturnType;
    };
    inlineLatex: {
      insertInlineLaTeX: (latex: string) => ReturnType;
    };
  }
}

// LaTeX component
const LaTeXComponent = ({ node, updateAttributes, deleteNode }: any) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [latex, setLatex] = React.useState(node.attrs.latex || '');
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || isEditing) return;

    try {
      katex.render(latex, containerRef.current, {
        displayMode: node.attrs.displayMode,
        throwOnError: false,
        errorColor: '#cc0000',
      });
      setError(null);
    } catch (err: any) {
      setError(err.message);
      if (containerRef.current) {
        containerRef.current.innerHTML = `<span style="color: #cc0000;">LaTeX Error: ${err.message}</span>`;
      }
    }
  }, [latex, isEditing, node.attrs.displayMode]);

  const handleSave = () => {
    updateAttributes({ latex });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLatex(node.attrs.latex || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <NodeViewWrapper className="latex-editor-wrapper">
        <div className="border rounded-lg p-3 bg-muted/50 my-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {node.attrs.displayMode ? 'Block LaTeX' : 'Inline LaTeX'}
            </span>
            <span className="text-xs text-muted-foreground">
              (Use $ for inline, $$ for display mode)
            </span>
          </div>
          <textarea
            value={latex}
            onChange={(e) => setLatex(e.target.value)}
            placeholder="Enter LaTeX code (e.g., E = mc^2)"
            className="w-full p-2 border rounded bg-background font-mono text-sm min-h-[80px] resize-y"
            autoFocus
          />
          {error && (
            <div className="text-xs text-red-500 mt-1">Error: {error}</div>
          )}
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSave}
              className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
            >
              Cancel
            </button>
            <button
              onClick={deleteNode}
              className="px-3 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 ml-auto"
            >
              Delete
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className={node.attrs.displayMode ? 'latex-display' : 'latex-inline'}
      style={{
        display: node.attrs.displayMode ? 'block' : 'inline-block',
        cursor: 'pointer',
        padding: node.attrs.displayMode ? '0.5rem 0' : '0 0.2rem',
        margin: node.attrs.displayMode ? '0.5rem 0' : '0',
      }}
      onClick={() => setIsEditing(true)}
    >
      <div
        ref={containerRef}
        className={error ? 'latex-error' : ''}
        style={{
          minWidth: '20px',
          minHeight: '20px',
        }}
      />
    </NodeViewWrapper>
  );
};

// LaTeX Tiptap extension
export const LaTeX = Node.create({
  name: 'latex',

  group: 'block',

  inline: false,

  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
      },
      displayMode: {
        default: true,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-latex]',
        getAttrs: (dom) => ({
          latex: (dom as HTMLElement).getAttribute('data-latex') || '',
          displayMode: (dom as HTMLElement).getAttribute('data-display-mode') === 'true',
        }),
      },
      {
        tag: 'span[data-latex]',
        getAttrs: (dom) => ({
          latex: (dom as HTMLElement).getAttribute('data-latex') || '',
          displayMode: false,
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const tag = HTMLAttributes.displayMode ? 'div' : 'span';
    return [
      tag,
      mergeAttributes(HTMLAttributes, {
        'data-latex': HTMLAttributes.latex,
        'data-display-mode': HTMLAttributes.displayMode,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LaTeXComponent);
  },

  addCommands() {
    return {
      insertLaTeX:
        (attrs: { latex: string; displayMode?: boolean }) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              latex: attrs.latex,
              displayMode: attrs.displayMode ?? true,
            },
          });
        },
    };
  },
});

// Inline LaTeX extension
export const InlineLaTeX = Node.create({
  name: 'inlineLatex',

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span.inline-latex',
        getAttrs: (dom) => ({
          latex: (dom as HTMLElement).getAttribute('data-latex') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'inline-latex',
        'data-latex': HTMLAttributes.latex,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer((props) => (
      <LaTeXComponent {...props} node={{ ...props.node, attrs: { ...props.node.attrs, displayMode: false } }} />
    ));
  },

  addCommands() {
    return {
      insertInlineLaTeX:
        (latex: string) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs: { latex },
          });
        },
    };
  },
});
