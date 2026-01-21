import React, { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Brain, Sparkles } from 'lucide-react';
import { ThinkingStep } from '@/types/Class';
import { cn } from '@/lib/utils';

interface ThinkingStepsDisplayProps {
  steps: ThinkingStep[];
  isStreaming?: boolean;
  className?: string;
}

interface TypewriterTextProps {
  text: string;
  speed?: number;
  className?: string;
}

const TypewriterText = memo(({ text, speed = 20, className }: TypewriterTextProps) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, speed]);

  // Reset when text changes
  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  return <span className={className}>{displayedText}<span className="animate-pulse">▊</span></span>;
});

TypewriterText.displayName = 'TypewriterText';

const getStepEmoji = (type: ThinkingStep['type']) => {
  switch (type) {
    case 'understanding':
      return '🤔';
    case 'retrieval':
      return '🔍';
    case 'reasoning':
      return '💡';
    case 'memory':
      return '🧠';
    case 'verification':
      return '✓';
    case 'action':
      return '⚡';
    default:
      return '💭';
  }
};

const getStepLabel = (type: ThinkingStep['type']) => {
  switch (type) {
    case 'understanding':
      return 'Understanding';
    case 'retrieval':
      return 'Searching';
    case 'reasoning':
      return 'Reasoning';
    case 'memory':
      return 'Recalling';
    case 'verification':
      return 'Verifying';
    case 'action':
      return 'Acting';
    default:
      return 'Thinking';
  }
};

export const ThinkingStepsDisplay = memo(({ steps, isStreaming, className }: ThinkingStepsDisplayProps) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [autoExpandLatest, setAutoExpandLatest] = useState(true);

  // Auto-expand the latest in-progress or recently completed step
  useEffect(() => {
    if (autoExpandLatest && steps.length > 0) {
      const latestStep = steps[steps.length - 1];
      if (latestStep && (latestStep.status === 'in-progress' || latestStep.status === 'completed')) {
        setExpandedSteps(prev => new Set([...prev, latestStep.id]));
      }
    }
  }, [steps, autoExpandLatest]);

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
    setAutoExpandLatest(false);
  };

  if (!steps || steps.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        'relative rounded-xl overflow-hidden mb-4',
        'bg-gradient-to-br from-blue-50/50 via-purple-50/30 to-pink-50/50',
        'dark:from-blue-950/20 dark:via-purple-950/20 dark:to-pink-950/20',
        'border border-blue-200/50 dark:border-blue-800/50',
        'backdrop-blur-sm',
        className
      )}
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 animate-gradient-x" />
      </div>

      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-blue-200/50 dark:border-blue-800/50 bg-white/30 dark:bg-gray-900/30">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-pulse" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            AI Thinking Process
          </span>
          {isStreaming && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-blue-500"
              />
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                Thinking...
              </span>
            </motion.div>
          )}
        </div>

        {/* Steps */}
        <div className="divide-y divide-blue-200/30 dark:divide-blue-800/30">
          <AnimatePresence mode="popLayout">
            {steps.map((step, index) => {
              const isExpanded = expandedSteps.has(step.id);
              const isActive = step.status === 'in-progress';
              const isCompleted = step.status === 'completed';

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{
                    duration: 0.3,
                    delay: index * 0.05,
                    ease: [0.23, 1, 0.32, 1]
                  }}
                  className={cn(
                    'relative transition-colors duration-200',
                    isActive && 'bg-blue-50/50 dark:bg-blue-950/30',
                    isCompleted && 'bg-white/20 dark:bg-gray-900/20'
                  )}
                >
                  {/* Active step indicator */}
                  {isActive && (
                    <motion.div
                      className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-500"
                      layoutId="activeIndicator"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}

                  {/* Step header */}
                  <button
                    onClick={() => toggleStep(step.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left',
                      'hover:bg-white/30 dark:hover:bg-gray-900/30 transition-colors',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50'
                    )}
                  >
                    {/* Expand/Collapse icon */}
                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex-shrink-0"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </motion.div>

                    {/* Emoji */}
                    <span className="text-lg flex-shrink-0">
                      {getStepEmoji(step.type)}
                    </span>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          {getStepLabel(step.type)}
                        </span>
                        {isActive && (
                          <motion.div
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="flex gap-1"
                          >
                            <div className="w-1 h-1 rounded-full bg-blue-500" />
                            <div className="w-1 h-1 rounded-full bg-blue-500 animation-delay-200" />
                            <div className="w-1 h-1 rounded-full bg-blue-500 animation-delay-400" />
                          </motion.div>
                        )}
                        {isCompleted && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="text-green-500 text-sm"
                          >
                            ✓
                          </motion.span>
                        )}
                      </div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                        {step.title}
                      </h4>
                    </div>

                    {/* Duration or metadata badge */}
                    {step.metadata && (
                      <div className="flex gap-1 flex-shrink-0">
                        {step.metadata.index !== undefined && step.metadata.total !== undefined && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                            {step.metadata.index + 1}/{step.metadata.total}
                          </span>
                        )}
                        {step.metadata.count !== undefined && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                            {step.metadata.count}
                          </span>
                        )}
                      </div>
                    )}
                  </button>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3 pl-[52px] space-y-2">
                          {/* Detail text with typing animation */}
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            {isActive ? (
                              <TypewriterText text={step.detail} speed={15} />
                            ) : (
                              <p>{step.detail}</p>
                            )}
                          </div>

                          {/* Metadata display */}
                          {step.metadata && Object.keys(step.metadata).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-2">
                              {step.metadata.intent && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                                  Intent: {step.metadata.intent}
                                </span>
                              )}
                              {step.metadata.entities && Array.isArray(step.metadata.entities) && step.metadata.entities.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {step.metadata.entities.map((entity: string, i: number) => (
                                    <span key={i} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                                      {entity}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {step.metadata.contextCount !== undefined && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                                  {step.metadata.contextCount} context items
                                </span>
                              )}
                              {step.metadata.confidence !== undefined && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                                  {Math.round(step.metadata.confidence * 100)}% confidence
                                </span>
                              )}
                              {step.metadata.issues && Array.isArray(step.metadata.issues) && step.metadata.issues.length > 0 && (
                                <div className="w-full flex flex-col gap-1 mt-1">
                                  {step.metadata.issues.map((issue: string, i: number) => (
                                    <span key={i} className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                      <ChevronRight className="w-2 h-2" /> {issue}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {(step.metadata.msgCount !== undefined || step.metadata.factCount !== undefined) && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                                  {step.metadata.msgCount || 0} msgs • {step.metadata.factCount || 0} facts
                                </span>
                              )}
                              {/* Action details hidden to maintain user-friendly interface */}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
});

ThinkingStepsDisplay.displayName = 'ThinkingStepsDisplay';
