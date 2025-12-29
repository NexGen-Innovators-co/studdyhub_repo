// components/Schedule.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Calendar, Clock, MapPin, Edit2, Trash2, Loader2, RefreshCw, Sparkles, History } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { ScheduleItem } from '../../types/Class';
import { toast } from 'sonner';
import { AppShell } from '../layout/AppShell';
import { StickyRail } from '../layout/StickyRail';
import { HeroHeader } from '../layout/HeroHeader';
import { QuickActionsCard } from '../layout/QuickActionsCard';
import { StatsCard } from '../layout/StatsCard';
import { SubscriptionGuard } from '../subscription/SubscriptionGuard';

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

export const Schedule: React.FC<ScheduleProps> = ({
  scheduleItems,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  isLoading = false,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'today' | 'past'>('upcoming');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    type: 'class' as ScheduleItem['type'],
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    description: ''
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
    setFormData({
      title: '',
      subject: '',
      type: 'class',
      date: '',
      startTime: '',
      endTime: '',
      location: '',
      description: ''
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
        created_at: editingItem?.created_at || new Date().toISOString()
      };

      if (editingItem) {
        await onUpdateItem(scheduleItem);
        toast.success('Schedule item updated successfully');
      } else {
        await onAddItem(scheduleItem);
        toast.success('Schedule item added successfully');
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
      description: item.description || ''
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

  // Memoized filtered and sorted items
  const { upcomingItems, todayItems, pastItems } = useMemo(() => {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const upcoming: ScheduleItem[] = [];
    const todayItems: ScheduleItem[] = [];
    const past: ScheduleItem[] = [];

    scheduleItems.forEach(item => {
      const itemDate = new Date(item.startTime);

      if (itemDate >= now) {
        upcoming.push(item);

        // Check if it's today
        if (itemDate >= today && itemDate < tomorrow) {
          todayItems.push(item);
        }
      } else {
        past.push(item);
      }
    });

    upcoming.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    past.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    todayItems.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return { upcomingItems: upcoming, todayItems, pastItems: past };
  }, [scheduleItems]);

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
          ...(onRefresh ? [{
            label: isLoading ? "Refreshing..." : "Refresh",
            icon: <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />,
            onClick: () => onRefresh?.(),
          }] : [])
        ]}
      />
      <StatsCard
        title="Schedule Stats"
        items={[
          { label: "Upcoming", value: upcomingItems.length, icon: <Calendar className="h-4 w-4 text-blue-500" /> },
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
              {onRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              )}
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
          ) : (
            <>
              {/* Current Tab Items */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 flex items-center gap-2">
                  {activeTab === 'upcoming' ? <Calendar className="h-5 w-5" /> :
                    activeTab === 'today' ? <Clock className="h-5 w-5" /> :
                      <History className="h-5 w-5" />}
                  {activeTab === 'upcoming' ? 'Upcoming Events' :
                    activeTab === 'today' ? "Today's Events" : 'Past Events'}
                </h3>
                {currentItems.length === 0 ? (
                  <Card className="text-center py-12 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-900">
                    <CardContent>
                      {activeTab === 'upcoming' ? (
                        <Calendar className="h-16 w-16 mx-auto text-slate-400 dark:text-gray-500 mb-4" />
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
                                  <Calendar className="h-4 w-4 text-blue-500" />
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
    </AppShell>
  );
};