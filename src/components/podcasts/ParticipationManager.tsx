// ParticipationManager.tsx - Fixed version with stable state management
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { 
  Mic, 
  MicOff, 
  UserCheck, 
  UserX, 
  Crown, 
  Volume2, 
  VolumeX,
  Users,
  AlertCircle,
  Clock,
  Check,
  X,
  Loader2,
  Radio,
  MessageSquare,
  MessageSquareOff,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Participant {
  userId: string;
  stream: MediaStream;
  isSpeaking: boolean;
  isMuted: boolean;
  userName?: string;
  userAvatar?: string;
  permissions?: string[];
}

interface PermissionRequest {
  id: string;
  user_id: string;
  podcast_id: string;
  request_type: 'speak' | 'cohost';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  user?: {
    full_name: string;
    avatar_url?: string;
  };
}

interface ParticipationManagerProps {
  podcastId: string;
  currentUserId: string;
  isHost: boolean;
  participants: Participant[];
  permissionRequests?: Array<{userId: string, requestType: string, timestamp: number, id?: string}>;
  grantedPermissions?: string[];
  onGrantPermission: (userId: string, permissionType: string) => void;
  onRevokePermission: (userId: string) => void;
  onMuteParticipant: (userId: string, muted: boolean) => void;
}

export const ParticipationManager: React.FC<ParticipationManagerProps> = ({
  podcastId,
  currentUserId,
  isHost,
  participants,
  permissionRequests = [],
  grantedPermissions = [],
  onGrantPermission,
  onRevokePermission,
  onMuteParticipant
}) => {
  // Debug: log incoming participants prop to help trace no-active-participants issue
  useEffect(() => {
    //console.log('[ParticipationManager] participants prop length:', participants.length, 'ids:', participants.map(p => p.userId));
  }, [participants]);

  const [dbPermissionRequests, setDbPermissionRequests] = useState<PermissionRequest[]>([]);
  const [activeParticipants, setActiveParticipants] = useState<Array<Participant & { userInfo?: any, isGrantedPermission?: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());
  const [revokingUsers, setRevokingUsers] = useState<Set<string>>(new Set());
  
  // Use refs to prevent re-render loops
  const lastToastIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);

  // Combine prop permission requests with database requests - MEMOIZED
  const allPermissionRequests = React.useMemo(() => {
    const combined = [...dbPermissionRequests];
    
    // Add prop requests that aren't already in database
    permissionRequests.forEach(propRequest => {
      if (!combined.some(dbReq => dbReq.user_id === propRequest.userId)) {
        combined.push({
          id: propRequest.id || `temp-${propRequest.userId}-${propRequest.timestamp}`,
          user_id: propRequest.userId,
          podcast_id: podcastId,
          request_type: propRequest.requestType as 'speak' | 'cohost',
          status: 'pending',
          created_at: new Date(propRequest.timestamp).toISOString(),
          user: undefined
        });
      }
    });
    
    return combined;
  }, [dbPermissionRequests, permissionRequests, podcastId]);

  // Load permission requests from database - ONLY on mount and manual refresh
  useEffect(() => {
    if (isHost && isInitialLoadRef.current) {
      loadPermissionRequests();
      isInitialLoadRef.current = false;
    }
  }, [podcastId, isHost]);

  // Enrich participants with user info - DEBOUNCED
  useEffect(() => {
    const timer = setTimeout(() => {
      loadParticipantsInfo();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [participants, grantedPermissions]);

  // Load user info for permission requests - DEBOUNCED
  useEffect(() => {
    const timer = setTimeout(() => {
      loadUserInfoForRequests();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [allPermissionRequests.length]); // Only when count changes

  // In ParticipationManager.tsx, update the loadUserInfoForRequests function:

const loadUserInfoForRequests = async () => {
  if (allPermissionRequests.length === 0) return;
  
  const userIds = allPermissionRequests
    .filter(req => !req.user)
    .map(req => req.user_id)
    .filter((id, index, arr) => arr.indexOf(id) === index);

  if (userIds.length === 0) return;

  try {
    const { data: users, error } = await supabase
      .from('social_users') // Change from profiles to social_users
      .select('id, display_name, avatar_url')
      .in('id', userIds);

    if (error) {
      //console.error('Error fetching users for requests:', error);
      return;
    }

    const usersMap = new Map(
      (users || []).map(u => [u.id, {
        full_name: u.display_name || 'Unknown User',
        avatar_url: u.avatar_url
      }])
    );

    setDbPermissionRequests(prev => prev.map(request => ({
      ...request,
      user: usersMap.get(request.user_id) || request.user
    })));
  } catch (error) {
    //console.error('Error loading user info for requests:', error);
  }
};

// Update the loadParticipantsInfo function:
const loadParticipantsInfo = async () => {
  try {
    if (participants.length === 0) {
      setActiveParticipants([]);
      return;
    }

    const userIds = participants.map(p => p.userId);
    const { data: users, error } = await supabase
      .from('social_users') // Change from profiles to social_users
      .select('id, display_name, avatar_url')
      .in('id', userIds);

    if (error) {
      //console.error('Error fetching participant info:', error);
      return;
    }

    const usersMap = new Map(
      (users || []).map(u => [u.id, {
        full_name: u.display_name || 'Anonymous',
        avatar_url: u.avatar_url
      }])
    );

    const enrichedParticipants = participants.map(participant => ({
      ...participant,
      userName: usersMap.get(participant.userId)?.full_name || participant.userId.substring(0, 8),
      userAvatar: usersMap.get(participant.userId)?.avatar_url,
      isGrantedPermission: grantedPermissions.includes(participant.userId)
    }));

    setActiveParticipants(enrichedParticipants);
  } catch (error) {
    //console.error('Error loading participant info:', error);
  }
};

  const loadPermissionRequests = async () => {
    try {
      setIsLoading(true);
      
      const { data: requests, error } = await supabase
        .from('podcast_participation_requests')
        .select('*')
        .eq('podcast_id', podcastId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDbPermissionRequests(requests as PermissionRequest[] || []);
    } catch (error: any) {
      //console.error('Error loading permission requests:', error);
      // Don't show toast error on load to prevent loops
    } finally {
      setIsLoading(false);
    }
  };

  const refreshRequests = useCallback(() => {
    if (isHost && !isLoading) {
      loadPermissionRequests();
      
      // Only show toast if not shown recently
      const now = Date.now();
      const lastToastTime = lastToastIdRef.current ? parseInt(lastToastIdRef.current) : 0;
      
      if (now - lastToastTime > 2000) {
        lastToastIdRef.current = now.toString();
        toast.info('Refreshing permission requests...', {
          duration: 1000,
          id: `refresh-${now}`
        });
      }
    }
  }, [isHost, isLoading]);

  const handleApproveRequest = useCallback(async (requestId: string, userId: string, requestType: string) => {
    // Prevent multiple clicks
    if (processingRequests.has(requestId)) return;
    
    try {
      setProcessingRequests(prev => new Set(prev).add(requestId));

      //console.log('Approving request:', { requestId, userId, requestType });

      // Only update database if it's not a temporary request
      if (!requestId.startsWith('temp-')) {
        const { error } = await supabase
          .from('podcast_participation_requests')
          .update({ 
            status: 'approved',
            updated_at: new Date().toISOString()
          })
          .eq('id', requestId);

        if (error) throw error;
      }

      // Grant permission via WebRTC
      onGrantPermission(userId, requestType);

      // Remove from local state
      setDbPermissionRequests(prev => prev.filter(req => req.id !== requestId));

      // Show success toast only once
      const toastId = `approve-${userId}-${Date.now()}`;
      toast.success('Permission granted successfully!', {
        description: `User can now ${requestType === 'cohost' ? 'speak and moderate' : 'speak'}`,
        duration: 3000,
        id: toastId,
        icon: '🎤'
      });
    } catch (error: any) {
      //console.error('Error approving request:', error);
      toast.error('Failed to grant permission', {
        id: `error-${requestId}`
      });
    } finally {
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  }, [onGrantPermission, processingRequests]);

  const handleRejectRequest = useCallback(async (requestId: string) => {
    if (processingRequests.has(requestId)) return;
    
    try {
      setProcessingRequests(prev => new Set(prev).add(requestId));

      if (!requestId.startsWith('temp-')) {
        const { error } = await supabase
          .from('podcast_participation_requests')
          .update({ 
            status: 'rejected',
            updated_at: new Date().toISOString()
          })
          .eq('id', requestId);

        if (error) throw error;
      }

      setDbPermissionRequests(prev => prev.filter(req => req.id !== requestId));
      
      toast.info('Request rejected', {
        id: `reject-${requestId}`
      });
    } catch (error: any) {
      //console.error('Error rejecting request:', error);
      toast.error('Failed to reject request', {
        id: `error-reject-${requestId}`
      });
    } finally {
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  }, [processingRequests]);

  const handleMuteToggle = useCallback((userId: string, currentlyMuted: boolean) => {
    if (revokingUsers.has(userId)) return;
    
    onMuteParticipant(userId, !currentlyMuted);
    
    toast.info(`${currentlyMuted ? 'Unmuted' : 'Muted'} participant`, {
      duration: 2000,
      id: `mute-${userId}-${Date.now()}`
    });
  }, [onMuteParticipant, revokingUsers]);

  const handleRevokePermission = useCallback(async (userId: string) => {
    if (revokingUsers.has(userId)) return;
    
    try {
      setRevokingUsers(prev => new Set(prev).add(userId));

      //console.log('Revoking permission from:', userId);
      
      onRevokePermission(userId);
      
      const userRequests = allPermissionRequests.filter(req => req.user_id === userId);
      for (const request of userRequests) {
        if (!request.id.startsWith('temp-')) {
          await supabase
            .from('podcast_participation_requests')
            .update({ 
              status: 'revoked',
              updated_at: new Date().toISOString()
            })
            .eq('id', request.id);
        }
      }
      
      setDbPermissionRequests(prev => prev.filter(req => req.user_id !== userId));
      
      toast.info('Permission revoked', {
        duration: 3000,
        id: `revoke-${userId}-${Date.now()}`
      });
    } catch (error: any) {
      //console.error('Error revoking permission:', error);
      toast.error('Failed to revoke permission', {
        id: `error-revoke-${userId}`
      });
    } finally {
      setRevokingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  }, [onRevokePermission, allPermissionRequests, revokingUsers]);

  const hasGrantedPermission = (userId: string) => {
    return grantedPermissions.includes(userId);
  };

  const handleButtonClick = (e: React.MouseEvent, callback: () => void) => {
    e.stopPropagation();
    e.preventDefault();
    callback();
  };

  return (
    <div className="space-y-6">
      {/* Permission Requests Section */}
      {isHost && (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5" />
              Permission Requests
              {allPermissionRequests.length > 0 && (
                <Badge variant="destructive" className="ml-2 animate-pulse">
                  {allPermissionRequests.length}
                </Badge>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                refreshRequests();
              }}
              disabled={isLoading}
              className="text-gray-400 hover:text-white hover:bg-gray-800/50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="text-gray-400 text-sm">Loading requests...</span>
              </div>
            ) : allPermissionRequests.length > 0 ? (
              <ScrollArea className="h-64">
                <div className="space-y-3 pr-4">
                  {allPermissionRequests.map(request => {
                    const isGranted = grantedPermissions.includes(request.user_id);
                    const isProcessing = processingRequests.has(request.id);
                    
                    return (
                      <div 
                        key={request.id} 
                        className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarImage src={request.user?.avatar_url} />
                            <AvatarFallback className={`${
                              request.request_type === 'cohost' ? 'bg-yellow-600' : 'bg-blue-600'
                            } text-white`}>
                              {request.user?.full_name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">
                              {request.user?.full_name || 'Unknown User'}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge 
                                variant={request.request_type === 'cohost' ? 'default' : 'secondary'}
                                className={`${
                                  request.request_type === 'cohost' 
                                    ? 'bg-yellow-500 hover:bg-yellow-600' 
                                    : 'bg-blue-500 hover:bg-blue-600'
                                } text-white`}
                              >
                                {request.request_type === 'cohost' ? (
                                  <Crown className="h-3 w-3 mr-1" />
                                ) : (
                                  <Mic className="h-3 w-3 mr-1" />
                                )}
                                {request.request_type}
                              </Badge>
                              <span className="text-xs text-gray-400">
                                {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                              </span>
                              {isGranted && (
                                <Badge variant="outline" className="border-blue-500 text-blue-400 text-xs">
                                  <Check className="h-3 w-3 mr-1" />
                                  Granted
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            onClick={(e) => handleButtonClick(e, () => 
                              handleApproveRequest(request.id, request.user_id, request.request_type)
                            )}
                            disabled={isProcessing || isGranted}
                            className={`${
                              isGranted
                                ? 'bg-blue-700 cursor-default'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => handleButtonClick(e, () => handleRejectRequest(request.id))}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <UserCheck className="h-16 w-16 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No pending requests</p>
                <p className="text-xs mt-1 text-gray-600">Users will appear here when they request to speak</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active Participants Section */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Active Participants
            {activeParticipants.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {activeParticipants.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeParticipants.length > 0 ? (
            <ScrollArea className="h-64">
              <div className="space-y-3 pr-4">
                {activeParticipants.map(participant => {
                  const isGranted = hasGrantedPermission(participant.userId);
                  const isHostUser = participant.userId === currentUserId;
                  const isProcessing = revokingUsers.has(participant.userId);
                  
                  return (
                    <div 
                      key={participant.userId} 
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        isHostUser 
                            ? 'bg-blue-900/20 border border-blue-800/30' 
                            : isGranted 
                              ? 'bg-blue-900/10 border border-blue-800/20' 
                              : 'bg-gray-800/50'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarImage src={participant.userAvatar} />
                          <AvatarFallback className={`${
                            isHostUser 
                              ? 'bg-blue-600' 
                              : isGranted 
                                ? 'bg-blue-600' 
                                : 'bg-gray-600'
                          } text-white`}>
                            {participant.userName?.charAt(0) || 'P'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white truncate">
                              {participant.userName}
                              {isHostUser && (
                                <span className="ml-2 text-xs text-blue-300">(You)</span>
                              )}
                            </p>
                            {isGranted && !isHostUser && (
                              <Badge className="bg-blue-600 text-xs">
                                <Mic className="h-3 w-3 mr-1" />
                                Can Speak
                              </Badge>
                            )}
                            {participant.permissions?.includes('cohost') && (
                              <Badge className="bg-yellow-600 text-xs">
                                <Crown className="h-3 w-3 mr-1" />
                                Co-host
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <div className={`h-2 w-2 rounded-full ${participant.isSpeaking ? 'bg-blue-500 animate-pulse' : 'bg-gray-500'}`} />
                            <span className="text-xs text-gray-400">
                              {participant.isSpeaking ? (
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  Speaking
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <MessageSquareOff className="h-3 w-3" />
                                  Silent
                                </span>
                              )}
                            </span>
                            {participant.isMuted && (
                              <Badge variant="outline" className="border-blue-500 text-blue-400 text-xs">
                                <VolumeX className="h-3 w-3 mr-1" />
                                Muted
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant={participant.isMuted ? "default" : "outline"}
                          onClick={(e) => handleButtonClick(e, () => 
                            handleMuteToggle(participant.userId, participant.isMuted)
                          )}
                          className={participant.isMuted ? "bg-blue-600 hover:bg-blue-700" : "border-gray-600"}
                          disabled={isHostUser || isProcessing}
                          title={isHostUser ? "Cannot mute yourself" : participant.isMuted ? "Unmute" : "Mute"}
                        >
                          {participant.isMuted ? (
                            <VolumeX className="h-4 w-4" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </Button>
                        {isHost && !isHostUser && isGranted && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => handleButtonClick(e, () => 
                              handleRevokePermission(participant.userId)
                            )}
                            disabled={isProcessing}
                            title="Revoke speaking permission"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserX className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Users className="h-16 w-16 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No active participants</p>
              <p className="text-xs mt-1 text-gray-600">Participants will appear here when they join</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};