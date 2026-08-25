import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { avatarCache } from '../../../utils/avatarCache';

interface AvatarImageProps {
  url: string | null;
  username: string;
  className?: string;
}

export const AvatarImage: React.FC<AvatarImageProps> = ({ url, username, className = 'w-10 h-10 rounded-full object-cover' }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!url);
  const isMountedRef = useRef(true);

  // Reset state on URL change
  useEffect(() => {
    isMountedRef.current = true;
    setHasError(false);
    setIsLoading(!!url);

    return () => {
      isMountedRef.current = false;
    };
  }, [url]);

  // Fallback avatar with user initial
  if (!url || hasError || !avatarCache.shouldAttempt(url)) {
    const baseClasses = className.replace('object-cover', '');
    return (
      <div className="relative inline-block group">
        <div className={`${baseClasses} bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm`}>
          {username[0]?.toUpperCase() || '?'}
        </div>
        {hasError && (
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
            Avatar unavailable
          </div>
        )}
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
        loading="lazy"
        onLoad={() => {
          if (isMountedRef.current) {
            avatarCache.setCached(url);
            setIsLoading(false);
          }
        }}
        onError={() => {
          if (isMountedRef.current) {
            avatarCache.setFailed(url);
            setHasError(true);
            setIsLoading(false);
          }
        }}
      />
    </div>
  );
};
