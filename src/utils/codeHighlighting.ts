// src/utils/codeHighlighting.ts

import { lowlight } from 'lowlight';
import { LanguageFn } from 'highlight.js';

// Import more language definitions
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import sql from 'highlight.js/lib/languages/sql';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import typescript from 'highlight.js/lib/languages/typescript';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import scala from 'highlight.js/lib/languages/scala';
import perl from 'highlight.js/lib/languages/perl';
import r from 'highlight.js/lib/languages/r';
import matlab from 'highlight.js/lib/languages/matlab';
import lua from 'highlight.js/lib/languages/lua';
import powershell from 'highlight.js/lib/languages/powershell';
import dockerfile from 'highlight.js/lib/languages/dockerfile';

// Language registry with error handling
const registerLanguage = (name: string, language: LanguageFn, aliases: string[] = []) => {
  try {
    lowlight.registerLanguage(name, language);
    aliases.forEach(alias => {
      try {
        lowlight.registerLanguage(alias, language);
      } catch (error) {
        console.warn(`Failed to register language alias "${alias}":`, error);
      }
    });
  } catch (error) {
    console.warn(`Failed to register language "${name}":`, error);
  }
};

// Register languages with aliases
registerLanguage('javascript', javascript, ['js', 'jsx', 'mjs']);
registerLanguage('typescript', typescript, ['ts', 'tsx']);
registerLanguage('python', python, ['py', 'py3', 'python3']);
registerLanguage('java', java, ['class']);
registerLanguage('cpp', cpp, ['c++', 'cc', 'cxx', 'c']);
registerLanguage('sql', sql, ['mysql', 'postgresql', 'sqlite']);
registerLanguage('xml', xml, ['html', 'xhtml', 'svg']);
registerLanguage('bash', bash, ['sh', 'shell', 'zsh', 'fish']);
registerLanguage('json', json, ['jsonc']);
registerLanguage('css', css, ['scss', 'sass', 'less']);
registerLanguage('yaml', yaml, ['yml']);
registerLanguage('markdown', markdown, ['md', 'mkd']);
registerLanguage('php', php, ['php3', 'php4', 'php5', 'php7', 'php8']);
registerLanguage('ruby', ruby, ['rb', 'rbw']);
registerLanguage('go', go, ['golang']);
registerLanguage('rust', rust, ['rs']);
registerLanguage('swift', swift, []);
registerLanguage('kotlin', kotlin, ['kt', 'kts']);
registerLanguage('scala', scala, []);
registerLanguage('perl', perl, ['pl', 'pm']);
registerLanguage('r', r, []);
registerLanguage('matlab', matlab, ['m']);
registerLanguage('lua', lua, []);
registerLanguage('powershell', powershell, ['ps1', 'psd1', 'psm1']);
registerLanguage('dockerfile', dockerfile, ['docker']);

