import React, { useState } from 'react';

const earnedAvatarFiles: Record<string, string> = {
  lion: 'img_avatar_lion_1786930325675.jpg',
  falcon: 'img_avatar_falcon_1786930358285.jpg',
  astro: 'img_avatar_astro_1786930344147.jpg',
  cheetah: 'img_avatar_cheetah_1786930372381.jpg',
  dragon: 'img_avatar_dragon_1786930385954.jpg',
  ollie: 'img_prof_ollie_1786717163116.jpg',
};

const earnedAvatarEmojis: Record<string, string> = {
  '🦁': 'lion',
  '🦅': 'falcon',
  '🚀': 'astro',
  '🐆': 'cheetah',
  '🐲': 'dragon',
  '🦉': 'lion',
};

const getEarnedAvatarKey = (value: string) => {
  const normalized = value.trim().toLowerCase();
  const key = normalized.startsWith('avatar_') ? normalized.slice('avatar_'.length) : normalized;
  return earnedAvatarFiles[key] ? key : Object.keys(earnedAvatarFiles).find(name => normalized.includes(name));
};

const getAvatarSource = (value: string | null | undefined) => {
  if (!value?.trim()) return null;
  const normalized = value.trim();
  if (/^(https?:|data:|blob:|\/)/i.test(normalized)) return normalized;

  const emojiAvatar = earnedAvatarEmojis[normalized];
  const earnedAvatarKey = emojiAvatar || getEarnedAvatarKey(normalized);

  if (earnedAvatarKey) {
    return `/mobile/${earnedAvatarFiles[earnedAvatarKey]}`;
  }

  if (/^avatar_[\w-]+$/i.test(normalized)) {
    return `/mobile/${earnedAvatarFiles.lion}`;
  }

  return normalized;
};

const getAvatarEmoji = (value: string | null | undefined) => {
  const normalized = value?.trim();
  if (!normalized || earnedAvatarEmojis[normalized]) return null;
  return normalized.length <= 4 && /[^\u0000-\u007f]/.test(normalized) ? normalized : null;
};

interface ProfileAvatarProps {
  avatarValue: string | null | undefined;
  fullName: string | null | undefined;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  onClick?: () => void;
  title?: string;
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  avatarValue,
  fullName,
  alt = 'Profile avatar',
  className = '',
  fallbackClassName = 'text-white text-sm font-semibold',
  onClick,
  title,
}) => {
  const source = getAvatarSource(avatarValue);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const avatarEmoji = getAvatarEmoji(avatarValue);
  const initials = fullName?.trim().split(/\s+/).filter(Boolean).map(part => part[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      onClick={onClick}
      title={title}
    >
      <span className={`relative z-0 ${fallbackClassName}`}>
        {avatarEmoji ?? initials}
      </span>
      {source && !avatarEmoji && failedSource !== source && (
        <img
          src={source}
          alt={alt}
          className="absolute inset-0 z-10 h-full w-full object-cover"
          onError={() => setFailedSource(source)}
        />
      )}
    </div>
  );
};
