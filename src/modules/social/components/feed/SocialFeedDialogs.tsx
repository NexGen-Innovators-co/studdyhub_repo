import React from 'react';
import { CreatePostDialog } from '../CreatePostDialog';
import { ResourceSharingModal } from '../ResourceSharingModal';
import { SharePostToChatModal } from '../SharePostToChatModal';
import { SocialPostWithDetails } from '@/integrations/supabase/socialTypes';
import { Privacy } from '../../types/social';

interface SocialFeedDialogsProps {
  // Create Post Dialog
  showPostDialog: boolean;
  onShowPostDialogChange: (open: boolean) => void;
  newPostContent: string;
  onContentChange: (content: string) => void;
  selectedPrivacy: Privacy;
  onPrivacyChange: (privacy: Privacy) => void;
  selectedFiles: File[];
  onFilesChange: (files: File[]) => void;
  onSubmitPost: () => void;
  isUploading: boolean;
  currentUser: any;
  postMetadata: any;
  canCreatePosts: boolean;

  // Resource Sharing Modal
  showResourceSharingModal: boolean;
  onCloseResourceSharing: () => void;
  onShareResource: (resourceId: string, resourceType: 'note' | 'document' | 'class_recording', message?: string) => Promise<boolean>;
  userNotes: any[];
  userDocuments: any[];
  userClassRecordings: any[];
  isSendingMessage: boolean;
  activeChatSessionId: string | null;

  // Share Post to Chat Modal
  showSharePostModal: boolean;
  onCloseSharePost: () => void;
  postToShare: SocialPostWithDetails | null;
  chatSessions: any[];
  currentUserId: string;
  onSharePostMessage: (sessionId: string, message: string) => Promise<boolean>;
}

export const SocialFeedDialogs: React.FC<SocialFeedDialogsProps> = ({
  showPostDialog,
  onShowPostDialogChange,
  newPostContent,
  onContentChange,
  selectedPrivacy,
  onPrivacyChange,
  selectedFiles,
  onFilesChange,
  onSubmitPost,
  isUploading,
  currentUser,
  postMetadata,
  canCreatePosts,
  showResourceSharingModal,
  onCloseResourceSharing,
  onShareResource,
  userNotes,
  userDocuments,
  userClassRecordings,
  isSendingMessage,
  activeChatSessionId,
  showSharePostModal,
  onCloseSharePost,
  postToShare,
  chatSessions,
  currentUserId,
  onSharePostMessage,
}) => {
  return (
    <>
      {/* Resource Sharing Modal */}
      {activeChatSessionId && (
        <ResourceSharingModal
          isOpen={showResourceSharingModal}
          onClose={onCloseResourceSharing}
          onShareResource={onShareResource}
          notes={userNotes}
          documents={userDocuments}
          classRecordings={userClassRecordings}
          isSharing={isSendingMessage}
          isLoading={false}
          hasMoreNotes={false}
          hasMoreDocuments={false}
          hasMoreRecordings={false}
        />
      )}

      {/* Share Post to Chat Modal */}
      <SharePostToChatModal
        isOpen={showSharePostModal}
        onClose={onCloseSharePost}
        post={postToShare}
        chatSessions={chatSessions}
        currentUserId={currentUserId}
        onShare={onSharePostMessage}
        isSharing={isSendingMessage}
      />

      {/* Create Post Dialog */}
      <CreatePostDialog
        isOpen={showPostDialog}
        onOpenChange={onShowPostDialogChange}
        content={newPostContent}
        onContentChange={onContentChange}
        privacy={selectedPrivacy}
        onPrivacyChange={onPrivacyChange}
        selectedFiles={selectedFiles}
        onFilesChange={onFilesChange}
        onSubmit={onSubmitPost}
        isUploading={isUploading}
        currentUser={currentUser}
        metadata={postMetadata}
        disabled={!canCreatePosts}
        upgradeMessage="You've reached your daily post limit. Upgrade to Premium for unlimited posts!"
      />
    </>
  );
};
