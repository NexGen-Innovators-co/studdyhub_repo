
import React, { useState } from 'react';
import { Plus, Calendar, Clock, MapPin, Edit2, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { ScheduleItem } from '../types/Class';
import { toast } from 'sonner';

interface ScheduleProps {
  scheduleItems: ScheduleItem[];
  onAddItem: (item: ScheduleItem) => void;
  onUpdateItem: (item: ScheduleItem) => void;
  onDeleteItem: (id: string) => void;
}

const typeColors = {
  class: 'bg-blue-100 text-blue-700 border-blue-200',
  study: 'bg-green-100 text-green-700 border-green-200',
  assignment: 'bg-orange-100 text-orange-700 border-orange-200',
  exam: 'bg-red-100 text-red-700 border-red-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200'
};

export const Schedule: React.FC<ScheduleProps> = ({
  scheduleItems,
  onAddItem,
  onUpdateItem,
  onDeleteItem
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
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

  const handleSubmit = (e: React.FormEvent) => {
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

    const scheduleItem: ScheduleItem = {
      id: editingItem?.id || `schedule_${Date.now()}`,
      title: formData.title,
      subject: formData.subject,
      type: formData.type,
      startTime: startDateTime,
      endTime: endDateTime,
      location: formData.location,
      description: formData.description,
      color: getColorForType(formData.type)
    };

    if (editingItem) {
      onUpdateItem(scheduleItem);
      toast.success('Schedule item updated');
    } else {
      onAddItem(scheduleItem);
      toast.success('Schedule item added');
    }

    resetForm();
  };

  const handleEdit = (item: ScheduleItem) => {
    const date = item.startTime.toISOString().split('T')[0];
    const startTime = item.startTime.toTimeString().slice(0, 5);
    const endTime = item.endTime.toTimeString().slice(0, 5);

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

  const today = new Date();
  const upcomingItems = scheduleItems
    .filter(item => item.startTime >= today)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Schedule & Timetable</h2>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingItem ? 'Edit' : 'Add'} Schedule Item</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="Title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                />
                <Input
                  placeholder="Subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select value={formData.type} onValueChange={(value: ScheduleItem['type']) => setFormData({...formData, type: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">Class</SelectItem>
                    <SelectItem value="study">Study Session</SelectItem>
                    <SelectItem value="assignment">Assignment</SelectItem>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                />
                <Input
                  placeholder="Location"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                  required
                />
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                  required
                />
              </div>

              <Textarea
                placeholder="Description (optional)"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />

              <div className="flex gap-2">
                <Button type="submit">
                  {editingItem ? 'Update' : 'Add'} Item
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {upcomingItems.map((item) => (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{item.title}</h3>
                    <Badge className={typeColors[item.type]}>
                      {item.type}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    {item.subject && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Subject:</span>
                        <span>{item.subject}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{item.startTime.toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(item.startTime)} - {formatTime(item.endTime)}</span>
                    </div>
                    
                    {item.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>{item.location}</span>
                      </div>
                    )}
                    
                    {item.description && (
                      <p className="text-gray-500 mt-2">{item.description}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      onDeleteItem(item.id);
                      toast.success('Schedule item deleted');
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {upcomingItems.length === 0 && (
        <Card className="text-center py-8">
          <CardContent>
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-500 mb-2">No upcoming items</h3>
            <p className="text-gray-400">Add your first schedule item to start organizing your time</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
