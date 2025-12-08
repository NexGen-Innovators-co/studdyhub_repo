import React from 'react';
import clsx from 'clsx';

interface AppShellProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Three-column responsive shell that mirrors the Social/Class Recording layout.
 * Left and right rails become sticky on desktop; center is the main scroll area.
 */
export const AppShell: React.FC<AppShellProps> = ({ left, right, children, className }) => {
  return (
    <div className="bg-transparent font-sans">
      <div className="max-w-[1240px] mx-auto px-0">
        <div className={clsx("grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-6 relative", className)}>
          {left && (
            <div className="hidden lg:block lg:col-span-3 lg:pt-3 pr-4">
              <div className="sticky top-4 max-h-[calc(100vh-32px)] overflow-y-auto scrollbar-hide modern-scrollbar">
                {left}
              </div>
            </div>
          )}

          <main className="col-span-1 lg:col-span-6 min-h-screen pb-20 lg:pb-20">
            {children}
          </main>

          {right && (
            <div className="hidden lg:block lg:col-span-3 lg:pt-3">
              <div className="sticky top-4 max-h-[calc(100vh-32px)] overflow-y-auto scrollbar-hide modern-scrollbar">
                {right}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

