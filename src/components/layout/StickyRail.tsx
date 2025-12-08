import React from 'react';
import clsx from 'clsx';

interface StickyRailProps {
  children: React.ReactNode;
  className?: string;
}

export const StickyRail: React.FC<StickyRailProps> = ({ children, className }) => (
  <div className={clsx("space-y-6 w-full max-w-[360px]", className)}>
    {children}
  </div>
);