// Enhanced themes with better color schemes and accessibility
export const themes = {
  'github-light': {
    background: '#ffffff',
    foreground: '#24292f',
    lineNumbers: '#656d76',
    selection: '#0969da1a',
    border: '#d1d9e0',
    scrollbar: '#d1d9e0',
    searchHighlight: '#fff3cd',
    colors: {
      'hljs-comment': '#6e7781',
      'hljs-quote': '#6e7781',
      'hljs-keyword': '#cf222e',
      'hljs-selector-tag': '#116329',
      'hljs-subst': '#24292f',
      'hljs-built_in': '#0550ae',
      'hljs-type': '#953800',
      'hljs-class': '#953800',
      'hljs-string': '#0a3069',
      'hljs-title': '#8250df',
      'hljs-section': '#0550ae',
      'hljs-number': '#0550ae',
      'hljs-literal': '#0550ae',
      'hljs-boolean': '#0550ae',
      'hljs-variable': '#e36209',
      'hljs-template-variable': '#e36209',
      'hljs-function': '#8250df',
      'hljs-name': '#8250df',
      'hljs-params': '#24292f',
      'hljs-attr': '#116329',
      'hljs-attribute': '#116329',
      'hljs-tag': '#116329',
      'hljs-selector-id': '#0550ae',
      'hljs-selector-class': '#6f42c1',
      'hljs-selector-attr': '#0550ae',
      'hljs-selector-pseudo': '#0550ae',
      'hljs-operator': '#cf222e',
      'hljs-symbol': '#cf222e',
      'hljs-bullet': '#cf222e',
      'hljs-regexp': '#116329',
      'hljs-meta': '#8250df',
      'hljs-meta-keyword': '#cf222e',
      'hljs-meta-string': '#0a3069',
      'hljs-addition': '#116329',
      'hljs-deletion': '#82071e',
    }
  },
  'github-dark': {
    background: '#0d1117',
    foreground: '#e6edf3',
    lineNumbers: '#7d8590',
    selection: '#388bfd26',
    border: '#30363d',
    scrollbar: '#30363d',
    searchHighlight: '#bb800966',
    colors: {
      'hljs-comment': '#8b949e',
      'hljs-quote': '#8b949e',
      'hljs-keyword': '#ff7b72',
      'hljs-selector-tag': '#7ee787',
      'hljs-subst': '#e6edf3',
      'hljs-built_in': '#79c0ff',
      'hljs-type': '#ffa657',
      'hljs-class': '#ffa657',
      'hljs-string': '#a5d6ff',
      'hljs-title': '#d2a8ff',
      'hljs-section': '#79c0ff',
      'hljs-number': '#79c0ff',
      'hljs-literal': '#79c0ff',
      'hljs-boolean': '#79c0ff',
      'hljs-variable': '#ffa657',
      'hljs-template-variable': '#ffa657',
      'hljs-function': '#d2a8ff',
      'hljs-name': '#d2a8ff',
      'hljs-params': '#e6edf3',
      'hljs-attr': '#7ee787',
      'hljs-attribute': '#7ee787',
      'hljs-tag': '#7ee787',
      'hljs-selector-id': '#79c0ff',
      'hljs-selector-class': '#d2a8ff',
      'hljs-selector-attr': '#79c0ff',
      'hljs-selector-pseudo': '#79c0ff',
      'hljs-operator': '#ff7b72',
      'hljs-symbol': '#ff7b72',
      'hljs-bullet': '#ff7b72',
      'hljs-regexp': '#7ee787',
      'hljs-meta': '#d2a8ff',
      'hljs-meta-keyword': '#ff7b72',
      'hljs-meta-string': '#a5d6ff',
      'hljs-addition': '#aff5b4',
      'hljs-deletion': '#ffdcd7',
    }
  },
  'vs-code-dark': {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    lineNumbers: '#858585',
    selection: '#264f78',
    border: '#3c3c3c',
    scrollbar: '#3c3c3c',
    searchHighlight: '#bb800966',
    colors: {
      'hljs-comment': '#6a9955',
      'hljs-quote': '#6a9955',
      'hljs-keyword': '#569cd6',
      'hljs-selector-tag': '#4ec9b0',
      'hljs-subst': '#d4d4d4',
      'hljs-built_in': '#4ec9b0',
      'hljs-type': '#4ec9b0',
      'hljs-class': '#4ec9b0',
      'hljs-string': '#ce9178',
      'hljs-title': '#dcdcaa',
      'hljs-section': '#569cd6',
      'hljs-number': '#b5cea8',
      'hljs-literal': '#569cd6',
      'hljs-boolean': '#569cd6',
      'hljs-variable': '#9cdcfe',
      'hljs-template-variable': '#9cdcfe',
      'hljs-function': '#dcdcaa',
      'hljs-name': '#dcdcaa',
      'hljs-params': '#d4d4d4',
      'hljs-attr': '#92c5f8',
      'hljs-attribute': '#92c5f8',
      'hljs-tag': '#569cd6',
      'hljs-selector-id': '#d7ba7d',
      'hljs-selector-class': '#d7ba7d',
      'hljs-selector-attr': '#ce9178',
      'hljs-selector-pseudo': '#ce9178',
      'hljs-operator': '#d4d4d4',
      'hljs-symbol': '#569cd6',
      'hljs-bullet': '#569cd6',
      'hljs-regexp': '#d16969',
      'hljs-meta': '#569cd6',
      'hljs-meta-keyword': '#569cd6',
      'hljs-meta-string': '#ce9178',
      'hljs-addition': '#b5cea8',
      'hljs-deletion': '#d16969',
    }
  },
  'monokai': {
    background: '#272822',
    foreground: '#f8f8f2',
    lineNumbers: '#75715e',
    selection: '#49483e',
    border: '#3e3d32',
    scrollbar: '#3e3d32',
    searchHighlight: '#bb800966',
    colors: {
      'hljs-comment': '#75715e',
      'hljs-quote': '#75715e',
      'hljs-keyword': '#f92672',
      'hljs-selector-tag': '#f92672',
      'hljs-subst': '#f8f8f2',
      'hljs-built_in': '#66d9ef',
      'hljs-type': '#66d9ef',
      'hljs-class': '#a6e22e',
      'hljs-string': '#e6db74',
      'hljs-title': '#a6e22e',
      'hljs-section': '#a6e22e',
      'hljs-number': '#ae81ff',
      'hljs-literal': '#ae81ff',
      'hljs-boolean': '#ae81ff',
      'hljs-variable': '#f8f8f2',
      'hljs-template-variable': '#f8f8f2',
      'hljs-function': '#a6e22e',
      'hljs-name': '#a6e22e',
      'hljs-params': '#fd971f',
      'hljs-attr': '#a6e22e',
      'hljs-attribute': '#a6e22e',
      'hljs-tag': '#f92672',
      'hljs-selector-id': '#a6e22e',
      'hljs-selector-class': '#a6e22e',
      'hljs-selector-attr': '#66d9ef',
      'hljs-selector-pseudo': '#66d9ef',
      'hljs-operator': '#f92672',
      'hljs-symbol': '#f92672',
      'hljs-bullet': '#f92672',
      'hljs-regexp': '#e6db74',
      'hljs-meta': '#75715e',
      'hljs-meta-keyword': '#f92672',
      'hljs-meta-string': '#e6db74',
      'hljs-addition': '#a6e22e',
      'hljs-deletion': '#f92672',
    }
  },
  'dracula': {
    background: '#282a36',
    foreground: '#f8f8f2',
    lineNumbers: '#6272a4',
    selection: '#44475a',
    border: '#44475a',
    scrollbar: '#44475a',
    searchHighlight: '#bb800966',
    colors: {
      'hljs-comment': '#6272a4',
      'hljs-quote': '#6272a4',
      'hljs-keyword': '#ff79c6',
      'hljs-selector-tag': '#ff79c6',
      'hljs-subst': '#f8f8f2',
      'hljs-built_in': '#8be9fd',
      'hljs-type': '#8be9fd',
      'hljs-class': '#50fa7b',
      'hljs-string': '#f1fa8c',
      'hljs-title': '#50fa7b',
      'hljs-section': '#50fa7b',
      'hljs-number': '#bd93f9',
      'hljs-literal': '#bd93f9',
      'hljs-boolean': '#bd93f9',
      'hljs-variable': '#f8f8f2',
      'hljs-template-variable': '#f8f8f2',
      'hljs-function': '#50fa7b',
      'hljs-name': '#50fa7b',
      'hljs-params': '#ffb86c',
      'hljs-attr': '#50fa7b',
      'hljs-attribute': '#50fa7b',
      'hljs-tag': '#ff79c6',
      'hljs-selector-id': '#50fa7b',
      'hljs-selector-class': '#50fa7b',
      'hljs-selector-attr': '#8be9fd',
      'hljs-selector-pseudo': '#8be9fd',
      'hljs-operator': '#ff79c6',
      'hljs-symbol': '#ff79c6',
      'hljs-bullet': '#ff79c6',
      'hljs-regexp': '#f1fa8c',
      'hljs-meta': '#6272a4',
      'hljs-meta-keyword': '#ff79c6',
      'hljs-meta-string': '#f1fa8c',
      'hljs-addition': '#50fa7b',
      'hljs-deletion': '#ff5555',
    }
  },
  'nord': {
    background: '#2e3440',
    foreground: '#d8dee9',
    lineNumbers: '#616e88',
    selection: '#434c5e',
    border: '#3b4252',
    scrollbar: '#3b4252',
    searchHighlight: '#bb800966',
    colors: {
      'hljs-comment': '#616e88',
      'hljs-quote': '#616e88',
      'hljs-keyword': '#81a1c1',
      'hljs-selector-tag': '#81a1c1',
      'hljs-subst': '#d8dee9',
      'hljs-built_in': '#88c0d0',
      'hljs-type': '#88c0d0',
      'hljs-class': '#a3be8c',
      'hljs-string': '#a3be8c',
      'hljs-title': '#8fbcbb',
      'hljs-section': '#8fbcbb',
      'hljs-number': '#b48ead',
      'hljs-literal': '#b48ead',
      'hljs-boolean': '#b48ead',
      'hljs-variable': '#d8dee9',
      'hljs-template-variable': '#d8dee9',
      'hljs-function': '#8fbcbb',
      'hljs-name': '#8fbcbb',
      'hljs-params': '#d08770',
      'hljs-attr': '#8fbcbb',
      'hljs-attribute': '#8fbcbb',
      'hljs-tag': '#81a1c1',
      'hljs-selector-id': '#8fbcbb',
      'hljs-selector-class': '#8fbcbb',
      'hljs-selector-attr': '#88c0d0',
      'hljs-selector-pseudo': '#88c0d0',
      'hljs-operator': '#81a1c1',
      'hljs-symbol': '#81a1c1',
      'hljs-bullet': '#81a1c1',
      'hljs-regexp': '#a3be8c',
      'hljs-meta': '#616e88',
      'hljs-meta-keyword': '#81a1c1',
      'hljs-meta-string': '#a3be8c',
      'hljs-addition': '#a3be8c',
      'hljs-deletion': '#bf616a',
    }
  },
  'one-dark': {
    background: '#1e2127',
    foreground: '#abb2bf',
    lineNumbers: '#636d83',
    selection: '#2c323d',
    border: '#2c323d',
    scrollbar: '#2c323d',
    searchHighlight: '#bb800966',
    colors: {
      'hljs-comment': '#5c6370',
      'hljs-quote': '#5c6370',
      'hljs-keyword': '#c678dd',
      'hljs-selector-tag': '#e06c75',
      'hljs-subst': '#abb2bf',
      'hljs-built_in': '#e6c07b',
      'hljs-type': '#e6c07b',
      'hljs-class': '#e6c07b',
      'hljs-string': '#98c379',
      'hljs-title': '#61afef',
      'hljs-section': '#61afef',
      'hljs-number': '#d19a66',
      'hljs-literal': '#56b6c2',
      'hljs-boolean': '#56b6c2',
      'hljs-variable': '#e06c75',
      'hljs-template-variable': '#e06c75',
      'hljs-function': '#61afef',
      'hljs-name': '#61afef',
      'hljs-params': '#abb2bf',
      'hljs-attr': '#d19a66',
      'hljs-attribute': '#d19a66',
      'hljs-tag': '#e06c75',
      'hljs-selector-id': '#61afef',
      'hljs-selector-class': '#d19a66',
      'hljs-selector-attr': '#56b6c2',
      'hljs-selector-pseudo': '#56b6c2',
      'hljs-operator': '#56b6c2',
      'hljs-symbol': '#56b6c2',
      'hljs-bullet': '#56b6c2',
      'hljs-regexp': '#98c379',
      'hljs-meta': '#61afef',
      'hljs-meta-keyword': '#c678dd',
      'hljs-meta-string': '#98c379',
      'hljs-addition': '#98c379',
      'hljs-deletion': '#e06c75',
    }
  },
  'solarized-light': {
    background: '#fdf6e3',
    foreground: '#657b83',
    lineNumbers: '#93a1a1',
    selection: '#eee8d5',
    border: '#eee8d5',
    scrollbar: '#eee8d5',
    searchHighlight: '#bb800966',
    colors: {
      'hljs-comment': '#93a1a1',
      'hljs-quote': '#93a1a1',
      'hljs-keyword': '#859900',
      'hljs-selector-tag': '#859900',
      'hljs-subst': '#657b83',
      'hljs-built_in': '#b58900',
      'hljs-type': '#b58900',
      'hljs-class': '#268bd2',
      'hljs-string': '#2aa198',
      'hljs-title': '#268bd2',
      'hljs-section': '#268bd2',
      'hljs-number': '#d33682',
      'hljs-literal': '#d33682',
      'hljs-boolean': '#d33682',
      'hljs-variable': '#cb4b16',
      'hljs-template-variable': '#cb4b16',
      'hljs-function': '#268bd2',
      'hljs-name': '#268bd2',
      'hljs-params': '#657b83',
      'hljs-attr': '#268bd2',
      'hljs-attribute': '#268bd2',
      'hljs-tag': '#859900',
      'hljs-selector-id': '#268bd2',
      'hljs-selector-class': '#268bd2',
      'hljs-selector-attr': '#2aa198',
      'hljs-selector-pseudo': '#2aa198',
      'hljs-operator': '#859900',
      'hljs-symbol': '#859900',
      'hljs-bullet': '#859900',
      'hljs-regexp': '#2aa198',
      'hljs-meta': '#268bd2',
      'hljs-meta-keyword': '#859900',
      'hljs-meta-string': '#2aa198',
      'hljs-addition': '#859900',
      'hljs-deletion': '#dc322f',
    }
  },
  'tokyo-night': {
    background: '#1a1b26',
    foreground: '#9aa5ce',
    lineNumbers: '#565f89',
    selection: '#364a82',
    border: '#24283b',
    scrollbar: '#24283b',
    searchHighlight: '#bb800966',
    colors: {
      'hljs-comment': '#565f89',
      'hljs-quote': '#565f89',
      'hljs-keyword': '#bb9af7',
      'hljs-selector-tag': '#f7768e',
      'hljs-subst': '#9aa5ce',
      'hljs-built_in': '#e0af68',
      'hljs-type': '#e0af68',
      'hljs-class': '#9ece6a',
      'hljs-string': '#9ece6a',
      'hljs-title': '#7aa2f7',
      'hljs-section': '#7aa2f7',
      'hljs-number': '#ff9e64',
      'hljs-literal': '#ff9e64',
      'hljs-boolean': '#ff9e64',
      'hljs-variable': '#f7768e',
      'hljs-template-variable': '#f7768e',
      'hljs-function': '#7aa2f7',
      'hljs-name': '#7aa2f7',
      'hljs-params': '#9aa5ce',
      'hljs-attr': '#73daca',
      'hljs-attribute': '#73daca',
      'hljs-tag': '#f7768e',
      'hljs-selector-id': '#7aa2f7',
      'hljs-selector-class': '#9ece6a',
      'hljs-selector-attr': '#73daca',
      'hljs-selector-pseudo': '#73daca',
      'hljs-operator': '#89ddff',
      'hljs-symbol': '#89ddff',
      'hljs-bullet': '#89ddff',
      'hljs-regexp': '#9ece6a',
      'hljs-meta': '#7aa2f7',
      'hljs-meta-keyword': '#bb9af7',
      'hljs-meta-string': '#9ece6a',
      'hljs-addition': '#9ece6a',
      'hljs-deletion': '#f7768e',
    }
  },
  'high-contrast': {
    background: '#000000',
    foreground: '#ffffff',
    lineNumbers: '#808080',
    selection: '#4d4d4d',
    border: '#333333',
    scrollbar: '#333333',
    searchHighlight: '#ffff00',
    colors: {
      'hljs-comment': '#808080',
      'hljs-quote': '#808080',
      'hljs-keyword': '#00ffff',
      'hljs-selector-tag': '#00ff00',
      'hljs-subst': '#ffffff',
      'hljs-built_in': '#ffff00',
      'hljs-type': '#ffff00',
      'hljs-class': '#00ff00',
      'hljs-string': '#ff00ff',
      'hljs-title': '#00ffff',
      'hljs-section': '#00ffff',
      'hljs-number': '#ff8000',
      'hljs-literal': '#ff8000',
      'hljs-boolean': '#ff8000',
      'hljs-variable': '#ffffff',
      'hljs-template-variable': '#ffffff',
      'hljs-function': '#00ffff',
      'hljs-name': '#00ffff',
      'hljs-params': '#ffffff',
      'hljs-attr': '#00ff00',
      'hljs-attribute': '#00ff00',
      'hljs-tag': '#00ff00',
      'hljs-selector-id': '#00ffff',
      'hljs-selector-class': '#00ff00',
      'hljs-selector-attr': '#ffff00',
      'hljs-selector-pseudo': '#ffff00',
      'hljs-operator': '#00ffff',
      'hljs-symbol': '#00ffff',
      'hljs-bullet': '#00ffff',
      'hljs-regexp': '#ff00ff',
      'hljs-meta': '#00ffff',
      'hljs-meta-keyword': '#00ffff',
      'hljs-meta-string': '#ff00ff',
      'hljs-addition': '#00ff00',
      'hljs-deletion': '#ff0000',
    }
  }
};

