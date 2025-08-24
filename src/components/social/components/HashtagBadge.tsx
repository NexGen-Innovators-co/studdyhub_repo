import React from 'react';
import { Badge } from '../../ui/badge';
import { HashtagBadgeProps } from '../types/social';

export const HashtagBadge: React.FC<HashtagBadgeProps> = ({ hashtag, onClick }) => {
  return (
    <Badge 
      variant="secondary" 
      className="text-xs hover:bg-primary/10 cursor-pointer transition-colors"
      onClick={onClick}
    >
      #{hashtag.name}
    </Badge>
  );
};