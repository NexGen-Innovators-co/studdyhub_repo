// src/components/aiChat/TokenUsageIndicator.tsx
// Component to display token usage information for AI chat messages

import { FC } from 'react';
import { AlertCircle, Info } from 'lucide-react';
import { TokenEstimate, formatTokenCount, TOKEN_LIMITS } from '../../utils/tokenCounter';

interface TokenUsageIndicatorProps {
  estimate: TokenEstimate;
  compact?: boolean;
}

export const TokenUsageIndicator: FC<TokenUsageIndicatorProps> = ({ estimate, compact = false }) => {
  const usagePercent = (estimate.totalTokens / TOKEN_LIMITS.MAX_MESSAGE_CONTEXT) * 100;
  
  // Determine color based on usage
  let colorClass = 'text-green-600';
  let bgClass = 'bg-green-100';
  let Icon = Info;
  
  if (usagePercent > 80) {
    colorClass = 'text-red-600';
    bgClass = 'bg-red-100';
    Icon = AlertCircle;
  } else if (usagePercent > 60) {
    colorClass = 'text-yellow-600';
    bgClass = 'bg-yellow-100';
    Icon = AlertCircle;
  }

  // Don't show if usage is very low and in compact mode
  if (compact && usagePercent < 20) {
    return null;
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-1 text-xs ${colorClass}`}>
        <Icon className="w-3 h-3" />
        <span>{formatTokenCount(estimate.totalTokens)}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-3 ${bgClass} ${colorClass}`}>
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm mb-1">
            Token Usage: {formatTokenCount(estimate.totalTokens)}
          </div>
          
          {estimate.warnings.length > 0 && (
            <div className="text-xs space-y-1 mb-2">
              {estimate.warnings.map((warning, idx) => (
                <div key={idx}>• {warning}</div>
              ))}
            </div>
          )}
          
          <div className="text-xs space-y-0.5 opacity-80">
            {estimate.messageTokens > 0 && (
              <div>Message: {formatTokenCount(estimate.messageTokens)}</div>
            )}
            {estimate.filesTokens > 0 && (
              <div>Files: {formatTokenCount(estimate.filesTokens)}</div>
            )}
            {estimate.documentsTokens > 0 && (
              <div>Documents: {formatTokenCount(estimate.documentsTokens)}</div>
            )}
            {estimate.notesTokens > 0 && (
              <div>Notes: {formatTokenCount(estimate.notesTokens)}</div>
            )}
            {estimate.historyTokens > 0 && (
              <div>History: {formatTokenCount(estimate.historyTokens)}</div>
            )}
          </div>
          
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                usagePercent > 80 ? 'bg-red-500' : 
                usagePercent > 60 ? 'bg-yellow-500' : 
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          
          <div className="text-xs mt-1 opacity-70">
            {usagePercent.toFixed(1)}% of safe limit ({formatTokenCount(TOKEN_LIMITS.MAX_MESSAGE_CONTEXT)})
          </div>
        </div>
      </div>
    </div>
  );
};
