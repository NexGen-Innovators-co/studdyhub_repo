import React from 'react';

// Props: current, total
interface ProgressTrackerProps {
  current: number;
  total: number;
  className?: string;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({ current, total, className }) => {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className={`space-y-2 ${className || ''}`}>
      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="text-xs text-gray-500">
        {current} / {total} questions answered
      </div>
    </div>
  );
};

export default ProgressTracker;
