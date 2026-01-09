// Calendar Integration Service
import { supabase } from '@/integrations/supabase/client';
import type { ScheduleItem, CalendarIntegration } from '@/types';

interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

class CalendarIntegrationService {
  private readonly GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
  private readonly MICROSOFT_GRAPH_API = 'https://graph.microsoft.com/v1.0';

  /**
   * Initiate Google Calendar OAuth flow
   */
  async connectGoogleCalendar(userId: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('calendar-auth', {
      body: {
        provider: 'google',
        userId
      }
    });

    if (error) throw error;
    return data.authUrl;
  }

  /**
   * Initiate Outlook Calendar OAuth flow
   */
  async connectOutlookCalendar(userId: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('calendar-auth', {
      body: {
        provider: 'outlook',
        userId
      }
    });

    if (error) throw error;
    return data.authUrl;
  }

  /**
   * Handle OAuth callback and save tokens
   */
  async handleOAuthCallback(
    provider: 'google' | 'outlook',
    code: string,
    userId: string
  ): Promise<CalendarIntegration> {
    const { data, error } = await supabase.functions.invoke('calendar-callback', {
      body: {
        provider,
        code,
        userId
      }
    });

    if (error) throw error;
    return data;
  }

  /**
   * Get user's calendar integrations
   */
  async getIntegrations(userId: string): Promise<CalendarIntegration[]> {
    const { data, error } = await supabase
      .from('calendar_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('sync_enabled', true);

    if (error) throw error;
    return data || [];
  }

  /**
   * Sync schedule item to calendar
   */
  async syncToCalendar(
    scheduleItem: ScheduleItem,
    userId: string
  ): Promise<{ success: boolean; eventIds: Record<string, string> }> {
    const integrations = await this.getIntegrations(userId);
    const eventIds: Record<string, string> = {};

    for (const integration of integrations) {
      try {
        const event = this.convertToCalendarEvent(scheduleItem);
        
        if (integration.provider === 'google') {
          const eventId = await this.createGoogleCalendarEvent(
            integration,
            event
          );
          eventIds.google = eventId;
        } else if (integration.provider === 'outlook') {
          const eventId = await this.createOutlookCalendarEvent(
            integration,
            event
          );
          eventIds.outlook = eventId;
        }
      } catch (error) {
        console.error(`Failed to sync to ${integration.provider}:`, error);
      }
    }

    // Persist the calendar event IDs to the database immediately
    if (Object.keys(eventIds).length > 0 && scheduleItem.id) {
      await supabase
        .from('schedule_items')
        .update({
          calendar_event_id: JSON.stringify(eventIds)
        })
        .eq('id', scheduleItem.id);
    }

    return {
      success: Object.keys(eventIds).length > 0,
      eventIds
    };
  }

  /**
   * Update calendar event
   */
  async updateCalendarEvent(
    scheduleItem: ScheduleItem,
    eventId: string,
    provider: 'google' | 'outlook',
    integration: CalendarIntegration
  ): Promise<boolean> {
    try {
      const event = this.convertToCalendarEvent(scheduleItem);
      
      if (provider === 'google') {
        await this.updateGoogleCalendarEvent(integration, eventId, event);
      } else if (provider === 'outlook') {
        await this.updateOutlookCalendarEvent(integration, eventId, event);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to update ${provider} calendar event:`, error);
      return false;
    }
  }

  /**
   * Delete calendar event
   */
  async deleteCalendarEvent(
    eventId: string,
    provider: 'google' | 'outlook',
    integration: CalendarIntegration
  ): Promise<boolean> {
    try {
      if (provider === 'google') {
        await this.deleteGoogleCalendarEvent(integration, eventId);
      } else if (provider === 'outlook') {
        await this.deleteOutlookCalendarEvent(integration, eventId);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to delete ${provider} calendar event:`, error);
      return false;
    }
  }

  /**
   * Sync all schedule items
   */
  async syncAllScheduleItems(
    scheduleItems: ScheduleItem[],
    userId: string
  ): Promise<number> {
    let syncedCount = 0;

    for (const item of scheduleItems) {
      try {
        const result = await this.syncToCalendar(item, userId);
        if (result.success) {
          syncedCount++;
          
          // Update schedule item with calendar event IDs
          await supabase
            .from('schedule_items')
            .update({
              calendar_event_id: JSON.stringify(result.eventIds)
            })
            .eq('id', item.id);
        }
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
      }
    }

    // Update last synced timestamp
    await supabase
      .from('calendar_integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', userId);

    return syncedCount;
  }

  /**
   * Disconnect calendar integration
   */
  async disconnectCalendar(integrationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('calendar_integrations')
        .update({ sync_enabled: false })
        .eq('id', integrationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to disconnect calendar:', error);
      return false;
    }
  }

  /**
   * Convert ScheduleItem to CalendarEvent format
   */
  private convertToCalendarEvent(item: ScheduleItem): CalendarEvent {
    const startDateTime = new Date(item.startTime);
    const endDateTime = new Date(item.endTime);

    return {
      summary: item.title,
      description: `${item.subject}\n\n${item.description || ''}`,
      location: item.location,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 30 }
        ]
      }
    };
  }

  /**
   * Create Google Calendar event
   */
  private async createGoogleCalendarEvent(
    integration: CalendarIntegration,
    event: CalendarEvent
  ): Promise<string> {
    const response = await fetch(
      `${this.GOOGLE_CALENDAR_API}/calendars/${integration.calendar_id || 'primary'}/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      }
    );

    if (!response.ok) {
      // Try refreshing token if unauthorized
      if (response.status === 401) {
        await this.refreshGoogleToken(integration);
        return this.createGoogleCalendarEvent(integration, event);
      }
      throw new Error('Failed to create Google Calendar event');
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Update Google Calendar event
   */
  private async updateGoogleCalendarEvent(
    integration: CalendarIntegration,
    eventId: string,
    event: CalendarEvent
  ): Promise<void> {
    const response = await fetch(
      `${this.GOOGLE_CALENDAR_API}/calendars/${integration.calendar_id || 'primary'}/events/${eventId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        await this.refreshGoogleToken(integration);
        return this.updateGoogleCalendarEvent(integration, eventId, event);
      }
      throw new Error('Failed to update Google Calendar event');
    }
  }

  /**
   * Delete Google Calendar event
   */
  private async deleteGoogleCalendarEvent(
    integration: CalendarIntegration,
    eventId: string
  ): Promise<void> {
    const response = await fetch(
      `${this.GOOGLE_CALENDAR_API}/calendars/${integration.calendar_id || 'primary'}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`
        }
      }
    );

    if (!response.ok && response.status !== 404) {
      if (response.status === 401) {
        await this.refreshGoogleToken(integration);
        return this.deleteGoogleCalendarEvent(integration, eventId);
      }
      throw new Error('Failed to delete Google Calendar event');
    }
  }

  /**
   * Create Outlook Calendar event
   */
  private async createOutlookCalendarEvent(
    integration: CalendarIntegration,
    event: CalendarEvent
  ): Promise<string> {
    const outlookEvent = {
      subject: event.summary,
      body: {
        contentType: 'Text',
        content: event.description
      },
      start: {
        dateTime: event.start.dateTime,
        timeZone: event.start.timeZone
      },
      end: {
        dateTime: event.end.dateTime,
        timeZone: event.end.timeZone
      },
      location: {
        displayName: event.location
      }
    };

    const response = await fetch(
      `${this.MICROSOFT_GRAPH_API}/me/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(outlookEvent)
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        await this.refreshOutlookToken(integration);
        return this.createOutlookCalendarEvent(integration, event);
      }
      throw new Error('Failed to create Outlook Calendar event');
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Update Outlook Calendar event
   */
  private async updateOutlookCalendarEvent(
    integration: CalendarIntegration,
    eventId: string,
    event: CalendarEvent
  ): Promise<void> {
    const outlookEvent = {
      subject: event.summary,
      body: {
        contentType: 'Text',
        content: event.description
      },
      start: {
        dateTime: event.start.dateTime,
        timeZone: event.start.timeZone
      },
      end: {
        dateTime: event.end.dateTime,
        timeZone: event.end.timeZone
      },
      location: {
        displayName: event.location
      }
    };

    const response = await fetch(
      `${this.MICROSOFT_GRAPH_API}/me/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(outlookEvent)
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        await this.refreshOutlookToken(integration);
        return this.updateOutlookCalendarEvent(integration, eventId, event);
      }
      throw new Error('Failed to update Outlook Calendar event');
    }
  }

  /**
   * Delete Outlook Calendar event
   */
  private async deleteOutlookCalendarEvent(
    integration: CalendarIntegration,
    eventId: string
  ): Promise<void> {
    const response = await fetch(
      `${this.MICROSOFT_GRAPH_API}/me/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`
        }
      }
    );

    if (!response.ok && response.status !== 404) {
      if (response.status === 401) {
        await this.refreshOutlookToken(integration);
        return this.deleteOutlookCalendarEvent(integration, eventId);
      }
      throw new Error('Failed to delete Outlook Calendar event');
    }
  }

  /**
   * Refresh Google access token
   */
  private async refreshGoogleToken(integration: CalendarIntegration): Promise<void> {
    const { data, error } = await supabase.functions.invoke('refresh-calendar-token', {
      body: {
        provider: 'google',
        refreshToken: integration.refresh_token,
        integrationId: integration.id
      }
    });

    if (error) throw error;
    
    // Update local integration object
    integration.access_token = data.accessToken;
  }

  /**
   * Refresh Outlook access token
   */
  private async refreshOutlookToken(integration: CalendarIntegration): Promise<void> {
    const { data, error } = await supabase.functions.invoke('refresh-calendar-token', {
      body: {
        provider: 'outlook',
        refreshToken: integration.refresh_token,
        integrationId: integration.id
      }
    });

    if (error) throw error;
    
    // Update local integration object
    integration.access_token = data.accessToken;
  }
}

export const calendarIntegrationService = new CalendarIntegrationService();
