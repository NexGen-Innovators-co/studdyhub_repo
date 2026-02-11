// Schedule utility functions

export const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const getColorForType = (type: string) => {
  const colors: Record<string, string> = {
    class: '#3B82F6',
    study: '#10B981',
    assignment: '#F59E0B',
    exam: '#EF4444',
    other: '#6B7280'
  };
  return colors[type] || colors.other;
};

/** Returns the minimum selectable date (today) in yyyy-MM-dd format */
export const getMinDate = () => new Date().toISOString().split('T')[0];

/**
 * Calculate time remaining until an event starts.
 * Returns human-readable strings like "in 2h 30m", "in 3 days", "now".
 */
export const getTimeUntil = (startTime: string): string | null => {
  const now = new Date();
  const start = new Date(startTime);
  const diffMs = start.getTime() - now.getTime();

  if (diffMs < 0) return null; // already started/past

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffHours < 24) {
    const remainingMins = diffMins % 60;
    return remainingMins > 0 ? `in ${diffHours}h ${remainingMins}m` : `in ${diffHours}h`;
  }
  if (diffDays === 1) return 'tomorrow';
  if (diffDays < 7) return `in ${diffDays} days`;
  return `in ${Math.floor(diffDays / 7)}w`;
};

/**
 * Check if two schedule items have overlapping times on the same day.
 */
export const hasTimeConflict = (
  startA: string, endA: string,
  startB: string, endB: string
): boolean => {
  const a0 = new Date(startA).getTime();
  const a1 = new Date(endA).getTime();
  const b0 = new Date(startB).getTime();
  const b1 = new Date(endB).getTime();

  // Same day check
  const dayA = new Date(startA).toDateString();
  const dayB = new Date(startB).toDateString();
  if (dayA !== dayB) return false;

  return a0 < b1 && b0 < a1;
};
