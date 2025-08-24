import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';
import {
  Heart, MessageCircle, Share2, Bookmark, Users, Plus, MoreHorizontal, Search,
  TrendingUp, User, Hash, Image, Video, FileText, Send, Edit3, Trash2,
  Flag, Copy, ExternalLink, Eye, EyeOff, Globe, Lock, UsersIcon,
  ChevronDown, ChevronUp, Smile, Camera, Paperclip, X, MapPin, Calendar,
  Filter, SortAsc, SortDesc, RefreshCw, Settings, Bell, UserPlus,
  MessageSquare, Share, Zap, Award, Target, BookOpen, Lightbulb
} from 'lucide-react';
import { SocialPostWithDetails, SocialUserWithDetails, SocialCommentWithDetails } from '../integrations/supabase/socialTypes';

interface SocialFeedProps {
  userProfile: any;
}

export const SocialFeed: React.FC<SocialFeedProps> = ({ userProfile }) => {
  const [posts, setPosts] = useState<SocialPostWithDetails[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'feed' | 'trending' | 'groups' | 'profile'>('feed');
  const [currentUser, setCurrentUser] = useState<SocialUserWithDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrivacy, setSelectedPrivacy] = useState<'public' | 'followers' | 'private'>('public');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, SocialCommentWithDetails[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const [trendingHashtags, setTrendingHashtags] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SocialUserWithDetails[]>([]);
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'trending'>('newest');
  const [filterBy, setFilterBy] = useState<'all' | 'following' | 'groups'>('all');
  const [showPostDialog, setShowPostDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    initializeSocialUser();
    fetchPosts();
    fetchTrendingHashtags();
    fetchSuggestedUsers();
    fetchNotifications();
  }, [sortBy, filterBy]);

  const initializeSocialUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: socialUser, error: fetchError } = await supabase
        .from('social_users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') {
        const { data: newSocialUser, error: createError } = await supabase
          .from('social_users')
          .insert({
            id: user.id,
            username: userProfile?.full_name?.toLowerCase().replace(/\s+/g, '_') || `user_${user.id.slice(0, 8)}`,
            display_name: userProfile?.full_name || 'Anonymous User',
            avatar_url: userProfile?.avatar_url || '',
            bio: 'New to the community!',
            interests: ['learning', 'technology']
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating social user:', createError);
          toast.error('Failed to initialize social profile');
          return;
        }
        setCurrentUser(newSocialUser);
      } else if (!fetchError && socialUser) {
        setCurrentUser(socialUser);
      }
    } catch (error) {
      console.error('Error initializing social user:', error);
    }
  };

  const extractHashtags = (content: string): string[] => {
    const hashtagRegex = /#(\w+)/g;
    const hashtags = [];
    let match;
    while ((match = hashtagRegex.exec(content)) !== null) {
      hashtags.push(match[1].toLowerCase());
    }
    return [...new Set(hashtags)];
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('social-media')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('social-media')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const fetchPosts = async () => {
    try {
      setIsLoading(true);

      let query = supabase
        .from('social_posts')
        .select(`
          *,
          author:social_users(*),
          group:social_groups(*),
          media:social_media(*)
        `)
        .eq('privacy', 'public');

      // Apply sorting
      if (sortBy === 'newest') {
        query = query.order('created_at', { ascending: false });
      } else if (sortBy === 'popular') {
        query = query.order('likes_count', { ascending: false });
      }

      const { data: postsData, error: postsError } = await query.limit(20);

      if (postsError) throw postsError;
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = postsData.map(post => post.id);

      // Fetch hashtags
      const { data: hashtagData } = await supabase
        .from('social_post_hashtags')
        .select(`post_id, hashtag:social_hashtags(*)`)
        .in('post_id', postIds);

      // Fetch tags
      const { data: tagData } = await supabase
        .from('social_post_tags')
        .select(`post_id, tag:social_tags(*)`)
        .in('post_id', postIds);

      // Check likes and bookmarks
      const { data: { user } } = await supabase.auth.getUser();
      let likeData = [], bookmarkData = [];

      if (user) {
        const { data: likes } = await supabase
          .from('social_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds);
        likeData = likes || [];

        const { data: bookmarks } = await supabase
          .from('social_bookmarks')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds);
        bookmarkData = bookmarks || [];
      }

      const transformedPosts = postsData.map(post => {
        const postHashtags = hashtagData?.filter(ph => ph.post_id === post.id)?.map(ph => ph.hashtag)?.filter(Boolean) || [];
        const postTags = tagData?.filter(pt => pt.post_id === post.id)?.map(pt => pt.tag)?.filter(Boolean) || [];
        const isLiked = likeData.some(like => like.post_id === post.id);
        const isBookmarked = bookmarkData.some(bookmark => bookmark.post_id === post.id);

        return {
          ...post,
          media: post.media || [],
          hashtags: postHashtags,
          tags: postTags,
          is_liked: isLiked,
          is_bookmarked: isBookmarked
        };
      });

      setPosts(transformedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrendingHashtags = async () => {
    try {
      const { data, error } = await supabase
        .from('social_hashtags')
        .select('*')
        .order('posts_count', { ascending: false })
        .limit(10);

      if (!error && data) {
        setTrendingHashtags(data);
      }
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
    }
  };

  const fetchSuggestedUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('social_users')
        .select('*')
        .neq('id', user.id)
        .order('followers_count', { ascending: false })
        .limit(5);

      if (!error && data) {
        setSuggestedUsers(data);
      }
    } catch (error) {
      console.error('Error fetching suggested users:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('social_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const createPost = async () => {
    if (!newPostContent.trim()) return;

    try {
      setIsUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create post
      const { data: newPost, error: postError } = await supabase
        .from('social_posts')
        .insert({
          author_id: user.id,
          content: newPostContent,
          privacy: selectedPrivacy
        })
        .select(`*, author:social_users(*), group:social_groups(*), media:social_media(*)`)
        .single();

      if (postError) throw postError;

      // Upload media files
      const mediaPromises = selectedFiles.map(async (file) => {
        const url = await uploadFile(file);
        if (url) {
          return supabase.from('social_media').insert({
            post_id: newPost.id,
            type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document',
            url,
            filename: file.name,
            size_bytes: file.size,
            mime_type: file.type
          });
        }
      });

      await Promise.all(mediaPromises.filter(Boolean));

      // Handle hashtags
      const hashtags = extractHashtags(newPostContent);
      for (const tag of hashtags) {
        // Insert or get hashtag
        const { data: hashtag, error: hashtagError } = await supabase
          .from('social_hashtags')
          .upsert({ name: tag }, { onConflict: 'name' })
          .select()
          .single();

        if (!hashtagError && hashtag) {
          // Link hashtag to post
          await supabase.from('social_post_hashtags').insert({
            post_id: newPost.id,
            hashtag_id: hashtag.id
          });
        }
      }

      const transformedPost = {
        ...newPost,
        media: [],
        hashtags: [],
        tags: [],
        is_liked: false,
        is_bookmarked: false
      };

      setPosts(prev => [transformedPost, ...prev]);
      setNewPostContent('');
      setSelectedFiles([]);
      setShowPostDialog(false);
      toast.success('Post created successfully!');
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleLike = async (postId: string, isLiked: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isLiked) {
        await supabase.from('social_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        await supabase.from('social_likes').insert({ post_id: postId, user_id: user.id });

        // Create notification for post author
        const post = posts.find(p => p.id === postId);
        if (post && post.author_id !== user.id) {
          await supabase.from('social_notifications').insert({
            user_id: post.author_id,
            type: 'like',
            title: 'New like on your post',
            message: `${currentUser?.display_name} liked your post`,
            data: { post_id: postId, user_id: user.id }
          });
        }
      }

      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1,
            is_liked: !isLiked
          };
        }
        return post;
      }));
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update like');
    }
  };

  const toggleBookmark = async (postId: string, isBookmarked: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isBookmarked) {
        await supabase.from('social_bookmarks').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        await supabase.from('social_bookmarks').insert({ post_id: postId, user_id: user.id });
      }

      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            bookmarks_count: isBookmarked ? post.bookmarks_count - 1 : post.bookmarks_count + 1,
            is_bookmarked: !isBookmarked
          };
        }
        return post;
      }));
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast.error('Failed to update bookmark');
    }
  };

  const fetchComments = async (postId: string) => {
    if (comments[postId]) return;

    try {
      setLoadingComments(prev => new Set([...prev, postId]));

      const { data, error } = await supabase
        .from('social_comments')
        .select(`*, author:social_users(*)`)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setComments(prev => ({
        ...prev,
        [postId]: data || []
      }));
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const addComment = async (postId: string) => {
    const content = newComment[postId]?.trim();
    if (!content) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: comment, error } = await supabase
        .from('social_comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          content
        })
        .select(`*, author:social_users(*)`)
        .single();

      if (error) throw error;

      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), comment]
      }));

      setNewComment(prev => ({
        ...prev,
        [postId]: ''
      }));

      // Create notification for post author
      const post = posts.find(p => p.id === postId);
      if (post && post.author_id !== user.id) {
        await supabase.from('social_notifications').insert({
          user_id: post.author_id,
          type: 'comment',
          title: 'New comment on your post',
          message: `${currentUser?.display_name} commented on your post`,
          data: { post_id: postId, comment_id: comment.id }
        });
      }

      toast.success('Comment added!');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const followUser = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('social_follows').insert({
        follower_id: user.id,
        following_id: userId
      });

      // Create notification
      await supabase.from('social_notifications').insert({
        user_id: userId,
        type: 'follow',
        title: 'New follower',
        message: `${currentUser?.display_name} started following you`,
        data: { user_id: user.id }
      });

      setSuggestedUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('Now following user!');
    } catch (error) {
      console.error('Error following user:', error);
      toast.error('Failed to follow user');
    }
  };

  const sharePost = async (post: SocialPostWithDetails) => {
    try {
      await navigator.clipboard.writeText(
        `Check out this post by ${post.author?.display_name}: "${post.content.substring(0, 100)}..."`
      );

      // Update share count
      await supabase
        .from('social_posts')
        .update({ shares_count: post.shares_count + 1 })
        .eq('id', post.id);

      setPosts(prev => prev.map(p =>
        p.id === post.id ? { ...p, shares_count: p.shares_count + 1 } : p
      ));

      toast.success('Post link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to share post');
    }
  };

  const PostCard = ({ post }: { post: SocialPostWithDetails }) => {
    const isExpanded = expandedPosts.has(post.id);
    const postComments = comments[post.id] || [];
    const isLoadingComments = loadingComments.has(post.id);

    return (
      <Card className="mb-6 hover:shadow-lg transition-shadow duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="ring-2 ring-primary/10">
                <AvatarImage src={post.author?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5">
                  {post.author?.display_name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{post.author?.display_name}</p>
                  {post.author?.is_verified && (
                    <Award className="h-4 w-4 text-blue-500" />
                  )}
                  {post.author?.is_contributor && (
                    <Target className="h-4 w-4 text-purple-500" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>@{post.author?.username}</span>
                  <span>•</span>
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                  {post.privacy === 'followers' && <UsersIcon className="h-3 w-3" />}
                  {post.privacy === 'private' && <Lock className="h-3 w-3" />}
                  {post.privacy === 'public' && <Globe className="h-3 w-3" />}
                </div>
              </div>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Post Options</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col space-y-2">
                  <Button variant="ghost" onClick={() => sharePost(post)} className="justify-start">
                    <Share className="h-4 w-4 mr-2" />
                    Share Post
                  </Button>
                  <Button variant="ghost" className="justify-start text-red-600">
                    <Flag className="h-4 w-4 mr-2" />
                    Report Post
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          <p className="mb-4 whitespace-pre-wrap leading-relaxed">{post.content}</p>

          {/* Media display */}
          {post.media && post.media.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-4 rounded-lg overflow-hidden">
              {post.media.slice(0, 4).map((media, index) => (
                <div key={media.id} className="relative group">
                  {media.type === 'image' && (
                    <img
                      src={media.url}
                      alt={media.filename}
                      className="w-full h-40 object-cover hover:scale-105 transition-transform cursor-pointer"
                    />
                  )}
                  {media.type === 'video' && (
                    <video
                      src={media.url}
                      className="w-full h-40 object-cover"
                      controls
                    />
                  )}
                  {media.type === 'document' && (
                    <div className="w-full h-40 bg-muted flex items-center justify-center">
                      <div className="text-center">
                        <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm truncate px-2">{media.filename}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Hashtags */}
          {post.hashtags && post.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.hashtags.map((hashtag, index) => (
                <Badge key={index} variant="secondary" className="text-xs hover:bg-primary/10 cursor-pointer">
                  #{hashtag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Engagement Stats */}
          <div className="flex items-center justify-between py-2 border-t border-b mb-3">
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <span>{post.likes_count} likes</span>
              <span>{post.comments_count} comments</span>
              <span>{post.shares_count} shares</span>
            </div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" />
              <span>{Math.floor(Math.random() * 500) + 50}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleLike(post.id, post.is_liked || false)}
                className={`${post.is_liked ? 'text-red-500 bg-red-50' : ''} hover:bg-red-50 hover:text-red-500`}
              >
                <Heart className={`h-4 w-4 mr-1 ${post.is_liked ? 'fill-current' : ''}`} />
                Like
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!isExpanded) {
                    setExpandedPosts(prev => new Set([...prev, post.id]));
                    fetchComments(post.id);
                  } else {
                    setExpandedPosts(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(post.id);
                      return newSet;
                    });
                  }
                }}
                className="hover:bg-blue-50 hover:text-blue-600"
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                Comment
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => sharePost(post)}
                className="hover:bg-green-50 hover:text-green-600"
              >
                <Share2 className="h-4 w-4 mr-1" />
                Share
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleBookmark(post.id, post.is_bookmarked || false)}
              className={`${post.is_bookmarked ? 'text-blue-500 bg-blue-50' : ''} hover:bg-blue-50 hover:text-blue-500`}
            >
              <Bookmark className={`h-4 w-4 ${post.is_bookmarked ? 'fill-current' : ''}`} />
            </Button>
          </div>

          {/* Comments Section */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t">
              {isLoadingComments ? (
                <div className="flex justify-center py-4">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {postComments.map((comment) => (
                    <div key={comment.id} className="flex space-x-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={comment.author?.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {comment.author?.display_name?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-muted rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{comment.author?.display_name}</p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm">{comment.content}</p>
                      </div>
                    </div>
                  ))}

                  {/* Add comment */}
                  <div className="flex space-x-3 mt-4">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={currentUser?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {currentUser?.display_name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 flex gap-2">
                      <Input
                        placeholder="Write a comment..."
                        value={newComment[post.id] || ''}
                        onChange={(e) => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyPress={(e) => e.key === 'Enter' && addComment(post.id)}
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => addComment(post.id)}
                        disabled={!newComment[post.id]?.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const CreatePostDialog = () => (
    <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Avatar>
                <AvatarImage src={currentUser?.avatar_url} />
                <AvatarFallback>
                  {currentUser?.display_name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 flex items-center">
                <div className="w-full bg-muted rounded-full px-4 py-2 text-muted-foreground">
                  What's on your mind?
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={currentUser?.avatar_url} />
              <AvatarFallback>
                {currentUser?.display_name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{currentUser?.display_name}</p>
              <Select value={selectedPrivacy} onValueChange={(value: any) => setSelectedPrivacy(value)}>
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="h-3 w-3" />
                      Public
                    </div>
                  </SelectItem>
                  <SelectItem value="followers">
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      Followers
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="h-3 w-3" />
                      Private
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Textarea
            placeholder="What's happening? Use #hashtags to join conversations..."
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            className="min-h-[120px] resize-none text-lg border-0 shadow-none focus:ring-0"
          />

          {/* File Preview */}
          {selectedFiles.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="relative group">
                  <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="text-center">
                        <FileText className="h-8 w-8 mx-auto mb-1" />
                        <p className="text-xs truncate px-2">{file.name}</p>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Post Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="text-green-600 hover:bg-green-50"
              >
                <Image className="h-4 w-4 mr-1" />
                Photo
              </Button>

              <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50">
                <Video className="h-4 w-4 mr-1" />
                Video
              </Button>

              <Button variant="ghost" size="sm" className="text-purple-600 hover:bg-purple-50">
                <FileText className="h-4 w-4 mr-1" />
                Document
              </Button>

              <Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50">
                <Smile className="h-4 w-4 mr-1" />
                Emoji
              </Button>

              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50">
                <MapPin className="h-4 w-4 mr-1" />
                Location
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-sm ${newPostContent.length > 280 ? 'text-red-500' : 'text-muted-foreground'}`}>
                {newPostContent.length}/500
              </span>
              <Button
                onClick={createPost}
                disabled={!newPostContent.trim() || isUploading}
                className="bg-primary hover:bg-primary/90"
              >
                {isUploading ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Post
              </Button>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );

  const TrendingSidebar = () => (
    <div className="space-y-6">
      {/* Trending Hashtags */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Trending Topics
          </h3>
        </CardHeader>
        <CardContent className="space-y-2">
          {trendingHashtags.slice(0, 5).map((hashtag, index) => (
            <div key={hashtag.id} className="flex items-center justify-between py-1 hover:bg-muted/50 rounded px-2 -mx-2 cursor-pointer">
              <div>
                <p className="font-medium">#{hashtag.name}</p>
                <p className="text-xs text-muted-foreground">{hashtag.posts_count} posts</p>
              </div>
              <Badge variant="outline" className="text-xs">
                #{index + 1}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Suggested Users */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Who to Follow
          </h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestedUsers.slice(0, 3).map((user) => (
            <div key={user.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback>{user.display_name?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{user.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{user.username}</p>
                  <p className="text-xs text-muted-foreground">{user.followers_count} followers</p>
                </div>
              </div>
              <Button size="sm" onClick={() => followUser(user.id)}>
                Follow
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Your Stats
          </h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{currentUser?.posts_count || 0}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{currentUser?.followers_count || 0}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{currentUser?.following_count || 0}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">
                {posts.reduce((acc, post) => acc + post.likes_count, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Likes</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <div className="flex items-center justify-between mb-6">
          <TabsList className="grid w-fit grid-cols-4">
            <TabsTrigger value="feed" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Feed
            </TabsTrigger>
            <TabsTrigger value="trending" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Explore
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Groups
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={fetchNotifications}>
              <Bell className={`h-4 w-4 ${unreadCount > 0 ? 'text-red-500' : ''}`} />
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {unreadCount}
                </Badge>
              )}
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <div className="mb-6 flex gap-4 items-center">
              <Input
                placeholder="Search posts, users, or hashtags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">
                    <div className="flex items-center gap-2">
                      <SortDesc className="h-3 w-3" />
                      Newest
                    </div>
                  </SelectItem>
                  <SelectItem value="popular">
                    <div className="flex items-center gap-2">
                      <Heart className="h-3 w-3" />
                      Popular
                    </div>
                  </SelectItem>
                  <SelectItem value="trending">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3 w-3" />
                      Trending
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Globe className="h-3 w-3" />
                      All Posts
                    </div>
                  </SelectItem>
                  <SelectItem value="following">
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      Following
                    </div>
                  </SelectItem>
                  <SelectItem value="groups">
                    <div className="flex items-center gap-2">
                      <UsersIcon className="h-3 w-3" />
                      Groups
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchPosts}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <TabsContent value="feed" className="space-y-6">
              <CreatePostDialog />

              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="flex space-x-3">
                          <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                          <div className="flex-1 space-y-3">
                            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                            <div className="flex gap-4">
                              <div className="h-8 bg-gray-200 rounded w-16"></div>
                              <div className="h-8 bg-gray-200 rounded w-20"></div>
                              <div className="h-8 bg-gray-200 rounded w-16"></div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map(post => (
                    <PostCard key={post.id} post={post} />
                  ))}
                  {posts.length === 0 && (
                    <Card>
                      <CardContent className="text-center py-16">
                        <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-xl font-semibold mb-2">No posts yet</h3>
                        <p className="text-muted-foreground mb-4">Be the first to share something with the community!</p>
                        <Button onClick={() => setShowPostDialog(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Your First Post
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="trending">
              <Card>
                <CardContent className="text-center py-16">
                  <Hash className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Explore Trending Content</h3>
                  <p className="text-muted-foreground mb-4">Discover what's popular in your learning community</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {trendingHashtags.slice(0, 8).map((hashtag) => (
                      <Badge key={hashtag.id} variant="secondary" className="cursor-pointer hover:bg-primary/10">
                        #{hashtag.name} ({hashtag.posts_count})
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="groups">
              <Card>
                <CardContent className="text-center py-16">
                  <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Study Groups</h3>
                  <p className="text-muted-foreground mb-4">Join groups to collaborate with fellow learners</p>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Group
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profile">
              <Card>
                <CardContent className="text-center py-16">
                  <div className="flex flex-col items-center">
                    <Avatar className="w-24 h-24 mb-4 ring-4 ring-primary/10">
                      <AvatarImage src={currentUser?.avatar_url} />
                      <AvatarFallback className="text-2xl bg-gradient-to-br from-primary/20 to-primary/5">
                        {currentUser?.display_name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-2xl font-bold mb-2">{currentUser?.display_name}</h3>
                    <p className="text-muted-foreground mb-2">@{currentUser?.username}</p>
                    <p className="text-muted-foreground mb-4 max-w-md">{currentUser?.bio}</p>

                    <div className="flex gap-6 mb-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{currentUser?.posts_count || 0}</p>
                        <p className="text-sm text-muted-foreground">Posts</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{currentUser?.followers_count || 0}</p>
                        <p className="text-sm text-muted-foreground">Followers</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{currentUser?.following_count || 0}</p>
                        <p className="text-sm text-muted-foreground">Following</p>
                      </div>
                    </div>

                    <Button>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4">
            <TrendingSidebar />
          </div>
        </div>
      </Tabs>
    </div>
  );
};