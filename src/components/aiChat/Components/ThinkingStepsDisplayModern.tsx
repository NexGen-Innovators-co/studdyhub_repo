import React, { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Brain, BookOpen, Lightbulb, Database, ShieldCheck, Zap, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
import { ThinkingStep } from '@/types/Class';
import { cn } from '@/lib/utils';

interface ThinkingStepsDisplayProps {
  steps: ThinkingStep[];
  isStreaming?: boolean;
  className?: string;
}

const getStepIcon = (type: ThinkingStep['type']) => {
  switch (type) {
    case 'understanding': return Brain;
    case 'retrieval': return BookOpen;
    case 'reasoning': return Lightbulb;
    case 'memory': return Database;
    case 'verification': return ShieldCheck;
    case 'action': return Zap;
    default: return Sparkles;
  }
};

const getStepColor = (type: ThinkingStep['type'], isActive: boolean) => {
  if (isActive) return { bg: 'bg-blue-100 dark:bg-blue-900/40', border: 'border-blue-400', icon: 'text-blue-600 dark:text-blue-400' };
  switch (type) {
    case 'understanding': return { bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-300 dark:border-purple-700', icon: 'text-purple-600 dark:text-purple-400' };
    case 'retrieval': return { bg: 'bg-sky-100 dark:bg-sky-900/30', border: 'border-sky-300 dark:border-sky-700', icon: 'text-sky-600 dark:text-sky-400' };
    case 'reasoning': return { bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-300 dark:border-amber-700', icon: 'text-amber-600 dark:text-amber-400' };
    case 'memory': return { bg: 'bg-cyan-100 dark:bg-cyan-900/30', border: 'border-cyan-300 dark:border-cyan-700', icon: 'text-cyan-600 dark:text-cyan-400' };
    case 'verification': return { bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-300 dark:border-emerald-700', icon: 'text-emerald-600 dark:text-emerald-400' };
    case 'action': return { bg: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-rose-300 dark:border-rose-700', icon: 'text-rose-600 dark:text-rose-400' };
    default: return { bg: 'bg-slate-100 dark:bg-slate-800/30', border: 'border-slate-300 dark:border-slate-700', icon: 'text-slate-500 dark:text-slate-400' };
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
                             
                             {/* Step Icon Indicator */}
                             {(() => {
                               const Icon = getStepIcon(step.type);
                               const colors = getStepColor(step.type, isActive);
                               return (
                                 <div className={cn(
                                   "absolute left-0 top-0.5 h-[22px] w-[22px] rounded-md border flex items-center justify-center z-10",
                                   colors.bg, colors.border,
                                   isActive && "animate-pulse shadow-sm"
                                 )}>
                                   <Icon className={cn("h-3 w-3", colors.icon)} />
                                 </div>
                               );
                             })()}

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
