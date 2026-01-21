import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import TurndownService from 'turndown';
import * as gfm from 'turndown-plugin-gfm';

const mdProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify);

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});
turndown.use(gfm.gfm);

// Add a specific rule for diagrams to ensure they are always fenced with the correct language
turndown.addRule('fencedDiagrams', {
  filter: (node) => {
    return (
      node.nodeName === 'PRE' &&
      node.firstChild &&
      node.firstChild.nodeName === 'CODE' &&
      /language-(chartjs|mermaid|dot)/.test((node.firstChild as HTMLElement).className)
    );
  },
  replacement: (content, node) => {
    const codeElement = node.firstChild as HTMLElement;
    const className = codeElement.className || '';
    const language = className.match(/language-(\w+)/)?.[1] || 'text';
    const code = codeElement.textContent || '';
    return `\n\n\`\`\`${language}\n${code.trim()}\n\`\`\`\n\n`;
  }
});

export const convertMarkdownToHtml = (markdown: string): string => {
  if (!markdown || !markdown.trim()) return '';
  try {
    const html = mdProcessor.processSync(markdown).toString();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Find all code blocks and check if they are diagrams
    const codeBlocks = tempDiv.querySelectorAll('pre code');
    codeBlocks.forEach((codeBlock) => {
      const text = codeBlock.textContent || '';
      const className = codeBlock.className || '';
      const parent = codeBlock.closest('pre') || codeBlock;

      // Check for Chart.js
      if (className.includes('language-chartjs') || text.trim().startsWith('{"type":') || text.includes('"datasets"')) {
        const chartDiv = document.createElement('div');
        chartDiv.setAttribute('data-chartjs', '');

        let finalConfig = text.trim();
        let height = '400px';

        const heightMatch = finalConfig.match(/^\/\/ height: ([\w\d]+px)/);
        if (heightMatch) {
          height = heightMatch[1];
          finalConfig = finalConfig.replace(/^\/\/ height: [\w\d]+px\n?/, '');
        }

        chartDiv.setAttribute('data-config', finalConfig);
        chartDiv.setAttribute('data-height', height);
        parent.replaceWith(chartDiv);
      }
      // Check for Mermaid
      else if (className.includes('language-mermaid') || text.trim().startsWith('graph ') || text.trim().startsWith('sequenceDiagram') || text.trim().startsWith('gantt')) {
        const mermaidDiv = document.createElement('div');
        mermaidDiv.setAttribute('data-mermaid', '');

        let finalCode = text.trim();
        let height = '300px';

        const heightMatch = finalCode.match(/^%% height: ([\w\d]+px)/);
        if (heightMatch) {
          height = heightMatch[1];
          finalCode = finalCode.replace(/^%% height: [\w\d]+px\n?/, '');
        }

        mermaidDiv.setAttribute('data-code', finalCode);
        mermaidDiv.setAttribute('data-height', height);
        parent.replaceWith(mermaidDiv);
      }
      // Check for DOT
      else if (className.includes('language-dot') || className.includes('language-graphviz') || text.trim().startsWith('digraph ') || text.trim().startsWith('graph {')) {
        const dotDiv = document.createElement('div');
        dotDiv.setAttribute('data-dot', '');

        let finalCode = text.trim();
        let height = '300px';

        const heightMatch = finalCode.match(/^\/\* height: ([\w\d]+px) \*\//);
        if (heightMatch) {
          height = heightMatch[1];
          finalCode = finalCode.replace(/^\/\* height: [\w\d]+px \*\/ \n?/, '');
        }

        dotDiv.setAttribute('data-code', finalCode);
        dotDiv.setAttribute('data-height', height);
        parent.replaceWith(dotDiv);
      }
    });

    return tempDiv.innerHTML;
  } catch (error) {
    //console.error('Error converting markdown to HTML:', error);
    return markdown;
  }
};

export const convertHtmlToMarkdown = (html: string): string => {
  if (!html) return '';
  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Manually convert diagram divs to code blocks before turndown
    tempDiv.querySelectorAll('div[data-chartjs]').forEach(node => {
      const config = node.getAttribute('data-config') || '{}';
      const height = node.getAttribute('data-height') || '400px';
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.className = 'language-chartjs';
      code.textContent = `// height: ${height}\n${config}`;
      pre.appendChild(code);
      node.replaceWith(pre);
    });

    tempDiv.querySelectorAll('div[data-mermaid]').forEach(node => {
      const codeContent = node.getAttribute('data-code') || '';
      const height = node.getAttribute('data-height') || '300px';
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.className = 'language-mermaid';
      code.textContent = `%% height: ${height}\n${codeContent}`;
      pre.appendChild(code);
      node.replaceWith(pre);
    });

    tempDiv.querySelectorAll('div[data-dot]').forEach(node => {
      const codeContent = node.getAttribute('data-code') || '';
      const height = node.getAttribute('data-height') || '300px';
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.className = 'language-dot';
      code.textContent = `/* height: ${height} */\n${codeContent}`;
      pre.appendChild(code);
      node.replaceWith(pre);
    });

    return turndown.turndown(tempDiv.innerHTML);
  } catch (error) {
    //console.error('Error converting HTML to markdown:', error);
    return html;
  }
};
