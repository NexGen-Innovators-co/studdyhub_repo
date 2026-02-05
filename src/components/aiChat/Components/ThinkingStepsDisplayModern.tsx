import React, { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Brain, Sparkles, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { ThinkingStep } from '@/types/Class';
import { cn } from '@/lib/utils';

interface ThinkingStepsDisplayProps {
  steps: ThinkingStep[];
  isStreaming?: boolean;
  className?: string;
}

const getStepEmoji = (type: ThinkingStep['type']) => {
  switch (type) {
    case 'understanding': return '🤔';
    case 'retrieval': return '🔍';
    case 'reasoning': return '💡';
    case 'memory': return '🧠';
    case 'verification': return '✓';
    case 'action': return '⚡';
    default: return '💭';
  }
};

const getStepLabel = (type: ThinkingStep['type']) => {
  switch (type) {
    case 'understanding': return 'Understanding';
    case 'retrieval': return 'Searching';
    case 'reasoning': return 'Reasoning';
    case 'memory': return 'Recalling';
    case 'verification': return 'Verifying';
    case 'action': return 'Acting';
    default: return 'Thinking';
  }
};

export const ThinkingStepsDisplay = memo(({ steps, isStreaming, className }: ThinkingStepsDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer for "Thinking..." duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isStreaming) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isStreaming]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (!steps || steps.length === 0) {
    return null;
  }

  const currentStep = steps.find(s => s.status === 'in-progress') || steps[steps.length - 1];
  const isComplete = !isStreaming && steps.every(s => s.status !== 'in-progress' && s.status !== 'pending');

  return (
    <div className={cn("my-4", className)}>
      <div 
        className={cn(
          "rounded-lg overflow-hidden border transition-all duration-200",
          isExpanded 
            ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm" 
            : "bg-slate-50 dark:bg-slate-900/50 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
      >
        {/* Toggle Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left focus:outline-none"
        >
          {isStreaming ? (
            <div className="relative flex h-5 w-5 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <Brain className="relative h-4 w-4 text-blue-500" />
            </div>
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          )}

          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className={cn(
              "text-sm font-medium",
              isStreaming ? "text-slate-700 dark:text-slate-200" : "text-slate-600 dark:text-slate-400"
            )}>
              {isStreaming ? (
                currentStep ? `Thinking... ${getStepLabel(currentStep.type)}` : "Thinking Process"
              ) : (
                "Thought Process"
              )}
            </span>
            
            {elapsedTime > 0 && isStreaming && (
               <span className="text-xs text-slate-400 font-mono">
                 {formatTime(elapsedTime)}
               </span>
            )}
            
            {!isStreaming && steps.length > 0 && (
                <span className="text-xs text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                    {steps.length} steps
                </span>
            )}
          </div>

          <ChevronDown 
            className={cn(
              "h-4 w-4 text-slate-400 transition-transform duration-200",
              isExpanded && "transform rotate-180"
            )} 
          />
        </button>

        {/* Collapsible Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-slate-100 dark:border-slate-800"
            >
              <div className="p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/30">
                {steps.map((step, index) => {
                    const isLast = index === steps.length - 1;
                    const isActive = step.status === 'in-progress';
                    
                    return (
                        <div key={step.id} className="relative pl-6 pb-1">
                             {/* Vertical Line */}
                             {!isLast && (
                                <div className="absolute left-[11px] top-6 bottom-[-16px] w-0.5 bg-slate-200 dark:bg-slate-800" />
                             )}
                             
                             {/* Dot Indicator */}
                             <div className={cn(
                                 "absolute left-[2px] top-1.5 h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center z-10 bg-white dark:bg-slate-950",
                                 isActive 
                                    ? "border-blue-500 text-blue-500 animate-pulse" 
                                    : "border-slate-200 dark:border-slate-700 text-slate-400"
                             )}>
                                 {isActive ? (
                                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                                 ) : step.status === 'completed' ? (
                                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                                 ) : (
                                    <div className="h-2 w-2 rounded-full bg-slate-300" />
                                 )}
                             </div>

                             {/* Step Content */}
                             <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        {getStepLabel(step.type)}
                                    </span>
                                    {isActive && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                                </div>
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                    {step.title}
                                </div>
                                {step.detail && (
                                    <div className="mt-1 text-xs text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2 font-mono">
                                        {step.detail}
                                    </div>
                                )}
                             </div>
                        </div>
                    );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

ThinkingStepsDisplay.displayName = 'ThinkingStepsDisplay';