export type ThemeName = keyof typeof themes;

// Enhanced HTML escaping with additional security
export const escapeHtml = (text: string): string => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };
  return text.replace(/[&<>"'`=\/]/g, (m) => map[m]);
};

// Enhanced code indentation detection and formatting
export const detectIndentation = (code: string): { type: 'spaces' | 'tabs'; size: number } => {
  const lines = code.split('\n').filter(line => line.trim().length > 0);
  let spaceIndents = 0;
  let tabIndents = 0;
  const spaceSizes: { [key: number]: number } = {};

  for (const line of lines) {
    const match = line.match(/^(\s+)/);
    if (match) {
      const indent = match[1];
      if (indent.includes('\t')) {
        tabIndents++;
      } else {
        spaceIndents++;
        const size = indent.length;
        spaceSizes[size] = (spaceSizes[size] || 0) + 1;
      }
    }
  }

  if (tabIndents > spaceIndents) {
    return { type: 'tabs', size: 1 };
  } else {
    // Find most common space indentation
    const sizes = Object.keys(spaceSizes).map(Number).sort((a, b) => spaceSizes[b] - spaceSizes[a]);
    const mostCommon = sizes[0] || 2;
    return { type: 'spaces', size: mostCommon };
  }
};

// Format code with proper indentation
export const formatCode = (code: string, language?: string): string => {
  if (!code) return code;

  const { type, size } = detectIndentation(code);
  const lines = code.split('\n');
  
  // Basic formatting for common languages
  if (language === 'json') {
    try {
      const parsed = JSON.parse(code);
      return JSON.stringify(parsed, null, type === 'tabs' ? '\t' : ' '.repeat(size));
    } catch {
      return code; // Return original if parsing fails
    }
  }

  // For other languages, just ensure consistent indentation
  let indentLevel = 0;
  const formatted = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';

    // Simple indentation logic for bracket-based languages
    if (['javascript', 'typescript', 'java', 'cpp', 'css'].includes(language || '')) {
      if (trimmed.includes('}') && !trimmed.includes('{')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      const indent = type === 'tabs' ? '\t'.repeat(indentLevel) : ' '.repeat(indentLevel * size);
      const result = indent + trimmed;
      
      if (trimmed.includes('{') && !trimmed.includes('}')) {
        indentLevel++;
      }
      
      return result;
    }

    return line; // Return original line for other languages
  });

  return formatted.join('\n');
};

