// Schedule constants, type colors, icons, and day-of-week configuration

export const typeColors: Record<string, string> = {
  class: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-200',
  study: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-200',
  assignment: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900 dark:text-orange-200',
  exam: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-200'
};

export const typeIcons: Record<string, string> = {
  class: '📚',
  study: '📖',
  assignment: '📝',
  exam: '🎯',
  other: '📌'
};

export const typeColorHex: Record<string, string> = {
  class: '#3B82F6',
  study: '#10B981',
  assignment: '#F59E0B',
  exam: '#EF4444',
  other: '#6B7280'
};

export const DAYS_OF_WEEK = [
  { label: 'S', value: 0 },
  { label: 'M', value: 1 },
  { label: 'T', value: 2 },
  { label: 'W', value: 3 },
  { label: 'T', value: 4 },
  { label: 'F', value: 5 },
  { label: 'S', value: 6 },
] as const;

export type ScheduleFormData = {
  title: string;
  subject: string;
  type: 'class' | 'study' | 'assignment' | 'exam' | 'other';
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  isRecurring: boolean;
  recurrencePattern: 'daily' | 'weekly' | 'monthly';
  recurrenceDays: number[];
  recurrenceEndDate: string;
};

export const defaultFormData: ScheduleFormData = {
  title: '',
  subject: '',
  type: 'class',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  description: '',
  isRecurring: false,
  recurrencePattern: 'weekly',
  recurrenceDays: [],
  recurrenceEndDate: ''
};
