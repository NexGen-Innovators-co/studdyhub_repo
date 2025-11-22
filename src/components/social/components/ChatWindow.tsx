// src/components/social/components/ChatWindow.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import {
  ArrowLeft,
  Users,
  StickyNote,
  FileText,
  Download,
  Plus,
  CheckCircle,
  X,
  ZoomIn,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { ChatSessionWithDetails, ChatMessageWithDetails } from '../types/social';
import { MessageInput } from './MessageInput';
import { NoteShareDialog } from './NoteShareDialog';
import { supabase } from '../../../integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

interface ChatWindowProps {
  session: ChatSessionWithDetails | null;
  messages: ChatMessageWithDetails[];
  currentUserId: string;
  onBack: () => void;
  onSendMessage: (content: string, files?: File[]) => Promise<boolean>;
  onSendMessageWithResource: (
    content: string,
    resourceId: string,
    resourceType: 'note' | 'document' | 'post'
  ) => Promise<boolean>;
  isSending: boolean;
  isLoading: boolean;
}

const theme = {
  header: 'bg-gradient-to-r from-blue-600 to-blue-500',
  ownBubble: 'bg-blue-600 text-white',
  otherBubble: 'bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100',
  background: 'bg-gradient-to-b from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800',
};

// ════════════════════════════════════════════════════════════════════════
// Image Lightbox Modal
// ════════════════════════════════════════════════════════════════════════
const ImageLightbox: React.FC<{
  imageUrl: string;
  filename: string;
  isOpen: boolean;
  onClose: () => void;
}> = ({ imageUrl, filename, isOpen, onClose }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'image';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Download started', { icon: '📥' });
    } catch {
      toast.error('Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 bg-black/95 border-0">
        <div className="relative">
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-4 right-16 z-10 text-white hover:bg-white/20"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Download className="h-6 w-6" />
            )}
          </Button>
          <img
            src={imageUrl}
            alt={filename}
            className="w-full h-auto max-h-[85vh] object-contain"
          />
          {filename && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <p className="text-white text-sm">{filename}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ════════════════════════════════════════════════════════════════════════
// Enhanced Media Renderer with Lightbox & Download
// ════════════════════════════════════════════════════════════════════════
const MediaRenderer: React.FC<{ media: any }> = ({ media }) => {
  const [showLightbox, setShowLightbox] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isImage = media.type === 'image';
  const isVideo = media.type === 'video';
  const isDocument = !isImage && !isVideo;

  const getFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(mb * 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`;
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      const response = await fetch(media.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = media.filename || 'download';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Download started', { icon: '📥' });
    } catch {
      toast.error('Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isImage) {
    return (
      <>
        <div
          className="relative group cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => setShowLightbox(true)}
        >
          <img
            src={media.url}
            alt={media.filename || 'Image'}
            className="max-w-full rounded-xl transition-all duration-300 hover:shadow-2xl"
          />
          {/* Overlay with actions */}
          <div
            className={`absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center gap-3 transition-opacity duration-200 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Button
              size="icon"
              variant="secondary"
              className="bg-white/90 hover:bg-white"
              onClick={(e) => {
                e.stopPropagation();
                setShowLightbox(true);
              }}
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="bg-white/90 hover:bg-white"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
        <ImageLightbox
          imageUrl={media.url}
          filename={media.filename}
          isOpen={showLightbox}
          onClose={() => setShowLightbox(false)}
        />
      </>
    );
  }

  if (isVideo) {
    return (
      <div className="relative group">
        <video
          src={media.url}
          controls
          className="max-w-full rounded-xl shadow-lg"
          style={{ maxHeight: '400px' }}
        />
        <Button
          size="icon"
          variant="secondary"
          className="absolute top-3 right-3 bg-white/90 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Download className="h-5 w-5" />
          )}
        </Button>
      </div>
    );
  }

  if (isDocument) {
    return (
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-200 dark:border-slate-600 p-4 flex items-center gap-4 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer group"
        onClick={handleDownload}
      >
        <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-500 rounded-lg group-hover:from-blue-500 group-hover:to-blue-400 transition-all">
          <FileText className="h-8 w-8 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{media.filename || 'Document'}</p>
          <p className="text-xs text-gray-500 mt-1">
            {getFileSize(media.file_size)} • {media.file_type || 'File'}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0"
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Download className="h-5 w-5" />
          )}
        </Button>
      </div>
    );
  }

  return null;
};

