import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Users, UserPlus, RefreshCw, Lock, Globe, PlusCircle, LogOut } from 'lucide-react';
import { SocialGroupWithDetails, SocialUserWithDetails, CreateGroupData } from '../../../integrations/supabase/socialTypes';
import { formatEngagementCount, getTimeAgo } from '../utils/postUtils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { toast } from 'sonner';

interface GroupsSectionProps {
  groups: SocialGroupWithDetails[];
  isLoading: boolean;
  // Updated actions props
  onJoinGroup: (groupId: string, privacy: 'public' | 'private') => Promise<boolean>;
  onLeaveGroup: (groupId: string) => Promise<boolean>;
  onCreateGroup: (data: CreateGroupData) => Promise<SocialGroupWithDetails | null>;
  
  currentUser: SocialUserWithDetails | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

// --- Group Creation Dialog Component ---
const CreateGroupDialog: React.FC<{ onCreate: (data: CreateGroupData) => Promise<any> }> = ({ onCreate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState<CreateGroupData>({ name: '', description: '', privacy: 'public' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSelectChange = (value: string) => {
        setFormData({ ...formData, privacy: value as 'public' | 'private' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.description) {
            toast.error('Group name and description are required.');
            return;
        }

        setIsSubmitting(true);
        const result = await onCreate(formData);
        setIsSubmitting(false);

        if (result) {
            setFormData({ name: '', description: '', privacy: 'public' });
            setIsOpen(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="w-full mb-4 bg-green-600 hover:bg-green-700 text-white dark:bg-green-500 dark:hover:bg-green-600">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create New Study Group
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Study Group</DialogTitle>
                    <DialogDescription>
                        Set up a space for focused discussion and collaboration.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <label htmlFor="name" className="text-sm font-medium">Group Name</label>
                        <Input
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="e.g., Organic Chemistry Study Hub"
                            required
                        />
                    </div>
                    <div className="grid gap-2">
                        <label htmlFor="description" className="text-sm font-medium">Description</label>
                        <Textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="What is this group about?"
                            rows={3}
                            required
                        />
                    </div>
                    <div className="grid gap-2">
                        <label htmlFor="privacy" className="text-sm font-medium">Privacy</label>
                        <Select value={formData.privacy} onValueChange={handleSelectChange}>
                            <SelectTrigger id="privacy" className="w-full">
                                <SelectValue placeholder="Select privacy level" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="public">
                                    <Globe className="h-4 w-4 mr-2 inline" /> Public (Anyone can join)
                                </SelectItem>
                                <SelectItem value="private">
                                    <Lock className="h-4 w-4 mr-2 inline" /> Private (Requires approval/invite)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting || !formData.name || !formData.description}>
                            {isSubmitting ? (
                                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <PlusCircle className="h-4 w-4 mr-2" />
                            )}
                            {isSubmitting ? 'Creating...' : 'Create Group'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
// --- End Group Creation Dialog Component ---


export const GroupsSection: React.FC<GroupsSectionProps> = ({
  groups,
  isLoading,
  onJoinGroup,
  onLeaveGroup,
  onCreateGroup,
  currentUser,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
}) => {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !onLoadMore || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 1.0 }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasMore, onLoadMore, isLoadingMore]);

  const handleJoinLeave = async (group: SocialGroupWithDetails) => {
    if (!currentUser) return toast.error("Please log in to manage group membership.");

    if (group.is_member || group.member_status === 'pending') {
        // User is a member or has a pending request, so they want to leave/cancel
        if (group.member_status === 'pending') {
             // For pending, we still treat it as leaving/cancelling the request
             await onLeaveGroup(group.id); 
        } else {
             await onLeaveGroup(group.id);
        }
    } else {
        // User is not a member, so they want to join
        await onJoinGroup(group.id, group.privacy);
    }
  };


  const getActionButton = (group: SocialGroupWithDetails) => {
    if (!currentUser) {
        return (
            <Button size="sm" variant="outline" disabled>
                <Lock className="h-4 w-4 mr-1" /> Login to Interact
            </Button>
        );
    }

    if (group.member_status === 'pending') {
        return (
            <Button size="sm" variant="secondary" onClick={() => handleJoinLeave(group)} className="text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:hover:bg-yellow-800 dark:text-yellow-300">
                <RefreshCw className="h-4 w-4 mr-1" /> Pending
            </Button>
        );
    }

    if (group.is_member) {
        return (
            <Button size="sm" variant="destructive" onClick={() => handleJoinLeave(group)} className="text-sm">
                <LogOut className="h-4 w-4 mr-1" /> Leave Group
            </Button>
        );
    }

    // Not a member, not pending
    return (
        <Button size="sm" onClick={() => handleJoinLeave(group)} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
            <UserPlus className="h-4 w-4 mr-1" /> {group.privacy === 'public' ? 'Join Group' : 'Request to Join'}
        </Button>
    );
  };


  // if (isLoading) {
  //   return (
  //     <div className="flex justify-center items-center h-48">
  //       <RefreshCw className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
  //     </div>
  //   );
  // }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h2 className="text-3xl font-bold mb-6 text-slate-800 dark:text-white">Study Groups</h2>
      
      {/* Create Group Button */}
      {currentUser && <CreateGroupDialog onCreate={onCreateGroup} />}

      {groups.length === 0 && (
        <p className="text-center text-slate-500 dark:text-gray-400 py-12">
          No groups found. Be the first to <span className="font-semibold">Create a Group</span>!
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {groups.map((group) => (
          <Card
            key={group.id}
            className="group hover:shadow-lg transition-shadow duration-300 dark:bg-gray-800/80 border-slate-200 dark:border-gray-700"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12 border-2 border-blue-500 dark:border-blue-400">
                  <AvatarImage src={group.avatar_url} alt={group.name} />
                  <AvatarFallback className="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 text-lg font-bold">
                    {group.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-800 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">
                    {group.name}
                  </CardTitle>
                  <p className="text-sm text-slate-500 dark:text-gray-400 flex items-center">
                    {group.privacy === 'public' ? (
                      <Globe className="h-3 w-3 mr-1" />
                    ) : (
                      <Lock className="h-3 w-3 mr-1" />
                    )}
                    {group.privacy.charAt(0).toUpperCase() + group.privacy.slice(1)} Group
                  </p>
                </div>
              </div>
              
              <Badge variant="secondary" className="text-xs bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300">
                {group.member_role ? group.member_role.charAt(0).toUpperCase() + group.member_role.slice(1) : ''}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-3 h-12 overflow-hidden text-ellipsis text-slate-700 dark:text-gray-300">
                {group.description}
              </p>
              
              <div className="flex justify-between items-center text-sm text-slate-500 dark:text-gray-400 mt-2">
                <span className="flex items-center">
                  <Users className="h-4 w-4 mr-1 text-blue-500" />
                  {formatEngagementCount(group.members_count)} Members
                </span>
                <span className="text-xs">
                  Created {getTimeAgo(group.created_at)}
                </span>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-gray-700">
                {getActionButton(group)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Infinite scroll trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="py-4 flex justify-center">
          {isLoadingMore ? (
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-slate-500 dark:text-gray-400">
                Loading more groups...
              </span>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={onLoadMore}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-700"
            >
              <Users className="h-4 w-4 mr-2" />
              Load More Groups
            </Button>
          )}
        </div>
      )}

      {/* End of groups indicator */}
      {!hasMore && groups.length > 6 && (
        <div className="text-center py-4 border-t border-slate-200 dark:border-gray-700">
          <p className="text-sm text-slate-400 dark:text-gray-500">
            You've reached the end of the public study groups.
          </p>
        </div>
      )}
    </div>
  );
};
