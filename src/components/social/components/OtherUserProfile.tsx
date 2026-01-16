// src/components/social/components/OtherUserProfile.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SocialUserWithDetails, SocialPostWithDetails } from '@/integrations/supabase/socialTypes';
import { UserProfile } from './UserProfile';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface OtherUserProfileProps {
    currentUser: SocialUserWithDetails | null;
    onLike: (postId: string, isLiked: boolean) => void;
    onBookmark: (postId: string, isBookmarked: boolean) => void;
    onShare: (post: SocialPostWithDetails) => void;
    onComment: (postId: string) => void;
    isPostExpanded: (postId: string) => boolean;
    getPostComments: (postId: string) => any[];
    isLoadingPostComments: (postId: string) => boolean;
    getNewCommentContent: (postId: string) => string;
    onCommentChange: (postId: string, content: string) => void;
    onSubmitComment: (postId: string) => void;
    isAddingComment?: (postId: string) => boolean;
    onPostView: (postId: string) => void;
    onDeletePost?: (postId: string) => Promise<boolean>;
    onEditPost?: (postId: string, content: string) => Promise<boolean>;
    onFollow: (userId: string) => void;
    onStartChat: (userId: string) => void;
    likedPosts: SocialPostWithDetails[];
    bookmarkedPosts: SocialPostWithDetails[];
    onRefreshLikedPosts: () => void;
    onRefreshBookmarkedPosts: () => void;
    userGroups: any[];
    searchQuery?: string;
}

const POSTS_PER_PAGE = 20;

