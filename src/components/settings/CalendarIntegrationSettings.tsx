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

  // Hardcoded flag to control verification state UI
  const isVerificationPending = true;

  if (isVerificationPending) {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium">Calendar Integration</h3>
            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
              Coming Soon
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Connect your calendar to automatically sync study schedules
          </p>
        </div>

        <Separator />

        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30">
          <Lock className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          <AlertTitle className="text-amber-800 dark:text-amber-500">Integration Pending Verification</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400 mt-2">
            We are currently in the process of verifying our application with Google and Microsoft to ensure the security of your data. 
            Calendar synchronization features will be available soon once this verification is complete.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 opacity-75 pointer-events-none grayscale-[0.5]">
           {/* Google Calendar (Disabled View) */}
           <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-gray-500">Google Calendar</CardTitle>
                    <CardDescription className="text-xs">
                      Sync events to your Google Calendar
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-gray-400 border-gray-200">Coming Soon</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button disabled variant="outline" size="sm" className="gap-2 w-full sm:w-auto">
                <ExternalLink className="h-4 w-4" />
                Connect Google Calendar
              </Button>
            </CardContent>
          </Card>

          {/* Outlook Calendar (Disabled View) */}
           <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-gray-500">Outlook Calendar</CardTitle>
                    <CardDescription className="text-xs">
                      Sync events to your Outlook Calendar
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-gray-400 border-gray-200">Coming Soon</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button disabled variant="outline" size="sm" className="gap-2 w-full sm:w-auto">
                <ExternalLink className="h-4 w-4" />
                Connect Outlook Calendar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
          <Card>
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
                
                {googleIntegration?.sync_enabled ? (
                  <Badge variant="default" className="gap-1">
                    <Check className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline">Not Connected</Badge>
                )}
              </div>
            </CardHeader>
            
            <CardContent>
              {googleIntegration?.sync_enabled ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last synced:</span>
                    <span>
                      {googleIntegration.last_synced_at
                        ? formatDistanceToNow(new Date(googleIntegration.last_synced_at), { addSuffix: true })
                        : 'Never'}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnect(googleIntegration.id)}
                      className="gap-2"
                    >
                      <Unlink className="h-4 w-4" />
                      Disconnect
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refresh}
                      disabled={syncing}
                      className="gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={connectGoogle}
                  className="gap-2"
                  size="sm"
                >
                  <ExternalLink className="h-4 w-4" />
                  Connect Google Calendar
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Outlook Calendar */}
          <Card>
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
                
                {outlookIntegration?.sync_enabled ? (
                  <Badge variant="default" className="gap-1">
                    <Check className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline">Not Connected</Badge>
                )}
              </div>
            </CardHeader>
            
            <CardContent>
              {outlookIntegration?.sync_enabled ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last synced:</span>
                    <span>
                      {outlookIntegration.last_synced_at
                        ? formatDistanceToNow(new Date(outlookIntegration.last_synced_at), { addSuffix: true })
                        : 'Never'}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnect(outlookIntegration.id)}
                      className="gap-2"
                    >
                      <Unlink className="h-4 w-4" />
                      Disconnect
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refresh}
                      disabled={syncing}
                      className="gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={connectOutlook}
                  className="gap-2"
                  size="sm"
                >
                  <ExternalLink className="h-4 w-4" />
                  Connect Outlook Calendar
                </Button>
              )}
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
