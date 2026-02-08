import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SocialFeedSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export const SocialFeedSearchBar: React.FC<SocialFeedSearchBarProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  return (
    <div className="px-4 pt-4">
      <div className="max-w-[720px] mx-auto">
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="pl-9 pr-10"
          />
          {value && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-500"
              onClick={() => onChange('')}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
