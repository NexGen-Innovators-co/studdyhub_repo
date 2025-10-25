import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Users, UserPlus, RefreshCw, Lock, Globe, PlusCircle, LogOut, MessageCircle } from 'lucide-react';
import { SocialGroupWithDetails, SocialUserWithDetails, CreateGroupData } from '../../../integrations/supabase/socialTypes';
import { formatEngagementCount, getTimeAgo } from '../utils/postUtils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface GroupsSectionProps {
  groups: SocialGroupWithDetails[];
  isLoading: boolean;
  onJoinGroup: (groupId: string, privacy: 'public' | 'private') => Promise<boolean>;
  onLeaveGroup: (groupId: string) => Promise<boolean>;
  onCreateGroup: (data: CreateGroupData) => Promise<SocialGroupWithDetails | null>;
  currentUser: SocialUserWithDetails | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  onRefresh?: () => void;
}

// --- Group Creation Dialog Component ---
const CreateGroupDialog: React.FC<{ onCreate: (data: CreateGroupData) => Promise<any> }> = ({ onCreate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<CreateGroupData>({
    name: '',
    description: '',
    category: 'study',
    privacy: 'public'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (field: string) => (value: string) => {
    setFormData({ ...formData, [field]: value });
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
      setFormData({ name: '', description: '', category: 'study', privacy: 'public' });
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full mb-6 bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 text-white dark:from-blue-500 dark:to-blue-500 dark:hover:from-blue-600 dark:hover:to-blue-600 shadow-md">
          <PlusCircle className="h-4 w-4 mr-2" />
          Create New Study Group
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Create New Study Group</DialogTitle>
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
              maxLength={100}
            />
            <span className="text-xs text-gray-500">{formData.name.length}/100</span>
          </div>
          <div className="grid gap-2">
            <label htmlFor="category" className="text-sm font-medium">Category</label>
            <Select value={formData.category} onValueChange={handleSelectChange('category')}>
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="study">📚 Study Group</SelectItem>
                <SelectItem value="project">💻 Project Collaboration</SelectItem>
                <SelectItem value="discussion">💬 Discussion Forum</SelectItem>
                <SelectItem value="exam-prep">📝 Exam Preparation</SelectItem>
                <SelectItem value="research">🔬 Research Group</SelectItem>
                <SelectItem value="other">🎯 Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="description" className="text-sm font-medium">Description</label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="What is this group about? What topics will be discussed?"
              rows={4}
              required
              maxLength={500}
            />
            <span className="text-xs text-gray-500">{formData.description.length}/500</span>
          </div>
          <div className="grid gap-2">
            <label htmlFor="privacy" className="text-sm font-medium">Privacy</label>
            <Select value={formData.privacy} onValueChange={handleSelectChange('privacy')}>
              <SelectTrigger id="privacy" className="w-full">
                <SelectValue placeholder="Select privacy level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <div className="flex items-center">
                    <Globe className="h-4 w-4 mr-2" />
                    <div>
                      <p className="font-medium">Public</p>
                      <p className="text-xs text-gray-500">Anyone can join and see content</p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="private">
                  <div className="flex items-center">
                    <Lock className="h-4 w-4 mr-2" />
                    <div>
                      <p className="font-medium">Private</p>
                      <p className="text-xs text-gray-500">Requires approval to join</p>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.name || !formData.description}>
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create Group
                </>
              )}
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
  onRefresh,
}) => {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
      if (group.member_status === 'pending') {
        await onLeaveGroup(group.id);
      } else {
        await onLeaveGroup(group.id);
      }
    } else {
      await onJoinGroup(group.id, group.privacy);
    }
  };

  const handleGroupClick = (groupId: string) => {
    navigate(`/social/group/${groupId}`);
  };

  const getActionButton = (group: SocialGroupWithDetails) => {
    if (!currentUser) {
      return (
        <Button size="sm" variant="outline" disabled className="w-full">
          <Lock className="h-4 w-4 mr-1" /> Login to Join
        </Button>
      );
    }

    if (group.member_status === 'pending') {
      return (
        <Button
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            handleJoinLeave(group);
          }}
          className="w-full text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:hover:bg-yellow-800 dark:text-yellow-300"
        >
          <RefreshCw className="h-4 w-4 mr-1" /> Pending
        </Button>
      );
    }

    if (group.is_member) {
      return (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleGroupClick(group.id);
            }}
            className="flex-1 text-sm bg-blue-600 hover:bg-blue-700 text-white"
          >
            <MessageCircle className="h-4 w-4 mr-1" /> Open
          </Button>
          {/* <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleJoinLeave(group);
            }}
            className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <LogOut className="h-4 w-4" />
          </Button> */}
        </div>
      );
    }

    return (
      <Button
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          handleJoinLeave(group);
        }}
        className="w-full text-sm bg-blue-600 hover:bg-blue-700 text-white"
      >
        <UserPlus className="h-4 w-4 mr-1" />
        {group.privacy === 'public' ? 'Join Group' : 'Request to Join'}
      </Button>
    );
  };

  const getCategoryEmoji = (category: string) => {
    const emojiMap: Record<string, string> = {
      study: '📚',
      project: '💻',
      discussion: '💬',
      'exam-prep': '📝',
      research: '🔬',
      other: '🎯'
    };
    return emojiMap[category] || '🎯';
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
      toast.success('Groups refreshed!');
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden px-2 sm:px-4 md:px-6 lg:px-8 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">
            Study Groups
          </h2>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          )}
        </div>

        {/* Create Group Button */}
        {currentUser && <CreateGroupDialog onCreate={onCreateGroup} />}

        {isLoading && groups.length === 0 ? (
          <div className="flex justify-center items-center h-48">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-slate-500 dark:text-gray-400">Loading groups...</p>
            </div>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-gray-700">
            <Users className="h-16 w-16 mx-auto mb-4 text-slate-400 dark:text-gray-500" />
            <p className="text-slate-600 dark:text-gray-300 mb-2 font-semibold">No groups found</p>
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Be the first to <span className="font-semibold text-blue-600 dark:text-blue-400">Create a Group</span>!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {groups.map((group) => (
              <Card
                key={group.id}
                onClick={() => group.is_member && handleGroupClick(group.id)}
                className={`group transition-all duration-300 dark:bg-gray-800/80 border-slate-200 dark:border-gray-700 flex flex-col ${
                  group.is_member ? 'hover:shadow-xl hover:scale-[1.02] cursor-pointer' : 'hover:shadow-lg'
                }`}
              >
                <CardHeader className="flex-shrink-0 pb-3 space-y-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar className="h-12 w-12 flex-shrink-0 border-2 border-blue-500 dark:border-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/50">
                        <AvatarImage src={group.avatar_url} alt={group.name} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-lg font-bold">
                          {getCategoryEmoji(group.category)} {group.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base sm:text-lg font-semibold text-slate-800 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2">
                          {group.name}
                        </CardTitle>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 flex items-center mt-1">
                          {group.privacy === 'public' ? (
                            <Globe className="h-3 w-3 mr-1 flex-shrink-0" />
                          ) : (
                            <Lock className="h-3 w-3 mr-1 flex-shrink-0" />
                          )}
                          <span className="truncate">{group.privacy.charAt(0).toUpperCase() + group.privacy.slice(1)}</span>
                        </p>
                      </div>
                    </div>

                    {group.member_role && (
                      <Badge variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex-shrink-0">
                        {group.member_role.charAt(0).toUpperCase() + group.member_role.slice(1)}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col justify-between pt-0">
                  <div>
                    <p className="text-sm mb-3 line-clamp-3 text-slate-700 dark:text-gray-300 leading-relaxed">
                      {group.description}
                    </p>

                    <div className="flex flex-wrap gap-2 items-center text-xs sm:text-sm text-slate-500 dark:text-gray-400 mb-3">
                      <span className="flex items-center bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
                        <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-blue-500" />
                        <span className="font-medium">{formatEngagementCount(group.members_count)}</span>
                      </span>
                      {group.posts_count > 0 && (
                        <span className="flex items-center bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
                          <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-blue-500" />
                          <span className="font-medium">{formatEngagementCount(group.posts_count)}</span>
                        </span>
                      )}
                      <span className="text-xs text-slate-400 dark:text-gray-500 ml-auto">
                        {getTimeAgo(group.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-gray-700">
                    {getActionButton(group)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Infinite scroll trigger */}
        {hasMore && (
          <div ref={loadMoreRef} className="py-6 flex justify-center">
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
                className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700"
              >
                <Users className="h-4 w-4 mr-2" />
                Load More Groups
              </Button>
            )}
          </div>
        )}

        {/* End of groups indicator */}
        {!hasMore && groups.length > 6 && (
          <div className="text-center py-6 mt-4 border-t border-slate-200 dark:border-gray-700">
            <p className="text-sm text-slate-400 dark:text-gray-500">
              You've reached the end of available study groups.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};