// Helper to convert Lowlight result to HTML with enhanced theme support
export const toHtml = (result: any, theme: typeof themes[ThemeName]): string => {
  const nodeToHtml = (node: any): string => {
    if (node.type === 'text') {
      return escapeHtml(node.value);
    }
    if (node.type === 'element') {
      const { tagName, properties, children } = node;
      const classNames = (properties?.className || []).join(' ');

      let style = '';
      const classList = classNames.split(' ');
      
      // Apply theme colors
      classList.forEach(cls => {
        if (theme.colors[cls as keyof typeof theme.colors]) {
          const color = theme.colors[cls as keyof typeof theme.colors];
          style += `color: ${color}; `;
        }
      });

      // Add font weight for certain elements
      if (classList.includes('hljs-keyword') || classList.includes('hljs-built_in')) {
        style += 'font-weight: 600; ';
      }
      
      // Add text decoration for links and meta
      if (classList.includes('hljs-link') || classList.includes('hljs-meta')) {
        style += 'text-decoration: underline; ';
      }

      const childrenHtml = children?.map(nodeToHtml).join('') || '';
      const styleAttr = style ? ` style="${style.trim()}"` : '';
      
      return `<${tagName}${styleAttr}>${childrenHtml}</${tagName}>`;
    }
    return '';
  };
  
  return result.children.map(nodeToHtml).join('');
};

