import React from 'react';
import { Card } from "../ui/card";
import { Button } from "../ui/button";

interface ActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

interface QuickActionsCardProps {
  title?: string;
  actions: ActionItem[];
}

export const QuickActionsCard: React.FC<QuickActionsCardProps> = ({ title = "Quick Actions", actions }) => {
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl shadow-sm border border-blue-100 dark:border-slate-700 p-4">
      <h3 className="font-bold text-lg mb-3 text-blue-900 dark:text-blue-100">{title}</h3>
      <div className="space-y-2">
        {actions.map((action, idx) => (
          <Button
            key={idx}
            variant="outline"
            className="w-full justify-start bg-white dark:bg-slate-800"
            onClick={action.onClick}
          >
            {action.icon}
            {action.icon && <span className="w-2" />}
            {action.label}
          </Button>
        ))}
      </div>
    </Card>
  );
};

