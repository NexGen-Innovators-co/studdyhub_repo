import React from 'react';
import clsx from 'clsx';

interface StickyRailProps {
  children: React.ReactNode;
  className?: string;
}

export const StickyRail: React.FC<StickyRailProps> = ({ children, className }) => (
  <div className={clsx("space-y-4 w-full", className)}>
    {children}
  </div>
);