// ════════════════════════════════════════════════════════════════════════
// Enhanced Shared Document Preview
// ════════════════════════════════════════════════════════════════════════
const SharedDocumentPreview: React.FC<{
  documentId: string;
  currentUserId: string;
}> = ({ documentId, currentUserId }) => {
  const [doc, setDoc] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  useEffect(() => {
    supabase
      .from('documents')
      .select('title, file_name, file_url, file_type, file_size')
      .eq('id', documentId)
      .single()
      .then(({ data }) => setDoc(data));
  }, [documentId]);

  const handleAddToMyDocuments = async () => {
    if (!doc || isAdded) return;
    setIsAdding(true);
    try {
      const { data: existing } = await supabase
        .from('documents')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('file_url', doc.file_url)
        .maybeSingle();

      if (existing) {
        toast.info('You already have this document');
        setIsAdded(true);
        return;
      }

      const { error } = await supabase.from('documents').insert({
        user_id: currentUserId,
        title: doc.title || doc.file_name,
        file_name: doc.file_name,
        file_url: doc.file_url,
        file_type: doc.file_type,
        file_size: doc.file_size,
        type: 'uploaded',
      });

      if (error) throw error;

      setIsAdded(true);
      toast.success('Document saved to your library!', { icon: '✨' });
    } catch {
      toast.error('Failed to save document');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDownload = async () => {
    if (!doc?.file_url) return;
    setIsDownloading(true);
    try {
      const response = await fetch(doc.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name || 'download';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Download started', { icon: '📥' });
    } catch {
      toast.error('Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!doc) {
    return (
      <div className="bg-gray-200 dark:bg-slate-700 rounded-xl h-24 animate-pulse" />
    );
  }

  const fileSizeMB = doc.file_size ? (doc.file_size / 1024 / 1024).toFixed(1) : '?';
  
  // Check if the document is an image
  const isImage = doc.file_type?.startsWith('image/') || 
    /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(doc.file_name || '');

  // If it's an image, show it with a preview
  if (isImage) {
    return (
      <>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-200 dark:border-slate-600 hover:shadow-xl transition-all duration-200 overflow-hidden">
          {/* Image Preview */}
          <div 
            className="relative group cursor-pointer"
            onClick={() => setShowLightbox(true)}
          >
            <img
              src={doc.file_url}
              alt={doc.title || doc.file_name}
              className="w-full h-48 object-cover"
            />
            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
              <Button
                size="icon"
                variant="secondary"
                className="bg-white/90 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLightbox(true);
                }}
              >
                <ZoomIn className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="bg-white/90 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
          
          {/* Document Info */}
          <div className="p-4 flex items-center gap-4">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-500 rounded-lg">
              <ImageIcon className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{doc.title || doc.file_name}</p>
              <p className="text-xs text-gray-500">{fileSizeMB} MB • Image</p>
            </div>
            <Button
              size="icon"
              variant={isAdded ? 'default' : 'ghost'}
              className={isAdded ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-blue-50 dark:hover:bg-slate-700'}
              onClick={handleAddToMyDocuments}
              disabled={isAdding || isAdded}
            >
              {isAdding ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isAdded ? (
                <CheckCircle className="h-5 w-5 text-white" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Lightbox for image viewing */}
        <ImageLightbox
          imageUrl={doc.file_url}
          filename={doc.file_name || 'Image'}
          isOpen={showLightbox}
          onClose={() => setShowLightbox(false)}
        />
      </>
    );
  }

  // For non-image documents, show the standard card
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 border border-gray-200 dark:border-slate-600 hover:shadow-xl transition-all duration-200">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-500 rounded-lg">
          <FileText className="h-8 w-8 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{doc.title || doc.file_name}</p>
          <p className="text-xs text-gray-500">{fileSizeMB} MB • {doc.file_type}</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDownload}
            disabled={isDownloading}
            className="hover:bg-blue-50 dark:hover:bg-slate-700"
          >
            {isDownloading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
          </Button>
          <Button
            size="icon"
            variant={isAdded ? 'default' : 'ghost'}
            className={isAdded ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-blue-50 dark:hover:bg-slate-700'}
            onClick={handleAddToMyDocuments}
            disabled={isAdding || isAdded}
          >
            {isAdding ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isAdded ? (
              <CheckCircle className="h-5 w-5 text-white" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Other previews (Post & Note)
const SharedPostPreview: React.FC<{ postId: string; onClick: () => void }> = ({ postId, onClick }) => {
  const [post, setPost] = useState<any>(null);
  useEffect(() => {
    supabase
      .from('social_posts')
      .select(`*, author:social_users(display_name, avatar_url, username), media:social_media(*)`)
      .eq('id', postId)
      .single()
      .then(({ data }) => setPost(data));
  }, [postId]);

  if (!post) return <div className="bg-gray-200 dark:bg-slate-700 rounded-xl h-32 animate-pulse" />;

  return (
    <Card className="overflow-hidden border-0 shadow-md cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-[1.02]" onClick={onClick}>
      <CardContent className="p-3">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author?.avatar_url} />
            <AvatarFallback>{post.author?.display_name?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{post.author?.display_name}</p>
            <p className="text-xs text-gray-500">@{post.author?.username}</p>
          </div>
        </div>
        <p className="mt-3 text-sm line-clamp-3">{post.content}</p>
        {post.media?.[0]?.type === 'image' && (
          <img src={post.media[0].url} alt="" className="mt-3 rounded-lg w-full max-h-48 object-cover" />
        )}
      </CardContent>
    </Card>
  );
};

const SharedNotePreview: React.FC<{ noteId: string; onClick: () => void }> = ({ noteId, onClick }) => {
  const [note, setNote] = useState<any>(null);
  useEffect(() => {
    supabase.from('notes').select('title').eq('id', noteId).single().then(({ data }) => setNote(data));
  }, [noteId]);

  return (
    <div
      onClick={onClick}
      className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 rounded-xl border border-amber-300 dark:border-amber-700 cursor-pointer hover:scale-105 transition-all duration-200 hover:shadow-lg"
    >
      <div className="flex items-center gap-3">
        <StickyNote className="h-8 w-8 text-amber-600" />
        <div>
          <p className="font-bold text-amber-900 dark:text-amber-100">Shared Note</p>
          <p className="text-sm text-amber-700 dark:text-amber-300">{note?.title || 'Untitled Note'}</p>
        </div>
        <Plus className="h-7 w-7 ml-auto text-amber-600" />
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════
// Date Separator Component
// ════════════════════════════════════════════════════════════════════════
const DateSeparator: React.FC<{ date: string }> = ({ date }) => (
  <div className="flex items-center justify-center my-6">
    <div className="bg-gray-200 dark:bg-slate-700 rounded-full px-4 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 shadow-sm">
      {date}
    </div>
  </div>
);

export const ChatWindow: React.FC<ChatWindowProps> = ({
  session,
  messages,
  currentUserId,
  onBack,
  onSendMessage,
  onSendMessageWithResource,
  isSending,
  isLoading,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showNoteShare, setShowNoteShare] = useState(false);
  const navigate = useNavigate();

  const [addNoteDialogOpen, setAddNoteDialogOpen] = useState(false);
  const [noteToAdd, setNoteToAdd] = useState<{ id: string; title: string; content: string } | null>(null);
  const [newNoteTitle, setNewNoteTitle] = useState('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center text-gray-500">
          <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Select a conversation</p>
          <p className="text-sm">Choose a chat to start messaging</p>
        </div>
      </div>
    );
  }

  const getChatTitle = () => {
    if (session.chat_type === 'group') return session.group?.name || 'Group Chat';
    const otherUser = session.user_id1 === currentUserId ? session.user2 : session.user1;
    return otherUser?.display_name || 'Unknown User';
  };

  const handleShareNote = async (content: string, resourceId: string, resourceType: 'note' | 'document') => {
    const success = await onSendMessageWithResource(content, resourceId, resourceType);
    if (success) setShowNoteShare(false);
  };

  const handleAddSharedNote = async () => {
    if (!noteToAdd || !currentUserId) return;
    try {
      const { error } = await supabase.from('notes').insert({
        user_id: currentUserId,
        title: newNoteTitle || noteToAdd.title,
        content: noteToAdd.content,
      });
      if (error) throw error;
      toast.success('Note added to your collection!', { icon: '✨' });
      setAddNoteDialogOpen(false);
      setNoteToAdd(null);
      setNewNoteTitle('');
    } catch {
      toast.error('Failed to save note');
    }
  };

  const renderResource = (resource: any) => {
    switch (resource.resource_type) {
      case 'post':
        return <SharedPostPreview postId={resource.resource_id} onClick={() => navigate(`/social/post/${resource.resource_id}`)} />;
      case 'note':
        return (
          <SharedNotePreview
            noteId={resource.resource_id}
            onClick={async () => {
              const { data } = await supabase
                .from('notes')
                .select('title, content')
                .eq('id', resource.resource_id)
                .single();
              if (data) {
                setNoteToAdd({ id: resource.resource_id, title: data.title, content: data.content });
                setNewNoteTitle(data.title);
                setAddNoteDialogOpen(true);
              }
            }}
          />
        );
      case 'document':
        return <SharedDocumentPreview documentId={resource.resource_id} currentUserId={currentUserId} />;
      default:
        return null;
    }
  };

  // Group messages by date
  const getMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <>
      <div className={`flex flex-col h-full ${theme.background}  w-full border-l border-gray-200 dark:border-slate-700`}>
        {/* Enhanced Header */}
        <div className={`${theme.header} text-white p-4 flex items-center gap-3 shadow-lg`}>
          <Button variant="ghost" size="icon" onClick={onBack} className="lg:hidden text-white hover:bg-white/20">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <Avatar className="h-12 w-12 ring-4 ring-white/30 shadow-lg">
            <AvatarImage
              src={
                session.chat_type === 'group'
                  ? session.group?.avatar_url
                  : session.user_id1 === currentUserId
                  ? session.user2?.avatar_url
                  : session.user1?.avatar_url
              }
            />
            <AvatarFallback className="bg-white/20 text-white text-lg font-semibold">
              {getChatTitle()[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{getChatTitle()}</h3>
            <p className="text-sm opacity-90">{session.user1.last_active}</p>
          </div>
        </div>

        {/* Messages with smooth animations */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                <p className="text-sm text-gray-500">Loading messages...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="font-medium">No messages yet</p>
              <p className="text-sm">Say hello to start the conversation! 👋</p>
            </div>
          ) : (
            <>
              {messages.map((message, index) => {
                const isOwn = message.sender_id === currentUserId;
                const showAvatar = !isOwn && (index === 0 || messages[index - 1].sender_id !== message.sender_id);
                const showDateSeparator = index === 0 || 
                  getMessageDate(messages[index - 1].created_at) !== getMessageDate(message.created_at);
                const isConsecutive = index > 0 && 
                  messages[index - 1].sender_id === message.sender_id &&
                  new Date(message.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() < 60000;

                return (
                  <React.Fragment key={message.id}>
                    {showDateSeparator && <DateSeparator date={getMessageDate(message.created_at)} />}
                    
                    <div
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-2 animate-in slide-in-from-bottom-2 duration-300`}
                      style={{ marginTop: isConsecutive ? '2px' : '12px' }}
                    >
                      <div className={`flex max-w-sm lg:max-w-md gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                        {!isOwn && showAvatar && (
                          <Avatar className="h-8 w-8 mt-auto">
                            <AvatarImage src={message.sender?.avatar_url} />
                            <AvatarFallback>{message.sender?.display_name?.[0]}</AvatarFallback>
                          </Avatar>
                        )}
                        {!isOwn && !showAvatar && <div className="w-8" />}

                        <div
                          className={`relative rounded-2xl px-4 py-2.5 shadow-md max-w-52 transition-all duration-200 hover:shadow-lg ${
                            isOwn ? theme.ownBubble : theme.otherBubble
                          } ${isOwn ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                        >
                          {/* Shared Resources */}
                          {message.resources?.length > 0 && (
                            <div className="mb-3 space-y-3">
                              {message.resources.map((res: any) => (
                                <div key={res.id}>{renderResource(res)}</div>
                              ))}
                            </div>
                          )}

                          {/* Attached Media */}
                          {message.media?.length > 0 && (
                            <div className="mb-2 space-y-3">
                              {message.media.map((m: any) => (
                                <MediaRenderer key={m.id} media={m} />
                              ))}
                            </div>
                          )}

                          {/* Text Message */}
                          {message.content && (
                            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                              {message.content}
                            </p>
                          )}

                          {/* Timestamp */}
                          <div className={`flex items-center gap-1 mt-1 text-xs ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                            <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            
                          </div>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <MessageInput
          onSendMessage={onSendMessage}
          onShareNote={() => setShowNoteShare(true)}
          isSending={isSending}
        />
      </div>

      {/* Note Share Dialog */}
      <NoteShareDialog
        isOpen={showNoteShare}
        onClose={() => setShowNoteShare(false)}
        onShare={handleShareNote}
        currentUserId={currentUserId}
      />

      {/* Add Note Dialog */}
      <Dialog open={addNoteDialogOpen} onOpenChange={setAddNoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-amber-600" />
              Add Note to Your Collection
            </DialogTitle>
            <DialogDescription>Save this shared note to your personal notes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="note-title" className="text-sm font-medium">
                Title
              </Label>
              <Input
                id="note-title"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder="Enter note title"
                className="mt-2"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Preview</Label>
              <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm max-h-40 overflow-y-auto border border-amber-200 dark:border-amber-800">
                {noteToAdd?.content?.slice(0, 300)}
                {noteToAdd?.content && noteToAdd.content.length > 300 && '...'}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSharedNote} className="bg-amber-600 hover:bg-amber-700">
              <Plus className="h-4 w-4 mr-2" />
              Add to My Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};