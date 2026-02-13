// Calendar Integration Settings Component
import React from 'react';
import { Calendar, Check, ExternalLink, Loader2, RefreshCw, Unlink, Lock } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { useCalendarIntegration } from '@/hooks/useCalendarIntegration';
import { formatDistanceToNow } from 'date-fns';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';

export function CalendarIntegrationSettings() {
  const {
    integrations,
    loading,
    syncing,
    connectGoogle,
    connectOutlook,
    disconnect,
    hasActiveIntegration,
    refresh
  } = useCalendarIntegration();

  const googleIntegration = integrations.find(i => i.provider === 'google');
  const outlookIntegration = integrations.find(i => i.provider === 'outlook');



  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Calendar Integration</h3>
        <p className="text-sm text-muted-foreground">
          Connect your calendar to automatically sync study schedules
        </p>
      </div>

      <Separator />

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Google Calendar */}
          <Card className="opacity-75 relative overflow-hidden">
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium">
                Coming Soon
              </Badge>
            </div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Google Calendar</CardTitle>
                    <CardDescription className="text-xs">
                      Sync events to your Google Calendar
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline">Not Connected</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button disabled className="gap-2 w-full sm:w-auto" size="sm">
                <ExternalLink className="h-4 w-4" />
                Connect Google Calendar
              </Button>
            </CardContent>
          </Card>

          {/* Outlook Calendar */}
          <Card className="opacity-75 relative overflow-hidden">
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium">
                Coming Soon
              </Badge>
            </div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Outlook Calendar</CardTitle>
                    <CardDescription className="text-xs">
                      Sync events to your Outlook Calendar
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline">Not Connected</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button disabled className="gap-2 w-full sm:w-auto" size="sm">
                <ExternalLink className="h-4 w-4" />
                Connect Outlook Calendar
              </Button>
            </CardContent>
          </Card>

          {/* Info Card */}
          {!hasActiveIntegration && (
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <Calendar className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Sync your study schedule
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Connect a calendar to automatically sync your study sessions, assignments, and exams.
                      You'll receive reminders on all your devices!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
