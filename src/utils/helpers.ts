
export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export const formatDate = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
    }
    return `${hours}h ago`;
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString();
  }
};

export const getCategoryIcon = (category: string): string => {
  const icons: { [key: string]: string } = {
    general: '📝',
    math: '🔢',
    science: '🔬',
    history: '📚',
    language: '🌍',
    other: '📄'
  };
  return icons[category] || '📄';
};

export const getCategoryColor = (category: string): string => {
  const colors: { [key: string]: string } = {
    general: 'bg-blue-100 text-blue-700',
    math: 'bg-purple-100 text-purple-700',
    science: 'bg-green-100 text-green-700',
    history: 'bg-orange-100 text-orange-700',
    language: 'bg-pink-100 text-pink-700',
    other: 'bg-gray-100 text-gray-700'
  };
  return colors[category] || 'bg-gray-100 text-gray-700';
};
