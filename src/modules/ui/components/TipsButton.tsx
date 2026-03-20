import React from 'react';
import { Lightbulb } from 'lucide-react';
import { Button } from './button';

interface TipsButtonProps {
  onClick: () => void;
  isVisible: boolean;
}

export const TipsButton: React.FC<TipsButtonProps> = ({ onClick, isVisible }) => {
  return (
    <Button
      onClick={onClick}
      size="lg"
      variant='ghost'
      className="h-11 w-11 rounded-full shadow-lg z-50 text-blue-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300 transition-all duration-300 hover:scale-110 cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 backdrop-blur-sm p-0 flex items-center justify-center"
      style={{
        filter: 'drop-shadow(0 0 8px rgba(36, 190, 251, 0.6))',
        animation: 'glow 2s ease-in-out infinite'
      }}
      title={isVisible ? "Hide Quick Tips" : "Show Quick Tips"}
    >
      <Lightbulb className="w-6 h-6 fill-current" />
    </Button>
  );
};
