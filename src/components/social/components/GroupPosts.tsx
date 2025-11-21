import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Card, CardContent } from '../../ui/card';
import {
  Send,
  Image,
  FileText,
  Video,
  X,
  Loader2,
  MessageCircle,
  ThumbsUp,
  Share2,
  Bookmark
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { toast } from 'sonner';

interface GroupPostsProps {
  groupId: string;
  currentUser: any;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author: any;
  media: any[];
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
}

export const GroupPosts: React.FC<GroupPostsProps> = ({ groupId, currentUser }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    fetchPosts();
    setupRealtimeSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [groupId]);

  const setupRealtimeSubscription = () => {
    channelRef.current = supabase
      .channel(`group_posts_${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'social_posts',
          filter: `group_id=eq.${groupId}`
        },
        async (payload) => {
          const postDetails = await fetchSinglePost(payload.new.id);
          if (postDetails) {
            setPosts(prev => [postDetails, ...prev]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'social_posts',
          filter: `group_id=eq.${groupId}`
        },
        async (payload) => {
          const postDetails = await fetchSinglePost(payload.new.id);
          if (postDetails) {
            setPosts(prev => prev.map(p => p.id === postDetails.id ? postDetails : p));
          }
        }
      )
      .subscribe();
  };

  const fetchSinglePost = async (postId: string): Promise<Post | null> => {
    try {
      const { data, error } = await supabase
        .from('social_posts')
        .select(`
          *,
          author:social_users(*),
          media:social_media(*)
        `)
        .eq('id', postId)
        .single();

      if (error || !data) return null;

      const { data: likeData } = await supabase
        .from('social_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUser.id)
        .single();

      const { data: bookmarkData } = await supabase
        .from('social_bookmarks')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUser.id)
        .single();

      return {
        ...data,
        is_liked: !!likeData,
        is_bookmarked: !!bookmarkData
      };
    } catch (error) {
      console.error('Error fetching post:', error);
      return null;
    }
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('social_posts')
        .select(`
          *,
          author:social_users(*),
          media:social_media(*)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const postIds = data.map(p => p.id);

      const [likesResult, bookmarksResult] = await Promise.all([
        supabase
          .from('social_likes')
          .select('post_id')
          .eq('user_id', currentUser.id)
          .in('post_id', postIds),
        supabase
          .from('social_bookmarks')
          .select('post_id')
          .eq('user_id', currentUser.id)
          .in('post_id', postIds)
      ]);

      const likedPostIds = new Set(likesResult.data?.map(l => l.post_id) || []);
      const bookmarkedPostIds = new Set(bookmarksResult.data?.map(b => b.post_id) || []);

      const transformedPosts = data.map(post => ({
        ...post,
        is_liked: likedPostIds.has(post.id),
        is_bookmarked: bookmarkedPostIds.has(post.id)
      }));

      setPosts(transformedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;

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

  const handleSubmitPost = async () => {
    if (!newPost.trim() && selectedFiles.length === 0) {
      toast.error('Please add some content or files');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: postData, error: postError } = await supabase
        .from('social_posts')
        .insert({
          author_id: currentUser.id,
          content: newPost,
          group_id: groupId,
          privacy: 'public'
        })
        .select()
        .single();

      if (postError) throw postError;

      if (selectedFiles.length > 0) {
        const uploadPromises = selectedFiles.map(async file => {
          const url = await uploadFile(file);
          if (url) {
            return supabase.from('social_media').insert({
              post_id: postData.id,
              type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document',
              url,
              filename: file.name,
              size_bytes: file.size,
              mime_type: file.type
            });
          }
        });

        await Promise.all(uploadPromises);
      }

      setNewPost('');
      setSelectedFiles([]);
      toast.success('Post created successfully!');
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLike = async (postId: string, isLiked: boolean) => {
    try {
      if (isLiked) {
        await supabase
          .from('social_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id);
      } else {
        await supabase
          .from('social_likes')
          .insert({ post_id: postId, user_id: currentUser.id });
      }

      setPosts(prev => prev.map(post =>
        post.id === postId
          ? {
              ...post,
              likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1,
              is_liked: !isLiked
            }
          : post
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update like');
    }
  };

  const handleToggleBookmark = async (postId: string, isBookmarked: boolean) => {
    try {
      if (isBookmarked) {
        await supabase
          .from('social_bookmarks')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id);
      } else {
        await supabase
          .from('social_bookmarks')
          .insert({ post_id: postId, user_id: currentUser.id });
      }

      setPosts(prev => prev.map(post =>
        post.id === postId ? { ...post, is_bookmarked: !isBookmarked } : post
      ));

      toast.success(isBookmarked ? 'Removed from bookmarks' : 'Added to bookmarks');
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast.error('Failed to update bookmark');
    }
  };

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Post Card */}
      <Card>
        <CardContent className="pt-6 ">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={currentUser?.avatar_url} />
              <AvatarFallback>
                {currentUser?.display_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Textarea
                placeholder="Share something with the group..."
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                className="min-h-[100px] resize-none"
              />

              {selectedFiles.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      {file.type.startsWith('image/') ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                          <FileText className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <p className="text-xs text-gray-500 mt-1 truncate">{file.name}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Image className="h-4 w-4 mr-2" />
                    Photo
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Video
                  </Button>
                </div>
                <Button
                  onClick={handleSubmitPost}
                  disabled={isSubmitting || (!newPost.trim() && selectedFiles.length === 0)}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Post
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Posts Feed */}
      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
            <p className="text-gray-500">Be the first to share something!</p>
          </CardContent>
        </Card>
      ) : (
        posts.map((post) => (
          <Card key={post.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              {/* Post Header */}
              <div className="flex items-start gap-3 mb-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={post.author?.avatar_url} />
                  <AvatarFallback>
                    {post.author?.display_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{post.author?.display_name}</p>
                      <p className="text-sm text-gray-500">
                        @{post.author?.username} · {getTimeAgo(post.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Post Content */}
              <p className="text-slate-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">
                {post.content}
              </p>

              {/* Post Media */}
              {post.media && post.media.length > 0 && (
                <div className={`grid gap-2 mb-4 ${
                  post.media.length === 1 ? 'grid-cols-1' : 
                  post.media.length === 2 ? 'grid-cols-2' : 
                  'grid-cols-2 sm:grid-cols-3'
                }`}>
                  {post.media.map((media: any, index: number) => (
                    <div key={media.id || index} className="relative aspect-video rounded-lg overflow-hidden">
                      {media.type === 'image' ? (
                        <img
                          src={media.url}
                          alt={media.filename}
                          className="w-full h-full object-cover"
                        />
                      ) : media.type === 'video' ? (
                        <video
                          src={media.url}
                          controls
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                          <FileText className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Post Actions */}
              <div className="flex items-center gap-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleToggleLike(post.id, post.is_liked)}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                    post.is_liked
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400'
                  }`}
                >
                  <ThumbsUp className={`h-5 w-5 ${post.is_liked ? 'fill-current' : ''}`} />
                  {post.likes_count > 0 && <span>{post.likes_count}</span>}
                </button>

                <button
                  onClick={() => {
                    const newExpanded = new Set(expandedComments);
                    if (newExpanded.has(post.id)) {
                      newExpanded.delete(post.id);
                    } else {
                      newExpanded.add(post.id);
                    }
                    setExpandedComments(newExpanded);
                  }}
                  className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <MessageCircle className="h-5 w-5" />
                  {post.comments_count > 0 && <span>{post.comments_count}</span>}
                </button>

                <button
                  onClick={() => handleToggleBookmark(post.id, post.is_bookmarked)}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                    post.is_bookmarked
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  <Bookmark className={`h-5 w-5 ${post.is_bookmarked ? 'fill-current' : ''}`} />
                </button>

                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `${window.location.origin}/social/post/${post.id}`
                      );
                      toast.success('Link copied to clipboard!');
                    } catch (error) {
                      toast.error('Failed to copy link');
                    }
                  }}
                  className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>

              {/* Comments Section (Placeholder) */}
              {expandedComments.has(post.id) && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 text-center py-4">
                    Comments feature coming soon!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};