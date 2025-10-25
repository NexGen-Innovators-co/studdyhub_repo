import React, { useState, useEffect } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Switch } from '../../ui/switch';
import {
  Calendar,
  MapPin,
  Users as UsersIcon,
  Clock,
  Plus,
  Video,
  CheckCircle,
  XCircle,
  HelpCircle,
  Loader2,
  Edit,
  Trash2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { toast } from 'sonner';

interface Event {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  is_online: boolean;
  max_attendees: number | null;
  organizer_id: string;
  organizer: any;
  attendees_count?: number;
  user_attendance_status?: 'attending' | 'maybe' | 'declined' | null;
}

interface GroupEventsProps {
  groupId: string;
  currentUser: any;
  canManage?: boolean;
}

export const GroupEvents: React.FC<GroupEventsProps> = ({
  groupId,
  currentUser,
  canManage = false
}) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    location: '',
    is_online: false,
    max_attendees: '',
    meeting_link: ''
  });

  useEffect(() => {
    fetchEvents();
  }, [groupId]);

  const fetchEvents = async () => {
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('social_events')
        .select(`
          *,
          organizer:social_users!social_events_organizer_id_fkey(*)
        `)
        .eq('group_id', groupId)
        .order('start_date', { ascending: true });

      if (eventsError) throw eventsError;

      // Get attendee counts and user's attendance status
      const eventsWithDetails = await Promise.all(
        (eventsData || []).map(async (event) => {
          const { count } = await supabase
            .from('social_event_attendees')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id)
            .eq('status', 'attending');

          const { data: userAttendance } = await supabase
            .from('social_event_attendees')
            .select('status')
            .eq('event_id', event.id)
            .eq('user_id', currentUser.id)
            .single();

          return {
            ...event,
            attendees_count: count || 0,
            user_attendance_status: userAttendance?.status || null
          };
        })
      );

      setEvents(eventsWithDetails as Event[]);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateEvent = async () => {
    if (!formData.title.trim() || !formData.start_date || !formData.start_time) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const startDateTime = new Date(`${formData.start_date}T${formData.start_time}`);
      const endDateTime = formData.end_date && formData.end_time
        ? new Date(`${formData.end_date}T${formData.end_time}`)
        : new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours

      const { data: eventData, error: eventError } = await supabase
        .from('social_events')
        .insert({
          title: formData.title,
          description: formData.description,
          group_id: groupId,
          organizer_id: currentUser.id,
          start_date: startDateTime.toISOString(),
          end_date: endDateTime.toISOString(),
          location: formData.is_online ? formData.meeting_link : formData.location,
          is_online: formData.is_online,
          max_attendees: formData.max_attendees ? parseInt(formData.max_attendees) : null
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Auto-RSVP organizer
      await supabase.from('social_event_attendees').insert({
        event_id: eventData.id,
        user_id: currentUser.id,
        status: 'attending'
      });

      toast.success('Event created successfully!');
      setShowCreateDialog(false);
      setFormData({
        title: '',
        description: '',
        start_date: '',
        start_time: '',
        end_date: '',
        end_time: '',
        location: '',
        is_online: false,
        max_attendees: '',
        meeting_link: ''
      });
      fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRSVP = async (eventId: string, status: 'attending' | 'maybe' | 'declined') => {
    try {
      // Check if user already has an attendance record
      const { data: existingAttendance } = await supabase
        .from('social_event_attendees')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', currentUser.id)
        .single();

      if (existingAttendance) {
        // Update existing
        await supabase
          .from('social_event_attendees')
          .update({ status })
          .eq('id', existingAttendance.id);
      } else {
        // Create new
        await supabase
          .from('social_event_attendees')
          .insert({
            event_id: eventId,
            user_id: currentUser.id,
            status
          });
      }

      // Update local state
      setEvents(prev => prev.map(event =>
        event.id === eventId
          ? {
            ...event,
            user_attendance_status: status,
            attendees_count: status === 'attending'
              ? (event.user_attendance_status === 'attending' ? event.attendees_count : (event.attendees_count || 0) + 1)
              : (event.user_attendance_status === 'attending' ? (event.attendees_count || 1) - 1 : event.attendees_count)
          }
          : event
      ));

      toast.success(`RSVP updated to ${status}`);
    } catch (error) {
      console.error('Error updating RSVP:', error);
      toast.error('Failed to update RSVP');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;

    try {
      await supabase.from('social_event_attendees').delete().eq('event_id', eventId);
      await supabase.from('social_events').delete().eq('id', eventId);

      setEvents(prev => prev.filter(e => e.id !== eventId));
      toast.success('Event deleted');
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const isEventFull = (event: Event) => {
    return event.max_attendees ? (event.attendees_count || 0) >= event.max_attendees : false;
  };

  const isEventPast = (event: Event) => {
    return new Date(event.end_date) < new Date();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Event Button */}
      {canManage && (
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create New Event
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Group Event</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="e.g., Study Session: Chapter 5"
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="What will you be covering?"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_online"
                  checked={formData.is_online}
                  onCheckedChange={(checked) => handleInputChange('is_online', checked)}
                />
                <Label htmlFor="is_online" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Online Event
                </Label>
              </div>

              {formData.is_online ? (
                <div className="space-y-2">
                  <Label htmlFor="meeting_link">Meeting Link</Label>
                  <Input
                    id="meeting_link"
                    value={formData.meeting_link}
                    onChange={(e) => handleInputChange('meeting_link', e.target.value)}
                    placeholder="https://zoom.us/j/... or Google Meet link"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="e.g., Library Room 204"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => handleInputChange('start_date', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_time">Start Time *</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => handleInputChange('start_time', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => handleInputChange('end_date', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => handleInputChange('end_time', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_attendees">Max Attendees (Optional)</Label>
                <Input
                  id="max_attendees"
                  type="number"
                  min="1"
                  value={formData.max_attendees}
                  onChange={(e) => handleInputChange('max_attendees', e.target.value)}
                  placeholder="Leave empty for unlimited"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateEvent} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Create Event
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Events List */}
      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">No events scheduled</h3>
            <p className="text-gray-500">
              {canManage
                ? 'Create the first event to get started!'
                : 'Check back later for upcoming events.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const isPast = isEventPast(event);
            const isFull = isEventFull(event);
            const isOrganizer = event.organizer_id === currentUser.id;

            return (
              <Card key={event.id} className={`${isPast ? 'opacity-60' : ''}`}>
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-xl font-semibold mb-1">{event.title}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={event.organizer?.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {event.organizer?.display_name?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span>Organized by {event.organizer?.display_name}</span>
                          </div>
                        </div>
                        {isOrganizer && canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEvent(event.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>

                      {event.description && (
                        <p className="text-gray-600 dark:text-gray-400 mb-3">
                          {event.description}
                        </p>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">
                            {formatDateTime(event.start_date)}
                          </span>
                          {isPast && (
                            <Badge variant="secondary" className="ml-2">Past Event</Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          {event.is_online ? (
                            <>
                              <Video className="h-4 w-4 text-green-500" />
                              <span>Online Event</span>
                              {event.location && (
                                <a
                                  href={event.location}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline ml-2"
                                >
                                  Join Meeting
                                </a>
                              )}
                            </>
                          ) : (
                            <>
                              <MapPin className="h-4 w-4 text-red-500" />
                              <span>{event.location || 'Location TBD'}</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <UsersIcon className="h-4 w-4 text-blue-500" />
                          <span>
                            {event.attendees_count || 0} attending
                            {event.max_attendees && ` (${event.max_attendees} max)`}
                          </span>
                          {isFull && (
                            <Badge variant="secondary" className="ml-2">Full</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* RSVP Buttons */}
                    {!isPast && (
                      <div className="flex flex-col gap-2 min-w-[140px]">
                        <Button
                          size="sm"
                          variant={event.user_attendance_status === 'attending' ? 'default' : 'outline'}
                          onClick={() => handleUpdateRSVP(event.id, 'attending')}
                          disabled={isFull && event.user_attendance_status !== 'attending'}
                          className="w-full"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {event.user_attendance_status === 'attending' ? 'Attending' : 'Attend'}
                        </Button>
                        <Button
                          size="sm"
                          variant={event.user_attendance_status === 'maybe' ? 'default' : 'outline'}
                          onClick={() => handleUpdateRSVP(event.id, 'maybe')}
                          className="w-full"
                        >
                          <HelpCircle className="h-4 w-4 mr-1" />
                          Maybe
                        </Button>
                        <Button
                          size="sm"
                          variant={event.user_attendance_status === 'declined' ? 'destructive' : 'outline'}
                          onClick={() => handleUpdateRSVP(event.id, 'declined')}
                          className="w-full"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};