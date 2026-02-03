// Hook for calendar integration
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { calendarIntegrationService } from '@/services/calendarIntegrationService';
import type { CalendarIntegration, ScheduleItem } from '@/types';
import { toast } from 'sonner';

export function useCalendarIntegration() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Fetch user's calendar integrations
  const fetchIntegrations = useCallback(async () => {
    if (!user) return;

    try {
      const data = await calendarIntegrationService.getIntegrations(user.id);
      setIntegrations(data);
    } catch (error) {
      //console.error('Error fetching calendar integrations:', error);
      toast.error('Failed to load calendar integrations');
    }
  }, [user]);

  // Connect to Google Calendar (redirect flow)
  const connectGoogle = useCallback(async () => {
    if (!user) return;
    try {
      const authUrl = await calendarIntegrationService.connectGoogleCalendar(user.id);
      window.location.href = authUrl;
    } catch (error) {
      // console.error('Error connecting to Google Calendar:', error);
      toast.error('Failed to connect to Google Calendar');
    }
  }, [user]);

  // Connect to Outlook Calendar (redirect flow)
  const connectOutlook = useCallback(async () => {
    if (!user) return;
    try {
      const authUrl = await calendarIntegrationService.connectOutlookCalendar(user.id);
      window.location.href = authUrl;
    } catch (error) {
      //console.error('Error connecting to Outlook Calendar:', error);
      toast.error('Failed to connect to Outlook Calendar');
    }
  }, [user]);

  // Disconnect calendar
  const disconnect = useCallback(async (integrationId: string) => {
    try {
      const success = await calendarIntegrationService.disconnectCalendar(integrationId);

      if (success) {
        setIntegrations(prev =>
          prev.map(i => i.id === integrationId ? { ...i, sync_enabled: false } : i)
        );
        toast.success('Calendar disconnected');
      }
    } catch (error) {
      //console.error('Error disconnecting calendar:', error);
      toast.error('Failed to disconnect calendar');
    }
  }, []);

  // Sync single schedule item
  const syncItem = useCallback(async (scheduleItem: ScheduleItem) => {
    if (!user) return false;

    try {
      const result = await calendarIntegrationService.syncToCalendar(
        scheduleItem,
        user.id
      );

      if (result.success) {
        toast.success('Event synced to calendar');
        return true;
      } else {
        toast.warning('No active calendar integrations');
        return false;
      }
    } catch (error) {
      //console.error('Error syncing to calendar:', error);
      toast.error('Failed to sync to calendar');
      return false;
    }
  }, [user]);

  // Sync all schedule items
  const syncAllItems = useCallback(async (scheduleItems: ScheduleItem[]) => {
    if (!user) return;

    setSyncing(true);
    try {
      const syncedCount = await calendarIntegrationService.syncAllScheduleItems(
        scheduleItems,
        user.id
      );

      toast.success(`Synced ${syncedCount} of ${scheduleItems.length} events`);
      await fetchIntegrations(); // Refresh to update last_synced_at
    } catch (error) {
      //console.error('Error syncing schedule:', error);
      toast.error('Failed to sync schedule');
    } finally {
      setSyncing(false);
    }
  }, [user, fetchIntegrations]);

  // Check if any calendar is connected
  const hasActiveIntegration = useCallback(() => {
    return integrations.some(i => i.sync_enabled);
  }, [integrations]);

  // Get integration by provider
  const getIntegration = useCallback((provider: 'google' | 'outlook') => {
    return integrations.find(i => i.provider === provider && i.sync_enabled);
  }, [integrations]);

  // Initialize
  useEffect(() => {
    const initialize = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      await fetchIntegrations();
      setLoading(false);
    };

    initialize();
  }, [user, fetchIntegrations]);

  return {
    integrations,
    loading,
    syncing,
    connectGoogle,
    connectOutlook,
    disconnect,
    syncItem,
    syncAllItems,
    hasActiveIntegration: hasActiveIntegration(),
    getIntegration,
    refresh: fetchIntegrations
  };
}

