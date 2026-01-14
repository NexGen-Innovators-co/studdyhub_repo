// components/Schedule.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Calendar as CalendarIcon, Clock, MapPin, Edit2, Trash2, Loader2, RefreshCw, Sparkles, History, ChevronLeft, ChevronRight, Repeat } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { ScheduleItem } from '../../types/Class';
import { toast } from 'sonner';
import { useAppContext } from '../../hooks/useAppContext';
import { AppShell } from '../layout/AppShell';
import { StickyRail } from '../layout/StickyRail';
import { HeroHeader } from '../layout/HeroHeader';
import { QuickActionsCard } from '../layout/QuickActionsCard';
import { StatsCard } from '../layout/StatsCard';
import { SubscriptionGuard } from '../subscription/SubscriptionGuard';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, getDay, isAfter, isBefore, parseISO, addDays } from 'date-fns';
import { cn } from '../../lib/utils';

interface ScheduleProps {
  scheduleItems: ScheduleItem[];
  onAddItem: (item: ScheduleItem) => void;
  onUpdateItem: (item: ScheduleItem) => void;
  onDeleteItem: (id: string) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const typeColors = {
  class: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-200',
  study: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-200',
  assignment: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900 dark:text-orange-200',
  exam: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-200'
};

const typeIcons = {
  class: '📚',
  study: '📖',
  assignment: '📝',
  exam: '🎯',
  other: '📌'
};

const DAYS_OF_WEEK = [
  { label: 'S', value: 0 },
  { label: 'M', value: 1 },
  { label: 'T', value: 2 },
  { label: 'W', value: 3 },
  { label: 'T', value: 4 },
  { label: 'F', value: 5 },
  { label: 'S', value: 6 },
];

export const Schedule: React.FC<ScheduleProps> = ({
  scheduleItems,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  isLoading = false,
  onRefresh
}) => {
  const { refreshData, dataLoading } = useAppContext();
  const handleRefresh = onRefresh || (() => refreshData('scheduleItems'));
  const isRefreshing = isLoading || dataLoading.scheduleItems;

  const [activeTab, setActiveTab] = useState<'calendar' | 'upcoming' | 'today' | 'past'>('calendar');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const [formData, setFormData] = useState<{
    title: string;
    subject: string;
    type: ScheduleItem['type'];
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    description: string;
    isRecurring: boolean;
    recurrencePattern: 'daily' | 'weekly' | 'monthly';
    recurrenceDays: number[];
    recurrenceEndDate: string;
  }>({
    title: '',
    subject: '',
    type: 'class',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    description: '',
    isRecurring: false,
    recurrencePattern: 'daily',
    recurrenceDays: [],
    recurrenceEndDate: ''
  });

  // Sync tab changes with global header
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('section-tab-active', {
      detail: { section: 'schedule', tab: activeTab }
    }));
  }, [activeTab]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.section === 'schedule' && detail?.tab) {
        setActiveTab(detail.tab as any);
      }
    };
    window.addEventListener('section-tab-change', handler as EventListener);
    return () => window.removeEventListener('section-tab-change', handler as EventListener);
  }, []);

  const resetForm = () => {
    const defaultDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
    setFormData({
      title: '',
      subject: '',
      type: 'class',
      date: defaultDate,
      startTime: '',
      endTime: '',
      location: '',
      description: '',
      isRecurring: false,
      recurrencePattern: 'weekly',
      recurrenceDays: [],
      recurrenceEndDate: ''
    });
    setShowForm(false);
    setEditingItem(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.date || !formData.startTime || !formData.endTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
    const endDateTime = new Date(`${formData.date}T${formData.endTime}`);

    if (endDateTime <= startDateTime) {
      toast.error('End time must be after start time');
      return;
    }

    setIsSubmitting(true);

    try {
      const scheduleItem: ScheduleItem = {
        id: editingItem?.id || `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: formData.title,
        subject: formData.subject,
        type: formData.type,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        location: formData.location,
        description: formData.description,
        color: getColorForType(formData.type),
        userId: editingItem?.userId || '',
        created_at: editingItem?.created_at || new Date().toISOString(),
        
        // Recurring fields
        isRecurring: formData.isRecurring,
        recurrencePattern: formData.isRecurring ? formData.recurrencePattern : undefined,
        recurrenceDays: formData.isRecurring ? formData.recurrenceDays : undefined,
        recurrenceEndDate: formData.isRecurring ? formData.recurrenceEndDate : undefined,
        recurrenceInterval: 1
      };

      if (editingItem) {
        await onUpdateItem(scheduleItem);
        // Toast handled by hook
      } else {
        await onAddItem(scheduleItem);
        // Toast handled by hook
      }

      resetForm();
    } catch (error) {
      toast.error('Failed to save schedule item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item: ScheduleItem) => {
    const date = new Date(item.startTime).toISOString().split('T')[0];
    const startTime = new Date(item.startTime).toTimeString().slice(0, 5);
    const endTime = new Date(item.endTime).toTimeString().slice(0, 5);

    setFormData({
      title: item.title,
      subject: item.subject,
      type: item.type,
      date,
      startTime,
      endTime,
      location: item.location || '',
      description: item.description || '',
      isRecurring: item.isRecurring || false,
      recurrencePattern: (item.recurrencePattern as any) || 'weekly',
      recurrenceDays: item.recurrenceDays || [],
      recurrenceEndDate: item.recurrenceEndDate || ''
    });
    setEditingItem(item);
    setShowForm(true);
  };

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      try {
        await onDeleteItem(id);
        toast.success('Schedule item deleted');
      } catch (error) {
        toast.error('Failed to delete schedule item');
      }
    }
  };

  const getColorForType = (type: ScheduleItem['type']) => {
    const colors = {
      class: '#3B82F6',
      study: '#10B981',
      assignment: '#F59E0B',
      exam: '#EF4444',
      other: '#6B7280'
    };
    return colors[type];
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // --- Calendar Logic ---
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  // Expanded events logic used for Calendar View
  const getEventsForDay = (day: Date) => {
    return scheduleItems.filter(item => {
      // 1. Direct match (same day)
      const itemStart = new Date(item.startTime);
      if (isSameDay(day, itemStart) && !item.isRecurring) return true;

      // 2. Recurring match
      if (item.isRecurring) {
        // Check end date constraint
        if (item.recurrenceEndDate && isAfter(day, new Date(item.recurrenceEndDate))) return false;
        
        // Check start date constraint (can't happen before original start)
        const dayStart = new Date(day);
        dayStart.setHours(0,0,0,0);
        const originStart = new Date(itemStart);
        originStart.setHours(0,0,0,0);
        
        if (isBefore(dayStart, originStart)) return false;

        if (item.recurrencePattern === 'daily') return true;
        
        if (item.recurrencePattern === 'weekly') {
          // date-fns getDay: 0 (Sun) - 6 (Sat)
          const currentDayOfWeek = getDay(day);
          return item.recurrenceDays?.includes(currentDayOfWeek);
        }
        
        if (item.recurrencePattern === 'monthly') {
           return day.getDate() === itemStart.getDate();
        }
      }
      return false;
    });
  };

  // Memoized filtered and sorted items (Legacy logic optimized for non-recurring)
  // For Lists: We only show original instances + occurrences within next 30 days could be added here, 
  // but for now we keep simple list logic mostly for non-recurring or next occurrence.
  const { upcomingItems, todayItems, pastItems } = useMemo(() => {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const upcoming: ScheduleItem[] = [];
    const todayList: ScheduleItem[] = [];
    const past: ScheduleItem[] = [];

    // Simple expansion for list view (Next 30 days only)
    const lookaheadDate = addDays(now, 60);

    // Helper to add if unique (avoid duplicates if event occurs multiple times in lists)
    // Actually, for list view, simpler is to just show "Next Occurrence" for recurring events?
    // Let's iterate all items.
    scheduleItems.forEach(item => {
      const itemStart = new Date(item.startTime);
      
      if (!item.isRecurring) {
        if (itemStart >= now) {
          upcoming.push(item);
          if (itemStart >= today && itemStart < tomorrow) todayList.push(item);
        } else {
          past.push(item);
        }
      } else {
        // For recurring, find next occurrences
        // Simplified: Check if it occurs today
        if (getEventsForDay(new Date()).find(i => i.id === item.id)) {
             todayList.push(item);
        }
        // Add to upcoming if main start is future OR it's recurring active
        if (itemStart >= now || (item.isRecurring && (!item.recurrenceEndDate || new Date(item.recurrenceEndDate) >= now))) {
             upcoming.push(item);
        }
      }
    });

    upcoming.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    past.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    todayList.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return { upcomingItems: upcoming, todayItems: todayList, pastItems: past };
  }, [scheduleItems, currentMonth]); // Depend on currentMonth to force re-calc if needed

  // Get minimum date for date input (today)
  const minDate = new Date().toISOString().split('T')[0];

  const getItemsForCurrentTab = () => {
    switch (activeTab) {
      case 'today':
        return todayItems;
      case 'past':
        return pastItems;
      default:
        return upcomingItems;
    }
  };

  const currentItems = getItemsForCurrentTab();

  const leftRail = (
    <StickyRail>
      <QuickActionsCard
        title="Quick Actions"
        actions={[
          {
            label: "Add Schedule Item",
            icon: <Plus className="h-4 w-4 text-blue-600" />,
            onClick: () => setShowForm(true),
          },
          {
            label: isRefreshing ? "Refreshing..." : "Refresh",
            icon: <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />,
            onClick: () => handleRefresh?.(),
          }
        ]}
      />
      <StatsCard
        title="Schedule Stats"
        items={[
          { label: "Upcoming", value: upcomingItems.length, icon: <CalendarIcon className="h-4 w-4 text-blue-500" /> },
          { label: "Today", value: todayItems.length, icon: <Clock className="h-4 w-4 text-green-500" /> },
          { label: "Past", value: pastItems.length, icon: <History className="h-4 w-4 text-slate-500" /> },
        ]}
      />
    </StickyRail>
  );

  const rightRail = (
    <StickyRail>
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Tips</h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Add start/end times to avoid overlaps</li>
          <li>• Use types to color-code events</li>
          <li>• Refresh to sync latest changes</li>
          <li>• Keep descriptions short and clear</li>
        </ul>
      </Card>
    </StickyRail>
  );

  return (
    <AppShell left={leftRail} right={rightRail}>
      <div className="px-3 lg:px-0">
        <HeroHeader
          title="Schedule & Timetable"
          subtitle={`${currentItems.length} ${activeTab} ${currentItems.length === 1 ? 'event' : 'events'}`}
          icon={<Sparkles className="h-7 w-7 text-blue-300" />}
          gradient="from-blue-600 to-indigo-600"
          actions={
            <div className="flex gap-2">
              <SubscriptionGuard
                feature="Schedule Items"
                limitFeature="maxScheduleItems"
                currentCount={scheduleItems.length}
              >
                <Button
                  onClick={() => setShowForm(true)}
                  className="bg-white text-blue-700 hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </SubscriptionGuard>
            </div>
          }
        />

        <div className="space-y-6 w-full">
          {/* Form */}
          {showForm && (
            <Card className="border-2 border-blue-500 dark:border-blue-400">
              <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
                <CardTitle className="flex items-center justify-between">
                  <span>{editingItem ? 'Edit' : 'Add'} Schedule Item</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetForm}
                    disabled={isSubmitting}
                  >
                    ✕
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Title *</label>
                      <Input
                        placeholder="e.g., Linear Algebra Lecture"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subject</label>
                      <Input
                        placeholder="e.g., Mathematics"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Type *</label>
                      <Select
                        value={formData.type}
                        onValueChange={(value: ScheduleItem['type']) => setFormData({ ...formData, type: value })}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="class">{typeIcons.class} Class</SelectItem>
                          <SelectItem value="study">{typeIcons.study} Study Session</SelectItem>
                          <SelectItem value="assignment">{typeIcons.assignment} Assignment</SelectItem>
                          <SelectItem value="exam">{typeIcons.exam} Exam</SelectItem>
                          <SelectItem value="other">{typeIcons.other} Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Date *</label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        min={minDate}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Location</label>
                      <Input
                        placeholder="e.g., Room 301"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Start Time *</label>
                      <Input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">End Time *</label>
                      <Input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      placeholder="Additional notes or details..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Recurring Settings */}
                  <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="recurring-mode"
                        checked={formData.isRecurring}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isRecurring: checked }))}
                      />
                      <Label htmlFor="recurring-mode" className="font-medium flex items-center gap-2">
                        <Repeat className="h-4 w-4" /> Repeat Event
                      </Label>
                    </div>

                    {formData.isRecurring && (
                      <div className="pl-6 space-y-4 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Frequency</Label>
                            <Select
                              value={formData.recurrencePattern}
                              onValueChange={(val: any) => setFormData(prev => ({ ...prev, recurrencePattern: val }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                           <div className="space-y-2">
                            <Label>End Date (Optional)</Label>
                             <Input 
                                type="date"
                                value={formData.recurrenceEndDate || ''}
                                onChange={(e) => setFormData(prev => ({...prev, recurrenceEndDate: e.target.value}))}
                                min={formData.date}
                             />
                           </div>
                        </div>

                         {formData.recurrencePattern === 'weekly' && (
                           <div className="space-y-2">
                             <Label>Repeats On</Label>
                             <div className="flex flex-wrap gap-2">
                               {DAYS_OF_WEEK.map((day) => {
                                 const isSelected = formData.recurrenceDays.includes(day.value);
                                 return (
                                   <div
                                     key={day.value}
                                     onClick={() => {
                                       setFormData(prev => ({
                                         ...prev,
                                         recurrenceDays: isSelected 
                                            ? prev.recurrenceDays.filter(d => d !== day.value)
                                            : [...prev.recurrenceDays, day.value].sort()
                                       }));
                                     }}
                                     className={cn(
                                       "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer transition-colors border",
                                       isSelected 
                                         ? "bg-blue-600 text-white border-blue-600" 
                                         : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"
                                     )}
                                   >
                                     {day.label}
                                   </div>
                                 );
                               })}
                             </div>
                           </div>
                         )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <SubscriptionGuard
                      feature="Schedule Items"
                      limitFeature="maxScheduleItems"
                      currentCount={scheduleItems.length}
                    >
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {editingItem ? 'Updating...' : 'Adding...'}
                          </>
                        ) : (
                          <>
                            {editingItem ? 'Update' : 'Add'} Item
                          </>
                        )}
                      </Button>
                    </SubscriptionGuard>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {isLoading && scheduleItems.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mb-4" />
                  <p className="text-slate-600 dark:text-gray-300">Loading schedule...</p>
                </div>
              </CardContent>
            </Card>
          ) : activeTab === 'calendar' ? (
             <div className="space-y-6">
               {/* Calendar Header */}
               <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                 <div className="flex items-center gap-4">
                   <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">
                     {format(currentMonth, 'MMMM yyyy')}
                   </h2>
                   <div className="flex gap-1">
                     <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                       <ChevronLeft className="h-4 w-4" />
                     </Button>
                     <Button variant="outline" size="icon" onClick={handleNextMonth}>
                       <ChevronRight className="h-4 w-4" />
                     </Button>
                     <Button variant="outline" onClick={handleToday} className="ml-2">
                       Today
                     </Button>
                   </div>
                 </div>
               </div>

               <div className="flex flex-col gap-8">
                 {/* Calendar Grid */}
                 <Card className="w-full border-none shadow-md overflow-hidden">
                   <CardContent className="p-0">
                     {/* Days Header */}
                     <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                       {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                         <div key={day} className="py-3 text-center text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider">
                           <span className="hidden sm:inline">{day}</span>
                           <span className="sm:hidden">{day.charAt(0)}</span>
                         </div>
                       ))}
                     </div>
                     
                     {/* Days Cells */}
                     <div className="grid grid-cols-7 auto-rows-fr bg-slate-200 dark:bg-slate-700 gap-[1px]">
                       {calendarDays.map((day, idx) => {
                         const events = getEventsForDay(day);
                         const isSelected = selectedDate && isSameDay(day, selectedDate);
                         const isCurrentMonth = isSameMonth(day, currentMonth);
                         const isTodayDate = isToday(day);

                         return (
                           <div
                             key={day.toISOString()}
                             onClick={() => setSelectedDate(day)}
                             className={cn(
                               "min-h-[100px] sm:min-h-[120px] p-1 sm:p-2 bg-white dark:bg-slate-800 cursor-pointer transition-colors relative hover:bg-slate-50 dark:hover:bg-slate-800/80",
                               !isCurrentMonth && "bg-slate-50 dark:bg-slate-900/20 text-slate-400",
                               isSelected && "ring-2 ring-inset ring-blue-500 z-10"
                             )}
                           >
                             <div className="flex justify-between items-start mb-1">
                               <span className={cn(
                                 "text-xs sm:text-sm font-medium h-6 w-6 flex items-center justify-center rounded-full",
                                 isTodayDate 
                                   ? "bg-blue-600 text-white" 
                                   : "text-slate-700 dark:text-slate-300"
                               )}>
                                 {format(day, 'd')}
                               </span>
                               {events.length > 0 && (
                                 <span className="text-[10px] sm:text-xs font-bold text-slate-400">
                                   {events.length}
                                 </span>
                               )}
                             </div>
                             
                             {/* Event Indicators */}
                             <div className="space-y-1">
                               {events.slice(0, 4).map((event, i) => (
                                 <div 
                                   key={i} 
                                   className="text-[10px] sm:text-xs truncate px-1 py-0.5 rounded border-l-2 opacity-90 leading-tight"
                                   style={{ 
                                     backgroundColor: `${event.color}20`, 
                                     color: event.color, // Use color text for contrast
                                     borderColor: event.color 
                                   }}
                                 >
                                   <span className="hidden sm:inline">{formatTime(new Date(event.startTime))} </span>
                                   {event.title}
                                 </div>
                               ))}
                               {events.length > 4 && (
                                 <div className="text-[10px] text-slate-400 pl-1">
                                   + {events.length - 4} more
                                 </div>
                               )}
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </CardContent>
                 </Card>

                 {/* Selected Day Panel */}
                 <div className="space-y-4">
                   <div className="flex items-center justify-between">
                     <h3 className="font-semibold text-lg">
                       {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'Select a date'}
                     </h3>
                     {selectedDate && (
                      <SubscriptionGuard
                        feature="Schedule Items"
                        limitFeature="maxScheduleItems"
                        currentCount={scheduleItems.length}
                      >
                       <Button size="sm" onClick={() => {
                         setFormData(prev => ({ ...prev, date: format(selectedDate, 'yyyy-MM-dd') }));
                         setShowForm(true);
                       }}>
                         <Plus className="h-4 w-4 mr-2" />
                         Add Event
                       </Button>
                      </SubscriptionGuard>
                     )}
                   </div>

                   <Card className="min-h-[400px] h-auto overflow-hidden flex flex-col">
                     <CardContent className="p-4 flex-1 overflow-y-auto space-y-3">
                       {selectedDate ? (
                         (() => {
                           const dayEvents = getEventsForDay(selectedDate);
                           if (dayEvents.length === 0) {
                             return (
                               <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                 <CalendarIcon className="h-10 w-10 opacity-20" />
                                 <p className="text-sm">No events scheduled</p>
                               </div>
                             );
                           }
                           return dayEvents
                             .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                             .map((item) => (
                             <Card 
                               key={item.id} 
                               className="hover:shadow-lg transition-all duration-200 border-l-4"
                               style={{ borderLeftColor: item.color }}
                             >
                               <CardContent className="p-4">
                                 <div className="flex items-start justify-between">
                                   <div className="flex-1">
                                     <div className="flex items-center gap-2 mb-2 flex-wrap">
                                       <span className="text-2xl">{typeIcons[item.type]}</span>
                                       <h3 className="font-semibold text-lg text-slate-800 dark:text-gray-200">
                                         {item.title}
                                       </h3>
                                       <Badge className={typeColors[item.type]}>
                                         {item.type}
                                       </Badge>
                                       {item.isRecurring && (
                                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-5 border-blue-200 text-blue-600 flex gap-1 items-center ml-2">
                                            <Repeat className="h-3 w-3" />
                                            {item.recurrencePattern}
                                          </Badge>
                                        )}
                                     </div>

                                     <div className="space-y-2 text-sm text-slate-600 dark:text-gray-300">
                                       {item.subject && (
                                         <div className="flex items-center gap-2">
                                           <span className="font-medium">Subject:</span>
                                           <span>{item.subject}</span>
                                         </div>
                                       )}

                                       <div className="flex items-center gap-2">
                                         <CalendarIcon className="h-4 w-4 text-blue-500" />
                                         <span className="font-medium">{formatDate(new Date(item.startTime))}</span>
                                       </div>

                                       <div className="flex items-center gap-2">
                                         <Clock className="h-4 w-4 text-green-500" />
                                         <span>
                                           {formatTime(new Date(item.startTime))} - {formatTime(new Date(item.endTime))}
                                         </span>
                                       </div>

                                       {item.location && (
                                         <div className="flex items-center gap-2">
                                           <MapPin className="h-4 w-4 text-red-500" />
                                           <span>{item.location}</span>
                                         </div>
                                       )}

                                       {item.description && (
                                         <p className="text-slate-500 dark:text-gray-400 mt-2 pl-6 italic">
                                           {item.description}
                                         </p>
                                       )}
                                     </div>
                                   </div>

                                   <div className="flex gap-1 ml-4 flex-col sm:flex-row">
                                     <Button
                                       variant="ghost"
                                       size="sm"
                                       onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                                       title="Edit"
                                       className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                     >
                                       <Edit2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                     </Button>
                                     <Button
                                       variant="ghost"
                                       size="sm"
                                       onClick={(e) => { e.stopPropagation(); handleDelete(item.id, item.title); }}
                                       title="Delete"
                                       className="hover:bg-red-50 dark:hover:bg-red-900/20"
                                     >
                                       <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                                     </Button>
                                   </div>
                                 </div>
                               </CardContent>
                             </Card>
                           ));
                         })()
                       ) : (
                         <div className="text-center text-slate-500 mt-10">Select a date to view events</div>
                       )}
                     </CardContent>
                   </Card>
                 </div>
               </div>
             </div>
          ) : (
            <>
              {/* Current Tab Items */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 flex items-center gap-2">
                  {activeTab === 'upcoming' ? <CalendarIcon className="h-5 w-5" /> :
                    activeTab === 'today' ? <Clock className="h-5 w-5" /> :
                      <History className="h-5 w-5" />}
                  {activeTab === 'upcoming' ? 'Upcoming Events' :
                    activeTab === 'today' ? "Today's Events" : 'Past Events'}
                </h3>
                {currentItems.length === 0 ? (
                  <Card className="text-center py-12 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-900">
                    <CardContent>
                      {activeTab === 'upcoming' ? (
                        <CalendarIcon className="h-16 w-16 mx-auto text-slate-400 dark:text-gray-500 mb-4" />
                      ) : activeTab === 'today' ? (
                        <Clock className="h-16 w-16 mx-auto text-slate-400 dark:text-gray-500 mb-4" />
                      ) : (
                        <History className="h-16 w-16 mx-auto text-slate-400 dark:text-gray-500 mb-4" />
                      )}
                      <h3 className="text-lg font-medium text-slate-600 dark:text-gray-300 mb-2">
                        {activeTab === 'upcoming' ? 'No upcoming events' :
                          activeTab === 'today' ? 'No events scheduled for today' :
                            'No past events'}
                      </h3>
                      <p className="text-slate-500 dark:text-gray-400 mb-4">
                        {activeTab === 'upcoming' ? 'Add your first schedule item to start organizing your time' :
                          activeTab === 'today' ? 'Schedule events for today to see them here' :
                            'Completed events will appear here'}
                      </p>
                      <SubscriptionGuard
                        feature="Schedule Items"
                        limitFeature="maxScheduleItems"
                        currentCount={scheduleItems.length}
                      >
                        <Button
                          onClick={() => setShowForm(true)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Schedule Item
                        </Button>
                      </SubscriptionGuard>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {currentItems.map((item) => (
                      <Card
                        key={item.id}
                        className="hover:shadow-lg transition-all duration-200 border-l-4"
                        style={{ borderLeftColor: item.color }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">{typeIcons[item.type]}</span>
                                <h3 className="font-semibold text-lg text-slate-800 dark:text-gray-200">
                                  {item.title}
                                </h3>
                                <Badge className={typeColors[item.type]}>
                                  {item.type}
                                </Badge>
                              </div>

                              <div className="space-y-2 text-sm text-slate-600 dark:text-gray-300">
                                {item.subject && (
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">Subject:</span>
                                    <span>{item.subject}</span>
                                  </div>
                                )}

                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="h-4 w-4 text-blue-500" />
                                  <span className="font-medium">{formatDate(new Date(item.startTime))}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-green-500" />
                                  <span>
                                    {formatTime(new Date(item.startTime))} - {formatTime(new Date(item.endTime))}
                                  </span>
                                </div>

                                {item.location && (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-red-500" />
                                    <span>{item.location}</span>
                                  </div>
                                )}

                                {item.description && (
                                  <p className="text-slate-500 dark:text-gray-400 mt-2 pl-6 italic">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-1 ml-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(item)}
                                title="Edit"
                                className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              >
                                <Edit2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(item.id, item.title)}
                                title="Delete"
                                className="hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {handleRefresh && (
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          size="icon"
          className="fixed bottom-24 right-6 lg:bottom-6 h-14 w-14 rounded-full shadow-xl z-50 bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 hover:scale-105"
        >
          <RefreshCw className={`h-6 w-6 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </AppShell>
  );
};