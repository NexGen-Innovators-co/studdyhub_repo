// Schedule form for adding/editing schedule items
import React, { useState } from 'react';
import { Plus, Loader2, Repeat } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { ScheduleItem } from '../../../types/Class';
import { toast } from 'sonner';
import { SubscriptionGuard } from '../../subscription/SubscriptionGuard';
import { cn } from '../../../lib/utils';
import { typeIcons, DAYS_OF_WEEK, ScheduleFormData, defaultFormData } from '../constants/scheduleConstants';
import { getColorForType, getMinDate } from '../utils/scheduleUtils';

interface ScheduleFormProps {
  editingItem: ScheduleItem | null;
  onSubmit: (item: ScheduleItem) => Promise<void>;
  onCancel: () => void;
  scheduleCount: number;
  initialDate?: string;
}

export const ScheduleForm: React.FC<ScheduleFormProps> = ({
  editingItem,
  onSubmit,
  onCancel,
  scheduleCount,
  initialDate
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<ScheduleFormData>(() => {
    if (editingItem) {
      const date = new Date(editingItem.startTime).toISOString().split('T')[0];
      const startTime = new Date(editingItem.startTime).toTimeString().slice(0, 5);
      const endTime = new Date(editingItem.endTime).toTimeString().slice(0, 5);
      return {
        title: editingItem.title,
        subject: editingItem.subject,
        type: editingItem.type,
        date,
        startTime,
        endTime,
        location: editingItem.location || '',
        description: editingItem.description || '',
        isRecurring: editingItem.isRecurring || false,
        recurrencePattern: (editingItem.recurrencePattern as any) || 'weekly',
        recurrenceDays: editingItem.recurrenceDays || [],
        recurrenceEndDate: editingItem.recurrenceEndDate || ''
      };
    }
    return { ...defaultFormData, date: initialDate || '' };
  });

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
        isRecurring: formData.isRecurring,
        recurrencePattern: formData.isRecurring ? formData.recurrencePattern : undefined,
        recurrenceDays: formData.isRecurring ? formData.recurrenceDays : undefined,
        recurrenceEndDate: formData.isRecurring ? formData.recurrenceEndDate : undefined,
        recurrenceInterval: 1
      };

      await onSubmit(scheduleItem);
      onCancel();
    } catch (error) {
      toast.error('Failed to save schedule item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const minDate = getMinDate();

  return (
    <Card className="border-2 border-blue-500 dark:border-blue-400 animate-in slide-in-from-top-2 duration-300">
      <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
        <CardTitle className="flex items-center justify-between">
          <span>{editingItem ? 'Edit' : 'Add'} Schedule Item</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
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
                      onChange={(e) => setFormData(prev => ({ ...prev, recurrenceEndDate: e.target.value }))}
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
                              "w-10 h-10 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer transition-colors border",
                              isSelected
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
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
              currentCount={scheduleCount}
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
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