// Enhanced syntax highlighting function with better error handling and formatting
export const highlightCode = (
  code: string, 
  language: string, 
  theme: typeof themes[ThemeName],
  options: {
    format?: boolean;
    showErrors?: boolean;
    maxLength?: number;
  } = {}
): string => {
  const { format = false, showErrors = false, maxLength = 100000 } = options;

  if (!code || code.length === 0) {
    return '';
  }

  // Truncate very long code
  let processedCode = code.length > maxLength ? code.substring(0, maxLength) + '\n... (truncated)' : code;
  
  // Format code if requested
  if (format) {
    try {
      processedCode = formatCode(processedCode, language);
    } catch (error) {
      console.warn('Code formatting failed:', error);
    }
  }

  try {
    // Normalize language name
    const normalizedLang = language.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Try to highlight with the specified language
    let result;
    try {
      result = lowlight.highlight(normalizedLang, processedCode);
    } catch (langError) {
      // Fallback to auto-detection
      result = lowlight.highlightAuto(processedCode);
    }
    
    return toHtml(result, theme);
  } catch (error) {
    console.warn('Syntax highlighting failed:', error);
    
    if (showErrors) {
      return `<span style="color: ${theme.colors['hljs-comment'] || '#888'};">/* Syntax highlighting failed: ${error} */</span>\n${escapeHtml(processedCode)}`;
    }
    
    return escapeHtml(processedCode);
  }
};

