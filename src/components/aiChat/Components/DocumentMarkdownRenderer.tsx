import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface DocumentMarkdownRendererProps {
  content?: string | null;
  className?: string;
}

const CodeBlock: React.FC<any> = ({ inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  if (!inline && match) {
    const language = match[1];
    return (
      <SyntaxHighlighter style={vscDarkPlus} language={language} PreTag="div" customStyle={{ margin: 0 }}>
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    );
  }
  return (
    <code className={String(className || '')} {...props}>
      {children}
    </code>
  );
};

const Heading: React.FC<any> = ({ level, children }) => {
  const text = String(children).replace(/\s+/g, '-').toLowerCase();
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return (
    <Tag id={text} className="mt-4 mb-2 font-semibold">
      {children}
    </Tag>
  );
};

const DocumentMarkdownRenderer: React.FC<DocumentMarkdownRendererProps> = ({ content, className }) => {
  if (!content) return null;

  return (
    <div className={`w-full h-full overflow-auto p-4 ${className || ''}`}>
      <div className="prose prose-sm dark:prose-invert max-w-full">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            code: CodeBlock,
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-300 underline">
                {children}
              </a>
            ),
            blockquote: ({ children }) => (
              <blockquote className="pl-4 border-l-4 border-gray-300 dark:border-gray-700 italic text-gray-600 dark:text-gray-300">
                {children}
              </blockquote>
            ),
            li: ({ children }) => <li className="mb-1">{children}</li>,
            h1: (props) => <Heading level={1} {...props} />,
            h2: (props) => <Heading level={2} {...props} />,
            h3: (props) => <Heading level={3} {...props} />,
            h4: (props) => <Heading level={4} {...props} />,
            h5: (props) => <Heading level={5} {...props} />,
            h6: (props) => <Heading level={6} {...props} />,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default memo(DocumentMarkdownRenderer);
