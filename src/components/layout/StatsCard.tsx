import React from 'react';
import { Card, CardContent } from "../ui/card";

interface StatItem {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

interface StatsCardProps {
  title?: string;
  items: StatItem[];
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, items }) => {
  return (
    <Card className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
      {title && (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-lg">{title}</h3>
        </div>
      )}
      <CardContent className="p-4 space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {item.icon}
              <span className="text-sm text-slate-600 dark:text-slate-300">{item.label}</span>
            </div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {item.value}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

