import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';
import {
  Heart, MessageCircle, Share2, Bookmark, Users, Plus,
  MoreHorizontal, Search, TrendingUp, User, Hash
} from 'lucide-react';
import { SocialPostWithDetails, SocialUserWithDetails, SocialGroupWithDetails } from '../integrations/supabase/socialTypes';

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

  useEffect(() => {
    initializeSocialUser();
    fetchPosts();
  }, []);

  const initializeSocialUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if social user exists
      const { data: socialUser, error: fetchError } = await supabase
        .from('social_users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') {
        // User doesn't exist, create one
        const { data: newSocialUser, error: createError } = await supabase
          .from('social_users')
          .insert({
            id: user.id,
            username: userProfile?.full_name?.toLowerCase().replace(/\s+/g, '_') || `user_${user.id.slice(0, 8)}`,
            display_name: userProfile?.full_name || 'Anonymous User',
            avatar_url: userProfile?.avatar_url || '',
            bio: '',
            interests: []
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

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('social_posts')
        .select(`
          *,
          author:social_users(*),
          media:social_media(*),
          hashtags:social_hashtags(*),
          tags:social_tags(*)
        `)
        .eq('privacy', 'public')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      // Transform data to match SocialPostWithDetails interface
      const transformedPosts = (data || []).map(post => ({
        ...post,
        media: post.media || [],
        hashtags: post.hashtags || [],
        tags: post.tags || [],
        is_liked: false,
        is_bookmarked: false
      }));
      
      setPosts(transformedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  const createPost = async () => {
    if (!newPostContent.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: newPost, error } = await supabase
        .from('social_posts')
        .insert({
          author_id: user.id,
          content: newPostContent,
          privacy: 'public'
        })
        .select(`
          *,
          author:social_users(*),
          media:social_media(*),
          hashtags:social_hashtags(*),
          tags:social_tags(*)
        `)
        .single();

      if (error) throw error;

      // Transform data to match SocialPostWithDetails interface
      const transformedPost = {
        ...newPost,
        media: newPost.media || [],
        hashtags: newPost.hashtags || [],
        tags: newPost.tags || [],
        is_liked: false,
        is_bookmarked: false
      };

      setPosts(prev => [transformedPost, ...prev]);
      setNewPostContent('');
      toast.success('Post created successfully!');
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    }
  };

  const toggleLike = async (postId: string, isLiked: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isLiked) {
        // Unlike
        await supabase
          .from('social_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      } else {
        // Like
        await supabase
          .from('social_likes')
          .insert({
            post_id: postId,
            user_id: user.id
          });
      }

      // Update posts state
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

  const PostCard = ({ post }: { post: SocialPostWithDetails }) => (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarImage src={post.author?.avatar_url} />
              <AvatarFallback>
                {post.author?.display_name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{post.author?.display_name}</p>
              <p className="text-sm text-muted-foreground">
                @{post.author?.username} • {new Date(post.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 whitespace-pre-wrap">{post.content}</p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleLike(post.id, post.is_liked || false)}
              className={`${post.is_liked ? 'text-red-500' : ''}`}
            >
              <Heart className={`h-4 w-4 mr-1 ${post.is_liked ? 'fill-current' : ''}`} />
              {post.likes_count}
            </Button>
            <Button variant="ghost" size="sm">
              <MessageCircle className="h-4 w-4 mr-1" />
              {post.comments_count}
            </Button>
            <Button variant="ghost" size="sm">
              <Share2 className="h-4 w-4 mr-1" />
              {post.shares_count}
            </Button>
          </div>
          <Button variant="ghost" size="sm">
            <Bookmark className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="feed" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Feed
          </TabsTrigger>
          <TabsTrigger value="trending" className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Trending
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

        <div className="mt-6">
          <div className="flex gap-4 mb-6">
            <Input
              placeholder="Search posts, users, or hashtags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline">
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <TabsContent value="feed" className="space-y-4">
            {/* Create Post */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <Avatar>
                    <AvatarImage src={currentUser?.avatar_url} />
                    <AvatarFallback>
                      {currentUser?.display_name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-3">
                    <Textarea
                      placeholder="What's on your mind?"
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      className="min-h-[100px] resize-none"
                    />
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        <Badge variant="outline">#study</Badge>
                        <Badge variant="outline">#learning</Badge>
                      </div>
                      <Button onClick={createPost} disabled={!newPostContent.trim()}>
                        <Plus className="h-4 w-4 mr-1" />
                        Post
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Posts Feed */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="flex space-x-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
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
                    <CardContent className="text-center py-12">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
                      <p className="text-muted-foreground">Be the first to share something!</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trending">
            <Card>
              <CardContent className="text-center py-12">
                <Hash className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Trending Topics</h3>
                <p className="text-muted-foreground">See what's popular in your learning community</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="groups">
            <Card>
              <CardContent className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Study Groups</h3>
                <p className="text-muted-foreground">Join groups to collaborate with fellow learners</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardContent className="text-center py-12">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Your Profile</h3>
                <p className="text-muted-foreground">Manage your social learning profile</p>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};