// utils/syntaxHighlighting.ts
import { lowlight } from 'lowlight';
import { LanguageFn } from 'highlight.js';

// Import languages for syntax highlighting
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import sql from 'highlight.js/lib/languages/sql';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/typescript';

// Register languages
lowlight.registerLanguage('javascript', javascript as LanguageFn);
lowlight.registerLanguage('python', python as LanguageFn);
lowlight.registerLanguage('java', java as LanguageFn);
lowlight.registerLanguage('cpp', cpp as LanguageFn);
lowlight.registerLanguage('sql', sql as LanguageFn);
lowlight.registerLanguage('xml', xml as LanguageFn);
lowlight.registerLanguage('bash', bash as LanguageFn);
lowlight.registerLanguage('json', json as LanguageFn);

// Helper function to escape HTML
const escapeHtml = (text: string) => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

// Helper function to convert lowlight result to HTML with inline styles
const toHtml = (result: any) => {
  const nodeToHtml = (node: any): string => {
    if (node.type === 'text') {
      return escapeHtml(node.value);
    }
    if (node.type === 'element') {
      const { tagName, properties, children } = node;
      const classNames = (properties?.className || []).join(' ');

      const styleMap: { [key: string]: string } = {
        'hljs-comment': 'color: #9ca3af; font-style: italic;',
        'hljs-keyword': 'color: #c084fc; font-weight: 600;',
        'hljs-string': 'color: #86efac;',
        'hljs-number': 'color: #fdba74;',
        'hljs-built_in': 'color: #93c5fd; font-weight: 500;',
        'hljs-function': 'color: #93c5fd; font-weight: 500;',
        'hljs-variable': 'color: #bfdbfe;',
        'hljs-type': 'color: #5eead4;',
        'hljs-class': 'color: #fcd34d;',
        'hljs-attr': 'color: #93c5fd;',
        'hljs-tag': 'color: #f472b6;',
        'hljs-operator': 'color: #fbcfe8;',
        'hljs-literal': 'color: #fdba74;',
        'hljs-meta': 'color: #7dd3fc;',
        'hljs-title': 'color: #86efac;',
        'hljs-selector-tag': 'color: #c084fc;',
        'hljs-selector-class': 'color: #86efac;',
        'hljs-selector-id': 'color: #fca5a5;',
        'hljs-regexp': 'color: #f472b6;',
        'hljs-symbol': 'color: #fca5a5;',
        'hljs-bullet': 'color: #fbcfe8;',
        'hljs-params': 'color: #fde68a;',
        'hljs-name': 'color: #93c5fd;',
        'hljs-attribute': 'color: #fcd34d;',
        'hljs-selector-attr': 'color: #67e8f9;',
        'hljs-selector-pseudo': 'color: #fbcfe8;',
        'hljs-template-variable': 'color: #bfdbfe;',
        'hljs-quote': 'color: #9ca3af; font-style: italic;',
        'hljs-deletion': 'color: #f87171; background-color: #450a0a;',
        'hljs-addition': 'color: #4ade80; background-color: #064e3b;',
        'hljs-meta-keyword': 'color: #7dd3fc; font-weight: 600;',
        'hljs-meta-string': 'color: #38bdf8;',
        'hljs-subst': 'color: #c084fc;',
        'hljs-section': 'color: #86efac;',
        'hljs-boolean': 'color: #fdba74;',
      };

      let style = '';
      classNames.split(' ').forEach(cls => {
        if (styleMap[cls]) {
          style += styleMap[cls] + ' ';
        }
      });

      const childrenHtml = children?.map(nodeToHtml).join('') || '';
      return `<${tagName}${style ? ` style="${style.trim()}"` : ''}>${childrenHtml}</${tagName}>`;
    }
    return '';
  };

  return result.children.map(nodeToHtml).join('');
};

// Enhanced syntax highlighting function
export const highlightCode = (code: string, language: string) => {
  try {
    const result = lowlight.highlight(language, code);
    return toHtml(result);
  } catch (error) {
    console.warn('Syntax highlighting failed:', error);
    return escapeHtml(code);
  }
};

// Define a mapping of highlight.js classes to Tailwind CSS color classes for dark theme
export const syntaxColorMap: { [key: string]: string } = {
  'hljs-comment': 'text-gray-400',
  'hljs-keyword': 'text-purple-300',
  'hljs-built_in': 'text-cyan-300',
  'hljs-string': 'text-green-300',
  'hljs-variable': 'text-blue-200',
  'hljs-number': 'text-orange-200',
  'hljs-literal': 'text-orange-200',
  'hljs-function': 'text-blue-200',
  'hljs-params': 'text-yellow-200',
  'hljs-tag': 'text-pink-300',
  'hljs-attr': 'text-cyan-300',
  'hljs-selector-tag': 'text-purple-300',
  'hljs-selector-id': 'text-orange-300',
  'hljs-selector-class': 'text-green-300',
  'hljs-regexp': 'text-pink-300',
  'hljs-meta': 'text-sky-300',
  'hljs-type': 'text-teal-300',
  'hljs-symbol': 'text-red-300',
  'hljs-operator': 'text-pink-200',
  'hljs-code-text': 'text-gray-100',
};