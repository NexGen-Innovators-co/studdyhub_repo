// Notification Preferences Settings Component
import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Clock, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { NotificationPreferences } from '@/types/Notification';

export function NotificationPreferencesSettings() {
  const { preferences: currentPreferences, updatePreferences, subscribe, unsubscribe } = useNotifications();
  const { user } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentPreferences) {
      setPreferences(currentPreferences);
    }
  }, [currentPreferences]);

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: value });
  };

  const handleSave = async () => {
    if (!preferences) return;
    
    setSaving(true);
    try {
      await updatePreferences(preferences);
      toast({
        title: 'Preferences saved',
        description: 'Your notification preferences have been updated.',
      });
    } catch (error) {
      toast({
        title: 'Error saving preferences',
        description: 'Failed to update notification preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePush = async () => {
    try {
      await subscribe();
      toast({
        title: 'Push notifications enabled',
        description: 'You will now receive push notifications.',
      });
    } catch (error) {
      toast({
        title: 'Error enabling push notifications',
        description: 'Failed to enable push notifications. Please check your browser permissions.',
        variant: 'destructive',
      });
    }
  };

  const handleDisablePush = async () => {
    try {
      await unsubscribe();
      toast({
        title: 'Push notifications disabled',
        description: 'You will no longer receive push notifications.',
      });
    } catch (error) {
      toast({
        title: 'Error disabling push notifications',
        description: 'Failed to disable push notifications. Please try again.',
        variant: 'destructive',
      });
    }
  };


  if (!preferences) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Notification Preferences</h3>
        <p className="text-sm text-muted-foreground">
          Manage how and when you receive notifications
        </p>
      </div>

      <Separator />

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Push Notifications</CardTitle>
                <CardDescription className="text-xs">
                  Receive notifications on this device
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={preferences.push_notifications}
              onCheckedChange={(checked) => {
                if (checked) {
                  handleEnablePush();
                } else {
                  handleDisablePush();
                }
              }}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Email Notifications</CardTitle>
                <CardDescription className="text-xs">
                  Receive notifications via email
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={preferences.email_notifications}
              onCheckedChange={(checked) => handleToggle('email_notifications', checked)}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notification Types</CardTitle>
          <CardDescription className="text-xs">
            Choose which notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Schedule Reminders</Label>
              <p className="text-xs text-muted-foreground">
                Reminders for upcoming classes and study sessions
              </p>
            </div>
            <Switch
              checked={preferences.schedule_reminders}
              onCheckedChange={(checked) => handleToggle('schedule_reminders', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Quiz Notifications</Label>
              <p className="text-xs text-muted-foreground">
                Alerts for upcoming quizzes and deadlines
              </p>
            </div>
            <Switch
              checked={preferences.quiz_reminders}
              onCheckedChange={(checked) => handleToggle('quiz_reminders', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Social Updates</Label>
              <p className="text-xs text-muted-foreground">
                Likes, comments, and mentions on your posts
              </p>
            </div>
            <Switch
              checked={preferences.social_notifications}
              onCheckedChange={(checked) => handleToggle('social_notifications', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Assignment Reminders</Label>
              <p className="text-xs text-muted-foreground">
                Alerts for upcoming assignments and deadlines
              </p>
            </div>
            <Switch
              checked={preferences.assignment_reminders}
              onCheckedChange={(checked) => handleToggle('assignment_reminders', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <BellOff className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Quiet Hours</CardTitle>
              <CardDescription className="text-xs">
                Mute notifications during specific hours
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enable Quiet Hours</Label>
            <Switch
              checked={preferences.quiet_hours_enabled}
              onCheckedChange={(checked) => handleToggle('quiet_hours_enabled', checked)}
            />
          </div>

          {preferences.quiet_hours_enabled && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Start Time</Label>
                  <Select
                    value={preferences.quiet_hours_start}
                    onValueChange={(value) => setPreferences({ ...preferences, quiet_hours_start: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0');
                        return (
                          <SelectItem key={hour} value={`${hour}:00`}>
                            {hour}:00
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">End Time</Label>
                  <Select
                    value={preferences.quiet_hours_end}
                    onValueChange={(value) => setPreferences({ ...preferences, quiet_hours_end: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0');
                        return (
                          <SelectItem key={hour} value={`${hour}:00`}>
                            {hour}:00
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Default Reminder Time */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Default Reminder Time</CardTitle>
              <CardDescription className="text-xs">
                How long before events to send reminders
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Select
            value={preferences.reminder_time?.toString() || '15'}
            onValueChange={(value) => setPreferences({ ...preferences, reminder_time: parseInt(value) })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 minutes before</SelectItem>
              <SelectItem value="10">10 minutes before</SelectItem>
              <SelectItem value="15">15 minutes before</SelectItem>
              <SelectItem value="30">30 minutes before</SelectItem>
              <SelectItem value="60">1 hour before</SelectItem>
              <SelectItem value="120">2 hours before</SelectItem>
              <SelectItem value="1440">1 day before</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
