import React, { useMemo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SlideTheme {
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  gradient?: string;
  animations?: any[];
}

interface SlideDesign {
  borderRadius?: string;
  boxShadow?: string;
  glassmorphism?: boolean;
}

export interface Slide {
  title: string;
  content: string | string[];
  layout?: string;
  theme?: SlideTheme;
  design?: SlideDesign;
}

interface SlidesRendererProps {
  slides: Slide[];
  currentSlideIndex: number;
  theme?: 'light' | 'dark';
}

const parseMarkdown = (text: string): React.ReactNode[] => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let codeBlock: string[] = [];
  let inCodeBlock = false;
  let codeLanguage = '';
  let tableRows: string[][] = [];
  let inTable = false;
  let tableHeaders: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      const ListTag = listType === 'ol' ? 'ol' : 'ul';
      elements.push(
        <ListTag key={elements.length} className={`mb-6 ${listType === 'ol' ? 'list-decimal' : 'list-disc'} list-inside space-y-3`}>
          {listItems.map((item, idx) => (
            <li key={idx} className="text-lg leading-relaxed pl-2" dangerouslySetInnerHTML={{ __html: parseInline(item) }} />
          ))}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  const flushCodeBlock = () => {
    if (codeBlock.length > 0) {
      elements.push(
        <pre key={elements.length} className="bg-gray-900 text-gray-100 p-6 rounded-xl overflow-x-auto mb-6 shadow-lg border border-gray-700">
          <code className={`language-${codeLanguage} text-sm`}>
            {codeBlock.join('\n')}
          </code>
        </pre>
      );
      codeBlock = [];
      inCodeBlock = false;
      codeLanguage = '';
    }
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      elements.push(
        <div key={elements.length} className="overflow-x-auto mb-6">
          <table className="min-w-full border-collapse bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg">
            <thead className="bg-blue-500/20">
              <tr>
                {tableHeaders.map((header, idx) => (
                  <th key={idx} className="px-6 py-4 text-left font-semibold text-base border-b-2 border-blue-500/30">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-blue-500/10 transition-colors">
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-6 py-4 text-base border-b border-gray-300/30">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      tableHeaders = [];
      inTable = false;
    }
  };

  const parseInline = (line: string): string => {
    return line
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="font-bold text-current"><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-current">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
      .replace(/__(.+?)__/g, '<strong class="font-bold text-current">$1</strong>')
      .replace(/_(.+?)_/g, '<em class="italic">$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm font-mono">$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-blue-500 hover:text-blue-600 underline transition-colors" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/~~(.+?)~~/g, '<del class="line-through opacity-70">$1</del>');
  };

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    // Code blocks
    if (trimmedLine.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        flushList();
        flushTable();
        inCodeBlock = true;
        codeLanguage = trimmedLine.slice(3).trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeBlock.push(line);
      return;
    }

    // Table detection
    if (trimmedLine.includes('|') && !inTable) {
      flushList();
      const cells = trimmedLine.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length > 0) {
        tableHeaders = cells;
        inTable = true;
      }
      return;
    }

    if (inTable) {
      if (trimmedLine.match(/^\|?\s*[-:]+\s*\|/)) {
        // Skip separator line
        return;
      }
      if (trimmedLine.includes('|')) {
        const cells = trimmedLine.split('|').map(c => c.trim()).filter(c => c);
        if (cells.length > 0) {
          tableRows.push(cells);
        }
        return;
      } else {
        flushTable();
      }
    }

    // Empty lines
    if (!trimmedLine) {
      flushList();
      flushTable();
      elements.push(<div key={elements.length} className="h-4" />);
      return;
    }

    // Headers
    if (trimmedLine.startsWith('#')) {
      flushList();
      flushTable();
      const level = trimmedLine.match(/^#+/)?.[0].length || 1;
      const text = trimmedLine.replace(/^#+\s*/, '');
      const HeaderTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
      const sizeClasses = {
        1: 'text-5xl font-extrabold mb-8 leading-tight',
        2: 'text-4xl font-bold mb-6 leading-tight',
        3: 'text-3xl font-bold mb-5 leading-snug',
        4: 'text-2xl font-semibold mb-4',
        5: 'text-xl font-semibold mb-3',
        6: 'text-lg font-semibold mb-2'
      };
      
      elements.push(
        <HeaderTag 
          key={elements.length} 
          className={`${sizeClasses[level as keyof typeof sizeClasses]} bg-gradient-to-r from-current to-current/80 bg-clip-text`}
          dangerouslySetInnerHTML={{ __html: parseInline(text) }} 
        />
      );
      return;
    }

    // Horizontal rule
    if (trimmedLine.match(/^(\*\*\*|---|___)$/)) {
      flushList();
      flushTable();
      elements.push(
        <hr key={elements.length} className="my-8 border-t-2 border-current/20 rounded" />
      );
      return;
    }

    // Blockquote
    if (trimmedLine.startsWith('>')) {
      flushList();
      flushTable();
      const text = trimmedLine.replace(/^>\s*/, '');
      elements.push(
        <blockquote 
          key={elements.length} 
          className="border-l-4 border-current/60 pl-6 py-3 my-6 italic text-lg bg-white/20 dark:bg-gray-800/20 backdrop-blur-sm rounded-r-xl" 
          dangerouslySetInnerHTML={{ __html: parseInline(text) }} 
        />
      );
      return;
    }

    // Ordered list
    if (trimmedLine.match(/^\d+\.\s/)) {
      flushTable();
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      const text = trimmedLine.replace(/^\d+\.\s*/, '');
      listItems.push(text);
      return;
    }

    // Unordered list
    if (trimmedLine.match(/^[-*+]\s/)) {
      flushTable();
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      const text = trimmedLine.replace(/^[-*+]\s*/, '');
      listItems.push(text);
      return;
    }

    // Regular paragraph
    flushList();
    flushTable();
    elements.push(
      <p 
        key={elements.length} 
        className="text-lg leading-relaxed mb-4" 
        dangerouslySetInnerHTML={{ __html: parseInline(trimmedLine) }} 
      />
    );
  });

  flushList();
  flushCodeBlock();
  flushTable();

  return elements;
};

// Particle animation component
const ParticleRain: React.FC<{ color: string; density: number }> = ({ color, density }) => {
  const particles = Array.from({ length: Math.floor(50 * density) }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 5,
    duration: 3 + Math.random() * 2
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute w-1 h-1 rounded-full"
          style={{ 
            left: `${p.x}%`, 
            top: '-5%',
            backgroundColor: color,
            boxShadow: `0 0 4px ${color}`
          }}
          animate={{
            y: ['0vh', '110vh'],
            opacity: [0, 1, 1, 0]
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
      ))}
    </div>
  );
};

// Floating objects component
const FloatingObjects: React.FC<{ objects: any[] }> = ({ objects }) => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {objects.map((obj, i) => (
        <motion.div
          key={i}
          className="absolute text-4xl opacity-20"
          style={{
            left: `${20 + i * 30}%`,
            top: `${30 + (i % 2) * 40}%`
          }}
          animate={{
            y: [0, -20, 0],
            rotate: [0, 10, -10, 0]
          }}
          transition={{
            duration: 3 / obj.speed,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          {obj.icon}
        </motion.div>
      ))}
    </div>
  );
};

export const SlidesRenderer: React.FC<SlidesRendererProps> = ({ 
  slides, 
  currentSlideIndex,
  theme = 'light'
}) => {
  if (!slides.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        No slides available
      </div>
    );
  }

  const currentSlide = slides[currentSlideIndex];
  const slideTheme = currentSlide.theme || {
    backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
    textColor: theme === 'dark' ? '#F8FAFC' : '#0F172A',
    accentColor: theme === 'dark' ? '#60A5FA' : '#3B82F6'
  };

  const slideDesign = currentSlide.design || {};

  const renderedContent = useMemo(() => {
    let contentStr = Array.isArray(currentSlide.content) 
      ? currentSlide.content.join('\n')
      : currentSlide.content;
    
    contentStr = contentStr.replace(/\\n/g, '\n');
    
    return parseMarkdown(contentStr);
  }, [currentSlide.content]);

  // Animation variants
  const getAnimationVariant = () => {
    const animations = slideTheme.animations || [];
    const slideAnimation = animations.find(a => 
      ['fade-in', 'slide-in-right', 'slide-in-bottom', 'slide-in-left'].includes(a.type)
    );

    if (!slideAnimation) {
      return {
        initial: { opacity: 0, x: 50 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -50 }
      };
    }

    const variants: Record<string, any> = {
      'fade-in': {
        initial: { opacity: 0, scale: 0.95 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.95 }
      },
      'slide-in-right': {
        initial: { opacity: 0, x: 100 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -100 }
      },
      'slide-in-bottom': {
        initial: { opacity: 0, y: 100 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -100 }
      },
      'slide-in-left': {
        initial: { opacity: 0, x: -100 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 100 }
      }
    };

    return variants[slideAnimation.type] || variants['fade-in'];
  };

  const animationVariant = getAnimationVariant();

  // Glassmorphism styles
  const glassStyles = slideDesign.glassmorphism ? {
    backdropFilter: 'blur(20px)',
    backgroundColor: slideTheme.gradient ? 'transparent' : `${slideTheme.backgroundColor}CC`,
    border: '1px solid rgba(255, 255, 255, 0.2)'
  } : {
    backgroundColor: slideTheme.backgroundColor
  };

  return (
    <motion.div
      key={currentSlideIndex}
      initial={animationVariant.initial}
      animate={animationVariant.animate}
      exit={animationVariant.exit}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full h-full flex flex-col items-center justify-center p-8 md:p-12 relative overflow-hidden"
      style={{
        background: slideTheme.gradient || slideTheme.backgroundColor,
        color: slideTheme.textColor,
        borderRadius: slideDesign.borderRadius || '24px',
        boxShadow: slideDesign.boxShadow || '0px 10px 40px rgba(0, 0, 0, 0.15)',
        ...glassStyles
      }}
    >
      {/* Background animations */}
      {slideTheme.animations?.map((anim, idx) => {
        if (anim.type === 'particle-rain') {
          return <ParticleRain key={idx} color={anim.color} density={anim.density} />;
        }
        if (anim.type === 'floating-objects') {
          return <FloatingObjects key={idx} objects={anim.objects} />;
        }
        if (anim.type === 'gradient-shift' || anim.type === 'gradient-pulse') {
          return (
            <motion.div
              key={idx}
              className="absolute inset-0 opacity-30"
              animate={{
                background: anim.colors.map((c: string) => 
                  `radial-gradient(circle at ${Math.random() * 100}% ${Math.random() * 100}%, ${c}, transparent)`
                )
              }}
              transition={{
                duration: 5 / anim.speed,
                repeat: Infinity,
                ease: 'linear'
              }}
            />
          );
        }
        return null;
      })}

      {/* Content wrapper with glassmorphism effect */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Slide Title */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-3xl md:text-5xl font-extrabold mb-8 text-center leading-tight"
          style={{ color: slideTheme.accentColor }}
        >
          {currentSlide.title}
        </motion.div>

        {/* Slide Content */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex-1 w-full max-w-5xl mx-auto overflow-auto px-4 custom-scrollbar"
        >
          <div className="space-y-2">
            {renderedContent}
          </div>
        </motion.div>

        {/* Slide Progress */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-8 flex items-center justify-center gap-4"
        >
          <div 
            className="h-2 rounded-full flex-1 max-w-md relative overflow-hidden"
            style={{ backgroundColor: `${slideTheme.accentColor}30` }}
          >
            <motion.div 
              className="h-2 rounded-full"
              style={{ backgroundColor: slideTheme.accentColor }}
              initial={{ width: 0 }}
              animate={{ width: `${((currentSlideIndex + 1) / slides.length) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <span 
            className="text-sm font-semibold px-4 py-2 rounded-full backdrop-blur-sm"
            style={{ 
              backgroundColor: `${slideTheme.accentColor}20`,
              color: slideTheme.textColor 
            }}
          >
            {currentSlideIndex + 1} / {slides.length}
          </span>
        </motion.div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${slideTheme.accentColor}60;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${slideTheme.accentColor}80;
        }
      `}</style>
    </motion.div>
  );
};