export const OtherUserProfile: React.FC<OtherUserProfileProps> = (props) => {
    const { userId } = useParams<{ userId: string }>();
    const navigate = useNavigate();

    const [user, setUser] = useState<SocialUserWithDetails | null>(null);
    const [userPosts, setUserPosts] = useState<SocialPostWithDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingPosts, setIsLoadingPosts] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [isFollowing, setIsFollowing] = useState(false);
    const [isFollowLoading, setIsFollowLoading] = useState(false); // Add loading state for follow action

    // For infinite scroll
    const observer = useRef<IntersectionObserver | null>(null);
    const lastPostElementRef = useCallback((node: HTMLDivElement | null) => {
        if (isLoadingMore || isLoadingPosts) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
                loadMorePosts();
            }
        });

        if (node) observer.current.observe(node);
    }, [isLoadingMore, isLoadingPosts, hasMore]);

    useEffect(() => {
        if (userId) {
            fetchUserProfile();
            fetchUserPosts(true); // reset = true
        }
    }, [userId]);

    const fetchUserProfile = async () => {
        if (!userId) return;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('social_users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;

            setUser(data);
        } catch (error) {
            //console.error('Error fetching user profile:', error);
            toast.error('Failed to load user profile');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (userId && props.currentUser) {
            checkIfFollowing();
        }
    }, [userId, props.currentUser]);

    const checkIfFollowing = async () => {
        if (!userId || !props.currentUser) return;

        const { data, error } = await supabase
            .from('social_follows')
            .select('id')
            .eq('follower_id', props.currentUser.id)
            .eq('following_id', userId)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            //console.error('Error checking follow status:', error);
            return;
        }

        setIsFollowing(!!data);
    };

    const fetchUserPosts = async (reset: boolean = false) => {
        if (!userId) return;

        const loadingState = reset ? setIsLoadingPosts : setIsLoadingMore;
        loadingState(true);

        try {
            const offset = reset ? 0 : userPosts.length;

            const { data: postsData, error: postsError } = await supabase
                .from('social_posts')
                .select(`
                    *,
                    author:social_users(*),
                    group:social_groups(*),
                    media:social_media(*)
                `)
                .eq('author_id', userId)
                .eq('privacy', 'public')
                .order('created_at', { ascending: false })
                .range(offset, offset + POSTS_PER_PAGE - 1);

            if (postsError) throw postsError;

            if (!postsData || postsData.length === 0) {
                setHasMore(false);
                loadingState(false);
                return;
            }

            const postIds = postsData.map(p => p.id);

            const [hashtagResult, tagResult, likeResult, bookmarkResult] = await Promise.all([
                supabase.from('social_post_hashtags').select(`post_id, hashtag:social_hashtags(*)`).in('post_id', postIds),
                supabase.from('social_post_tags').select(`post_id, tag:social_tags(*)`).in('post_id', postIds),
                props.currentUser
                    ? supabase.from('social_likes').select('post_id').eq('user_id', props.currentUser.id).in('post_id', postIds)
                    : Promise.resolve({ data: [] }),
                props.currentUser
                    ? supabase.from('social_bookmarks').select('post_id').eq('user_id', props.currentUser.id).in('post_id', postIds)
                    : Promise.resolve({ data: [] })
            ]);

            const transformedPosts = postsData.map(post => {
                const postHashtags = hashtagResult.data?.filter(ph => ph.post_id === post.id)?.map(ph => ph.hashtag)?.filter(Boolean) || [];
                const postTags = tagResult.data?.filter(pt => pt.post_id === post.id)?.map(pt => pt.tag)?.filter(Boolean) || [];
                const isLiked = likeResult.data?.some(like => like.post_id === post.id) || false;
                const isBookmarked = bookmarkResult.data?.some(bookmark => bookmark.post_id === post.id) || false;

                return {
                    ...post,
                    privacy: post.privacy as "public" | "followers" | "private",
                    media: (post.media || []).map((m: any) => ({ ...m, type: m.type as "image" | "video" | "document" })),
                    group: post.group ? { ...post.group, privacy: post.group.privacy as "public" | "private" } : undefined,
                    hashtags: postHashtags,
                    tags: postTags,
                    is_liked: isLiked,
                    is_bookmarked: isBookmarked
                };
            });

            setUserPosts(prev => reset ? transformedPosts : [...prev, ...transformedPosts]);
            setHasMore(postsData.length === POSTS_PER_PAGE);
        } catch (error) {
            //console.error('Error fetching user posts:', error);
            toast.error('Failed to load posts');
        } finally {
            loadingState(false);
        }
    };
    const handleToggleFollow = async () => {
        if (!userId || isFollowLoading) return;

        // Optimistically update UI first
        const newFollowingState = !isFollowing;
        setIsFollowing(newFollowingState);
        setIsFollowLoading(true);

        // Optimistically update target user's followers count
        setUser(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                followers_count: newFollowingState 
                    ? (prev.followers_count || 0) + 1 
                    : Math.max(0, (prev.followers_count || 0) - 1)
            };
        });

        try {
            await props.onFollow(userId);
            // If successful, refresh data to ensure accuracy
            fetchUserProfile();
        } catch (error) {
            //console.error('Error toggling follow:', error);
            toast.error('Failed to update follow status');
            // Revert on error
            setIsFollowing(!newFollowingState);
            setUser(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    followers_count: !newFollowingState 
                        ? (prev.followers_count || 0) + 1 
                        : Math.max(0, (prev.followers_count || 0) - 1)
                };
            });
        } finally {
            setIsFollowLoading(false);
        }
    };
    const loadMorePosts = () => {
        if (hasMore && !isLoadingMore && !isLoadingPosts) {
            fetchUserPosts(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <p className="text-slate-600 dark:text-slate-400 mb-4">User not found</p>
                <Button onClick={() => navigate('/social/feed')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Feed
                </Button>
            </div>
        );
    }

    const isOwnProfile = props.currentUser?.id === userId;

    return (
        <div className="max-w-[780px] mx-auto pb-20">
            {/* Back button */}
            <div className="mb-4 px-4 pt-4">
                <Button
                    variant="ghost"
                    onClick={() => navigate(-1)}
                    className="pl-0 hover:pl-2 transition-all"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
            </div>

            {/* User Profile */}
            <UserProfile
                user={user}
                isOwnProfile={isOwnProfile}
                onEditProfile={() => { }}
                posts={userPosts}
                isLoadingPosts={isLoadingPosts}
                onLike={props.onLike}
                onBookmark={props.onBookmark}
                onShare={props.onShare}
                onComment={props.onComment}
                isPostExpanded={props.isPostExpanded}
                getPostComments={props.getPostComments}
                isLoadingPostComments={props.isLoadingPostComments}
                getNewCommentContent={props.getNewCommentContent}
                onCommentChange={props.onCommentChange}
                onSubmitComment={props.onSubmitComment}
                isAddingComment={props.isAddingComment}
                currentUser={props.currentUser}
                onPostView={props.onPostView}
                onClick={(postId: string) => navigate(`/social/post/${postId}`)}
                likedPosts={props.likedPosts}
                bookmarkedPosts={props.bookmarkedPosts}
                onRefreshLikedPosts={props.onRefreshLikedPosts}
                onRefreshBookmarkedPosts={props.onRefreshBookmarkedPosts}
                userGroups={props.userGroups}
                onFollow={props.onFollow}
                onStartChat={props.onStartChat}
                onDeletePost={props.onDeletePost}
                onEditPost={props.onEditPost}
                isFollowing={isFollowing}
                onToggleFollow={handleToggleFollow}
                searchQuery={props.searchQuery}
            />

            {/* Infinite Scroll Trigger */}
            {hasMore && (
                <div ref={lastPostElementRef} className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
            )}

            {!hasMore && userPosts.length > 0 && (
                <div className="text-center py-8 text-slate-500 text-sm">
                    No more posts to show
                </div>
            )}
        </div>
    );
};