// Language detection helper
export const detectLanguage = (code: string, filename?: string): string => {
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const extensionMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'javascript', 
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'c': 'cpp',
      'sql': 'sql',
      'html': 'xml',
      'xml': 'xml',
      'sh': 'bash',
      'bash': 'bash',
      'json': 'json',
      'css': 'css',
      'scss': 'css',
      'sass': 'css',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'pl': 'perl',
      'r': 'r',
      'm': 'matlab',
      'lua': 'lua',
      'ps1': 'powershell',
      'dockerfile': 'dockerfile'
    };
    
    if (ext && extensionMap[ext]) {
      return extensionMap[ext];
    }
  }

  // Basic language detection based on content patterns
  if (code.includes('function') && code.includes('{')) {
    if (code.includes('const ') || code.includes('let ') || code.includes('=>')) {
      return 'javascript';
    }
  }
  
  if (code.includes('def ') && code.includes(':')) {
    return 'python';
  }
  
  if (code.includes('public class') || code.includes('import java.')) {
    return 'java';
  }
  
  if (code.includes('#include') || code.includes('std::')) {
    return 'cpp';
  }
  
  if (code.includes('SELECT') || code.includes('FROM') || code.includes('WHERE')) {
    return 'sql';
  }
  
  if (code.includes('<?php') || code.includes('<?=')) {
    return 'php';
  }
  
  if (code.startsWith('{') && code.endsWith('}')) {
    try {
      JSON.parse(code);
      return 'json';
    } catch {
      // Not valid JSON
    }
  }

  return 'text';
};

// Get available languages
export const getAvailableLanguages = (): string[] => {
  return [
    'javascript', 'typescript', 'python', 'java', 'cpp', 'sql', 'xml', 'html',
    'bash', 'json', 'css', 'yaml', 'markdown', 'php', 'ruby', 'go', 'rust',
    'swift', 'kotlin', 'scala', 'perl', 'r', 'matlab', 'lua', 'powershell',
    'dockerfile'
  ];
};

// Get theme names
export const getAvailableThemes = (): ThemeName[] => {
  return Object.keys(themes) as ThemeName[];
};