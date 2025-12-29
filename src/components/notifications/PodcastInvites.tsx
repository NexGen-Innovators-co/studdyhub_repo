// PodcastInvites.tsx - View and respond to podcast invitations
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import {
  Check,
  X,
  Radio,
  Clock,
  Loader2,
  Inbox
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Invite {
  id: string;
  podcast_id: string;
  inviter_id: string;
  role: 'co-host' | 'listener';
  message?: string;
  created_at: string;
  expires_at: string;
  podcast?: {
    title: string;
    description?: string;
  };
  inviter?: {
    full_name: string;
    avatar_url?: string;
  };
}

export const PodcastInvites: React.FC = () => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);

  useEffect(() => {
    loadInvites();

    // Set up real-time subscription for new invites
    const channel = supabase
      .channel('podcast-invites')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'podcast_invites'
        },
        () => {
          loadInvites();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const loadInvites = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('podcast_invites')
        .select(`
          *,
          podcast:podcast_id (
            title,
            description
          ),
          inviter:inviter_id (
            full_name:raw_user_meta_data->full_name,
            avatar_url:raw_user_meta_data->avatar_url
          )
        `)
        .eq('invitee_id', user.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvites(data || []);
    } catch (error) {
      console.error('Error loading invites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (invite: Invite) => {
    setProcessingInvite(invite.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update invite status
      const { error: updateError } = await supabase
        .from('podcast_invites')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString()
        })
        .eq('id', invite.id);

      if (updateError) throw updateError;

      // Add user as member
      const { error: memberError } = await supabase
        .from('podcast_members')
        .insert({
          podcast_id: invite.podcast_id,
          user_id: user.id,
          role: invite.role,
          invited_by: invite.inviter_id
        });

      if (memberError) throw memberError;

      toast.success(`You're now a ${invite.role} of "${invite.podcast?.title}"!`);
      loadInvites();
    } catch (error: any) {
      console.error('Error accepting invite:', error);
      toast.error('Failed to accept invite: ' + error.message);
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleDeclineInvite = async (invite: Invite) => {
    setProcessingInvite(invite.id);
    try {
      const { error } = await supabase
        .from('podcast_invites')
        .update({
          status: 'declined',
          responded_at: new Date().toISOString()
        })
        .eq('id', invite.id);

      if (error) throw error;

      toast.success('Invite declined');
      loadInvites();
    } catch (error: any) {
      console.error('Error declining invite:', error);
      toast.error('Failed to decline invite');
    } finally {
      setProcessingInvite(null);
    }
  };

  const getRoleColor = (role: string) => {
    return role === 'co-host'
      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </CardContent>
      </Card>
    );
  }

  if (invites.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Radio className="h-5 w-5 text-purple-600" />
            Podcast Invitations
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Inbox className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No pending invitations</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-purple-600" />
            Podcast Invitations
          </span>
          <Badge variant="secondary">{invites.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-4">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="p-4 border rounded-lg space-y-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
              >
                {/* Inviter Info */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={invite.inviter?.avatar_url} />
                    <AvatarFallback className="bg-purple-100 text-purple-700">
                      {invite.inviter?.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {invite.inviter?.full_name || 'Unknown User'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Invited you {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge className={getRoleColor(invite.role)}>
                    {invite.role}
                  </Badge>
                </div>

                {/* Podcast Info */}
                <div className="pl-13">
                  <h4 className="font-semibold text-sm mb-1">
                    {invite.podcast?.title || 'Untitled Podcast'}
                  </h4>
                  {invite.podcast?.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {invite.podcast.description}
                    </p>
                  )}
                  {invite.message && (
                    <p className="text-sm mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded italic">
                      "{invite.message}"
                    </p>
                  )}
                </div>

                {/* Expiry Info */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground pl-13">
                  <Clock className="h-3 w-3" />
                  Expires {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pl-13">
                  <Button
                    size="sm"
                    onClick={() => handleAcceptInvite(invite)}
                    disabled={processingInvite === invite.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {processingInvite === invite.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeclineInvite(invite)}
                    disabled={processingInvite === invite.id}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
