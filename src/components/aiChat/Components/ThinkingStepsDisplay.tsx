import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Search, Lightbulb, Database, CheckCircle2, XCircle, Loader2, Zap } from 'lucide-react';
import { ThinkingStep } from '@/types/Class';
import { cn } from '@/lib/utils';

interface ThinkingStepsDisplayProps {
  steps: ThinkingStep[];
  isStreaming?: boolean;
  className?: string;
}

const getStepIcon = (type: ThinkingStep['type'], status: ThinkingStep['status']) => {
  const iconClass = cn(
    'w-4 h-4',
    status === 'completed' && 'text-green-500',
    status === 'in-progress' && 'text-blue-500 animate-pulse',
    status === 'failed' && 'text-red-500',
    status === 'pending' && 'text-gray-400'
  );

  switch (type) {
    case 'understanding':
      return <Brain className={iconClass} />;
    case 'retrieval':
      return <Search className={iconClass} />;
    case 'reasoning':
      return <Lightbulb className={iconClass} />;
    case 'memory':
      return <Database className={iconClass} />;
    case 'verification':
      return status === 'in-progress' ? (
        <Loader2 className={cn(iconClass, 'animate-spin')} />
      ) : status === 'failed' ? (
        <XCircle className={iconClass} />
      ) : (
        <CheckCircle2 className={iconClass} />
      );
    case 'action':
      return <Zap className={iconClass} />;
    default:
      return <Brain className={iconClass} />;
  }
};

const getStepColor = (type: ThinkingStep['type']) => {
  switch (type) {
    case 'understanding':
      return 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800';
    case 'retrieval':
      return 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800';
    case 'reasoning':
      return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800';
    case 'memory':
      return 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800';
    case 'verification':
      return 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800';
    case 'action':
      return 'bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800';
    default:
      return 'bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800';
  }
};

export const ThinkingStepsDisplay = memo(({ steps, isStreaming, className }: ThinkingStepsDisplayProps) => {
  if (!steps || steps.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2 mb-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <Brain className="w-4 h-4" />
        <span>AI Thinking Process</span>
        {isStreaming && (
          <span className="flex items-center gap-1 text-xs text-blue-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            Streaming...
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                duration: 0.2,
                delay: index * 0.05,
                ease: 'easeOut'
              }}
              className={cn(
                'relative rounded-lg border p-3 transition-all duration-200',
                getStepColor(step.type),
                step.status === 'in-progress' && 'ring-2 ring-blue-400/50',
                step.status === 'completed' && 'opacity-90'
              )}
            >
              {/* Progress bar for in-progress steps */}
              {step.status === 'in-progress' && (
                <motion.div
                  className="absolute top-0 left-0 h-1 bg-blue-500 rounded-t-lg"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
                />
              )}

              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {getStepIcon(step.type, step.status)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {step.title}
                    </h4>
                    {step.status === 'completed' && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                    {step.status === 'failed' && (
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    )}
                  </div>
                  
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {step.detail}
                  </p>

                  {/* Metadata display */}
                  {step.metadata && Object.keys(step.metadata).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {step.metadata.intent && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300">
                          {step.metadata.intent}
                        </span>
                      )}
                      {step.metadata.entities && Array.isArray(step.metadata.entities) && step.metadata.entities.length > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300">
                          {step.metadata.entities.length} entities
                        </span>
                      )}
                      {step.metadata.contextCount !== undefined && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300">
                          {step.metadata.contextCount} items
                        </span>
                      )}
                      {step.metadata.confidence !== undefined && (
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                          step.metadata.confidence >= 0.8 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" :
                          step.metadata.confidence >= 0.6 ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" :
                          "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        )}>
                          {(step.metadata.confidence * 100).toFixed(0)}% confidence
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
});

ThinkingStepsDisplay.displayName = 'ThinkingStepsDisplay';
