import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import { Users, Lock, Globe, ArrowRight, Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFeatureAccess } from '../../../hooks/useFeatureAccess';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { toast } from 'sonner';

// Assuming these types are available in the wider application context
// For a standalone file, we define minimal types here:
interface Group {
  id: string;
  name: string;
  description: string;
  privacy: 'public' | 'private';
  members_count: number;
  is_member: boolean;
  avatar_url?: string;
}

interface User {
  id: string;
  display_name: string;
}

interface CreateGroupData {
  name: string;
  description: string;
  privacy: 'public' | 'private';
}

interface GroupsSectionProps {
  groups: Group[];
  isLoading: boolean;
  onJoinGroup: (groupId: string, privacy: 'public' | 'private') => Promise<any>;
  onLeaveGroup: (groupId: string) => Promise<any>;
  onCreateGroup: (data: CreateGroupData) => Promise<Group | null>;
  currentUser: User | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

// --- Nested Create Group Dialog Component ---

const CreateGroupFormDialog: React.FC<{
  onCreate: (data: CreateGroupData) => Promise<Group | null>;
  onClose: () => void;
  canCreateGroups: boolean;
}> = ({ onCreate, onClose, canCreateGroups }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { canCreateGroups: canCreateGroupsFn } = useFeatureAccess();
  const isLocked = !canCreateGroupsFn();

  const handleSubmit = useCallback(async () => {
    if (isLocked) {
      setError('Group creation is only available with Scholar and Genius plans.');
      return;
    }
    if (!name.trim() || !description.trim()) {
      setError('Group name and description are required.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const newGroup = await onCreate({ name, description, privacy });
      if (newGroup) {
        setError('');
        onClose();
      } else {
        setError('Failed to create group. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during creation.');
    } finally {
      setIsSubmitting(false);
    }
  }, [name, description, privacy, onCreate, onClose, isLocked]);

  if (isLocked) {
    return (
      <DialogContent className="sm:max-w-[425px] rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-blue-600">
            <Plus className="h-5 w-5 mr-2 inline" /> Start a New Community
          </DialogTitle>
        </DialogHeader>
        <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950">
          <Lock className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 dark:text-orange-200 ml-2">
            Group creation is only available with Scholar and Genius plans.
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button
            onClick={() => navigate('/subscription')}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6"
          >
            Upgrade to Scholar
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="sm:max-w-[425px] rounded-xl">
      <DialogHeader>
        <DialogTitle className="text-2xl font-bold text-blue-600">
          <Plus className="h-5 w-5 mr-2 inline" /> Start a New Community
        </DialogTitle>
        <DialogDescription>
          Create a space for people with shared interests. Choose a name, description, and privacy setting.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        {/* Group Name */}
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">Group Name</label>
          <Input
            id="name"
            placeholder="e.g., The Study Squad, History Buffs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            className="rounded-lg"
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label htmlFor="description" className="text-sm font-medium">Description</label>
          <Textarea
            id="description"
            placeholder="What is this group about? (Max 250 characters)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={250}
            disabled={isSubmitting}
            rows={3}
            className="rounded-lg resize-none"
          />
        </div>

        {/* Privacy */}
        <div className="space-y-1">
          <label htmlFor="privacy" className="text-sm font-medium">Privacy Setting</label>
          <Select
            value={privacy}
            onValueChange={(value: 'public' | 'private') => setPrivacy(value)}
            disabled={isSubmitting}
          >
            <SelectTrigger id="privacy" className="rounded-lg">
              <SelectValue placeholder="Select privacy" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="public">
                <div className="flex items-center">
                  <Globe className="h-4 w-4 mr-2 text-green-500" /> Public (Anyone can join)
                </div>
              </SelectItem>
              <SelectItem value="private">
                <div className="flex items-center">
                  <Lock className="h-4 w-4 mr-2 text-red-500" /> Private (Requires admin approval)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Error Message */}
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </div>

      <DialogFooter>
        <Button
          onClick={handleSubmit}
          disabled={isLocked || isSubmitting || !name.trim() || !description.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-md rounded-full px-6 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={isLocked ? 'Upgrade to Scholar or Genius to create groups' : 'Create Group'}
        >
          {isLocked && <Lock className="h-4 w-4 mr-2" />}
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          {isSubmitting ? 'Creating...' : 'Create Group'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

// --- Main Groups Section Component ---

export const GroupsSection: React.FC<GroupsSectionProps> = ({
  groups,
  isLoading,
  onJoinGroup,
  onLeaveGroup,
  onCreateGroup, // Used by the dialog
  currentUser,
  hasMore,
  onLoadMore,
  isLoadingMore,
}) => {
  const navigate = useNavigate();
  const { canCreateGroups, canAccessSocial, isFree } = useFeatureAccess();
  const canJoinGroups = canAccessSocial();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Listen for custom event to trigger create group dialog
  useEffect(() => {
    const handleTriggerCreateGroup = () => {
      setIsCreateDialogOpen(true);
    };

    window.addEventListener('triggerCreateGroup', handleTriggerCreateGroup);
    return () => window.removeEventListener('triggerCreateGroup', handleTriggerCreateGroup);
  }, []);

  useEffect(() => {
    if (!loadMoreRef.current || !onLoadMore || !hasMore || isLoadingMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) onLoadMore();
    });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, isLoadingMore]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header Action */}
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-2xl text-white shadow-lg">
        <div>
          <h2 className="text-2xl font-bold mb-1">Discover Communities</h2>
          <p className="text-blue-100">Find people with similar interests</p>
        </div>
        {currentUser && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  if (!canCreateGroups()) {
                    toast.error('Group creation is available for Scholar and Genius plans');
                    return;
                  }
                  setIsCreateDialogOpen(true);
                }}
                className="bg-white text-blue-600 hover:bg-blue-50 border-none shadow-none rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canCreateGroups()}
                title={!canCreateGroups() ? 'Upgrade to Scholar or Genius to create groups' : 'Create a new group'}
              >
                {!canCreateGroups() && <Lock className="h-4 w-4 mr-2" />}
                <Plus className={canCreateGroups() ? 'mr-2 h-4 w-4' : ''} /> Create Group
              </Button>
            </DialogTrigger>
            <CreateGroupFormDialog
              onCreate={onCreateGroup}
              onClose={() => setIsCreateDialogOpen(false)}
              canCreateGroups={canCreateGroups()}
            />
          </Dialog>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-slate-500">Loading communities...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && groups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mb-6">
            <Users className="w-10 h-10 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">No Communities Yet</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md leading-relaxed">
            Communities bring people together around shared interests. Create the first group to start building your learning network!
          </p>
          {currentUser && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    if (!canCreateGroups) {
                      navigate('/subscription');
                    } else {
                      setIsCreateDialogOpen(true);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create First Community
                </Button>
              </DialogTrigger>
              <CreateGroupFormDialog
                onCreate={onCreateGroup}
                onClose={() => setIsCreateDialogOpen(false)}
                canCreateGroups={canCreateGroups()}
              />
            </Dialog>
          )}
        </div>
      )}

      {/* Grid */}
      {!isLoading && groups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {groups.map((group: Group) => (
            <Card
              key={group.id}
              onClick={() => group.is_member && navigate(`/social/group/${group.id}`)}
              className={`group relative overflow-hidden border-none shadow-sm hover:shadow-lg transition-all duration-300 bg-white dark:bg-slate-900 rounded-2xl flex flex-col h-full ${group.is_member ? 'cursor-pointer' : ''}`}
            >
              <div className="h-20 bg-slate-100 dark:bg-slate-800 relative">
                {/* Decorative pattern or gradient could go here */}
                <div className="absolute top-4 right-4">
                  <Badge variant="secondary" className="bg-white/90 dark:bg-black/50 backdrop-blur-sm shadow-sm">
                    {group.privacy === 'public' ? <Globe className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                    {group.privacy}
                  </Badge>
                </div>
              </div>

              <CardContent className="pt-0 px-5 pb-5 flex-1 flex flex-col">
                <div className="-mt-10 mb-3">
                  <Avatar className="h-20 w-20 border-4 border-white dark:border-slate-900 shadow-sm rounded-2xl">
                    <AvatarImage src={group.avatar_url} />
                    <AvatarFallback className="rounded-2xl text-xl bg-blue-100 text-blue-600">{group.name[0]}</AvatarFallback>
                  </Avatar>
                </div>

                <div className="mb-4">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 transition-colors">
                    {group.name}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                    {group.description}
                  </p>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                    <Users className="h-3.5 w-3.5 mr-1.5" />
                    {group.members_count} Members
                  </div>

                  {group.is_member ? (
                    <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-0 h-auto font-semibold">
                      View <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canJoinGroups) {
                          toast.error('Joining groups is available for Scholar and Genius plans');
                          return;
                        }
                        onJoinGroup(group.id, group.privacy);
                      }}
                      className="rounded-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white hover:opacity-90 h-8 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!canJoinGroups}
                      title={!canJoinGroups ? 'Upgrade to Scholar or Genius to join groups' : 'Join this group'}
                    >
                      {!canJoinGroups && <Lock className="h-4 w-4 mr-2" />}
                      Join
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Infinite scroll trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="py-8 flex justify-center">
          {isLoadingMore ? (
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          ) : (
            <Button
              variant="outline"
              onClick={onLoadMore}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700"
            >
              Load More Groups
            </Button>
          )}
        </div>
      )}
    </div>
  );
};