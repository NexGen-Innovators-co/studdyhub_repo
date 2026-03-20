import React from 'react';
import clsx from 'clsx';

interface HeroHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  gradient?: string;
  actions?: React.ReactNode;
  stats?: React.ReactNode;
  tabs?: React.ReactNode;
  className?: string;
}

/**
 * Gradient hero band used across pages to align with Social/Class Recording look.
 */
export const HeroHeader: React.FC<HeroHeaderProps> = ({
  title,
  subtitle,
  icon,
  gradient = "from-blue-600 to-indigo-600",
  actions,
  stats,
  tabs,
  className,
}) => {
  return (
    <div className={clsx("relative overflow-hidden rounded-2xl my-4 p-6 bg-gradient-to-r text-white shadow-xl", `bg-gradient-to-r ${gradient}`, className)}>
      <div className="absolute inset-0 bg-black/10" />
      <div className="relative z-10 flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {icon && <div className="p-1.5 sm:p-2 bg-white/15 rounded-xl">{icon}</div>}
            <div>
              <h1 className="text-xl sm:text-3xl font-bold leading-tight">{title}</h1>
              {subtitle && <p className="text-white/80 text-xs sm:text-sm">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 self-end sm:self-auto">{actions}</div>}
        </div>
        {tabs && (
          <div className="mt-2">
            {tabs}
          </div>
        )}
        {stats}
      </div>
    </div>
  );
};

