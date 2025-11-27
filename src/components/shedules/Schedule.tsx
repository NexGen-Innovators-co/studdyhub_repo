import React, { useState, useMemo } from 'react';
import { Plus, Calendar, Clock, MapPin, Edit2, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { ScheduleItem } from '../../types/Class';
import { toast } from 'sonner';

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
      console.error('Error saving schedule item:', error);
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
        console.error('Error deleting schedule item:', error);
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
  const { upcomingItems, pastItems } = useMemo(() => {
    const now = new Date();
    const upcoming: ScheduleItem[] = [];
    const past: ScheduleItem[] = [];

    scheduleItems.forEach(item => {
      if (new Date(item.startTime) >= now) {
        upcoming.push(item);
      } else {
        past.push(item);
      }
    });

    upcoming.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    past.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    return { upcomingItems: upcoming, pastItems: past };
  }, [scheduleItems]);

  // Get minimum date for date input (today)
  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto p-4 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-gray-200">
            Schedule & Timetable
          </h2>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            {upcomingItems.length} upcoming {upcomingItems.length === 1 ? 'event' : 'events'}
          </p>
        </div>
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
          <Button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Schedule Item
          </Button>
        </div>
      </div>

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
          {/* Upcoming Items */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Events
            </h3>
            {upcomingItems.length === 0 ? (
              <Card className="text-center py-12 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-900">
                <CardContent>
                  <Calendar className="h-16 w-16 mx-auto text-slate-400 dark:text-gray-500 mb-4" />
                  <h3 className="text-lg font-medium text-slate-600 dark:text-gray-300 mb-2">
                    No upcoming events
                  </h3>
                  <p className="text-slate-500 dark:text-gray-400 mb-4">
                    Add your first schedule item to start organizing your time
                  </p>
                  <Button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Schedule Item
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {upcomingItems.map((item) => (
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

          {/* Past Items (Optional - collapsed by default) */}
          {pastItems.length > 0 && (
            <details className="space-y-4">
              <summary className="text-lg font-semibold text-slate-600 dark:text-gray-400 cursor-pointer hover:text-slate-800 dark:hover:text-gray-200 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Past Events ({pastItems.length})
              </summary>
              <div className="grid gap-4 mt-4 opacity-60">
                {pastItems.slice(0, 10).map((item) => (
                  <Card
                    key={item.id}
                    className="hover:shadow-md transition-shadow border-l-4"
                    style={{ borderLeftColor: item.color }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span>{typeIcons[item.type]}</span>
                            <h4 className="font-medium text-sm">{item.title}</h4>
                            <Badge className={typeColors[item.type]} variant="outline">
                              {item.type}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-gray-400">
                            {formatDate(new Date(item.startTime))} • {formatTime(new Date(item.startTime))}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id, item.title)}
                          className="hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3 w-3 text-red-600 dark:text-red-400" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
};