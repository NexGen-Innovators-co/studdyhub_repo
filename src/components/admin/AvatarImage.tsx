import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface AvatarImageProps {
  url: string | null;
  username: string;
  className?: string;
}

export const AvatarImage: React.FC<AvatarImageProps> = ({ url, username, className = 'w-10 h-10 rounded-full object-cover' }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!url);

  // Reset error state if URL changes
  useEffect(() => {
    setHasError(false);
    setIsLoading(!!url);
  }, [url]);

  // Fallback avatar with user initial
  if (!url || hasError) {
    return (
      <div className={`${className.replace('object-cover', '')} bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm`}>
        {username[0]?.toUpperCase()}
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      {isLoading && (
        <div className={`absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-full`}>
          <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
        </div>
      )}
      <img
        src={url}
        alt={username}
        className={`${className} transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        loading="eager"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />
    </div>
  );
};
