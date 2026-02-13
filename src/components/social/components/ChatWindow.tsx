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
  MoreVertical,
  Edit as EditIcon,
  Trash2,
  Copy as CopyIcon,
  Check,
  Sparkle,
  Video,
  Clock,
  Calendar
} from 'lucide-react';
import { renderContentWithClickableLinks } from '../utils/postUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../ui/dialog';
import { useConfirmDialog } from '../../ui/confirm-dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { ChatSessionWithDetails, ChatMessageWithDetails } from '../types/social';
import { MessageInput } from './MessageInput';
import { ResourceSharingModal } from './ResourceSharingModal';
import { supabase } from '../../../integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';


interface ChatWindowProps {
  session: ChatSessionWithDetails | null;
  messages: ChatMessageWithDetails[];
  currentUserId: string;
  onBack: () => void;
  onSendMessage: (content: string, files?: File[]) => Promise<boolean>; // Keep as boolean for now
  onSendMessageWithResource: (
    content: string,
    resourceId: string,
    resourceType: 'note' | 'document' | 'post' | 'class_recording'
  ) => Promise<boolean>; // Keep as boolean for now
  isSending: boolean;
  isLoading: boolean;
  editMessage: (messageId: string, newContent: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  addOptimisticMessage?: (message: ChatMessageWithDetails) => void; // ADD THIS
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
      toast.success('Download started', { icon: 'Download' });
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
            {isDownloading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Download className="h-6 w-6" />}
          </Button>
          <img src={imageUrl} alt={filename} className="w-full h-auto max-h-[85vh] object-contain" />
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
// Media Renderer (Images, Videos, Documents)
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
      toast.success('Download started', { icon: 'Download' });
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
            className="max-w-full rounded-xl  hover:shadow-2xl"
          />
          <div
            className={`absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center gap-3 duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'
              }`}
          >
            <Button size="icon" variant="secondary" className="bg-white/90 hover:bg-white">
              <ZoomIn className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="bg-white/90 hover:bg-white"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
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
        <video src={media.url} controls className="max-w-full rounded-xl shadow-lg" style={{ maxHeight: '400px' }} />
        <Button
          size="icon"
          variant="secondary"
          className="absolute top-3 right-3 bg-white/90 hover:bg-white opacity-0 group-hover:opacity-100 "
          onClick={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
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
        <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-500 rounded-lg group-hover:from-blue-500 group-hover:to-blue-400 ">
          <FileText className="h-8 w-8 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{media.filename || 'Document'}</p>
          <p className="text-xs text-gray-500 mt-1">
            {getFileSize(media.file_size)} • {media.file_type || 'File'}
          </p>
        </div>
        <Button size="icon" variant="ghost" className="shrink-0" disabled={isDownloading}>
          {isDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
        </Button>
      </div>
    );
  }

  return null;
};

// ════════════════════════════════════════════════════════════════════════
// Shared Document Preview
// ════════════════════════════════════════════════════════════════════════
const SharedDocumentPreview: React.FC<{ documentId: string; currentUserId: string }> = ({ documentId, currentUserId }) => {
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

      const { data: response, error } = await supabase.functions.invoke('save-shared-resource', {
        body: {
          resource_type: 'document',
          resource_data: {
            title: doc.title || doc.file_name,
            file_name: doc.file_name,
            file_url: doc.file_url,
            file_type: doc.file_type,
            file_size: doc.file_size,
          }
        },
      });

      if (error || !response?.success) {
        if (response?.message) {
          toast.error(response.message);
          return;
        }
        throw new Error('Failed to save document');
      }

      setIsAdded(true);
      toast.success('Document saved to your library!', { icon: 'Sparkle' });
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
      toast.success('Download started', { icon: 'Download' });
    } catch {
      toast.error('Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!doc) return <div className="bg-gray-200 dark:bg-slate-700 rounded-xl h-24 animate-pulse" />;

  const fileSizeMB = doc.file_size ? (doc.file_size / 1024 / 1024).toFixed(1) : '?';
  const isImage = doc.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(doc.file_name || '');

  if (isImage) {
    return (
      <>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-200 dark:border-slate-600 hover:shadow-xl  overflow-hidden">
          <div className="relative group cursor-pointer" onClick={() => setShowLightbox(true)}>
            <img src={doc.file_url} alt={doc.title || doc.file_name} className="w-full h-48 object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0   flex items-center justify-center gap-3">
              <Button size="icon" variant="secondary" className="bg-white/90 hover:bg-white">
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
                {isDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              </Button>
            </div>
          </div>
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
              {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : isAdded ? <CheckCircle className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        <ImageLightbox imageUrl={doc.file_url} filename={doc.file_name || 'Image'} isOpen={showLightbox} onClose={() => setShowLightbox(false)} />
      </>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 border border-gray-200 dark:border-slate-600 hover:shadow-xl ">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-500 rounded-lg">
          <FileText className="h-8 w-8 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{doc.title || doc.file_name}</p>
          <p className="text-xs text-gray-500">{fileSizeMB} MB • {doc.file_type}</p>
        </div>
        <div className="flex gap-2">
          <Button size="icon" variant="ghost" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          </Button>
          <Button
            size="icon"
            variant={isAdded ? 'default' : 'ghost'}
            className={isAdded ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-blue-50 dark:hover:bg-slate-700'}
            onClick={handleAddToMyDocuments}
            disabled={isAdding || isAdded}
          >
            {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : isAdded ? <CheckCircle className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Shared Post & Note Previews
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
      className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-900 dark:to-gray-900/60 rounded-xl cursor-pointer "
    >
      <div className="flex items-center gap-3">
        <StickyNote className="h-8 w-8 text-amber-600" />
        <div>
          <p className="font-bold text-amber-900 dark:text-amber-100">Shared Note</p>
          <p className="text-sm text-amber-700  dark:text-amber-300">{note?.title || 'Untitled Note'}</p>
        </div>
        <Plus className="h-7 w-7 ml-auto text-amber-600" />
      </div>
    </div>
  );
};

// Shared Class Recording Preview
const SharedClassRecordingPreview: React.FC<{ recordingId: string; currentUserId: string }> = ({ recordingId, currentUserId }) => {
  const [recording, setRecording] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);

  useEffect(() => {
    supabase
      .from('class_recordings')
      .select('id, title, summary, audio_url, duration, subject, date')
      .eq('id', recordingId)
      .single()
      .then(({ data }) => setRecording(data));
  }, [recordingId]);

  const handleAddToMyRecordings = async () => {
    if (!recording || isAdded) return;
    setIsAdding(true);
    try {
      const { data: response, error } = await supabase.functions.invoke('save-shared-resource', {
        body: {
          resource_type: 'class_recording',
          resource_data: {
            source_recording_id: recording.id,
            title: recording.title,
            summary: recording.summary,
            audio_url: recording.audio_url,
            duration: recording.duration,
            subject: recording.subject,
            date: recording.date,
          }
        },
      });

      if (error || !response?.success) {
        if (response?.duplicate) {
          toast.info('You already have this recording');
          setIsAdded(true);
          return;
        }
        throw new Error('Failed to save recording');
      }

      setIsAdded(true);
      toast.success('Recording saved to your library!');
    } catch {
      toast.error('Failed to save recording');
    } finally {
      setIsAdding(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!recording) return <div className="bg-gray-200 dark:bg-slate-700 rounded-xl h-24 animate-pulse" />;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-200 dark:border-slate-600 hover:shadow-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-br from-purple-600 to-purple-500 rounded-lg">
            <Video className="h-8 w-8 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm mb-1">{recording.title}</p>
            {recording.summary && (
              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">{recording.summary}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {recording.subject && (
                <Badge variant="secondary" className="text-xs">
                  {recording.subject}
                </Badge>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(recording.duration)}
              </span>
              {recording.date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(recording.date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <Button
            size="icon"
            variant={isAdded ? 'default' : 'ghost'}
            className={isAdded ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-blue-50 dark:hover:bg-slate-700'}
            onClick={handleAddToMyRecordings}
            disabled={isAdding || isAdded}
          >
            {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : isAdded ? <CheckCircle className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5" />}
          </Button>
        </div>
        {recording.audio_url && (
          <div className="mt-3">
            <audio
              controls
              className="w-full"
              src={recording.audio_url}
            >
              Your browser does not support audio playback.
            </audio>
          </div>
        )}
      </div>
    </div>
  );
};

// Date Separator
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
  editMessage,
  deleteMessage, // ADD THIS
  addOptimisticMessage: onOptimisticMessage, // ADD THIS
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showResourceSharing, setShowResourceSharing] = useState(false);
  const [addNoteDialogOpen, setAddNoteDialogOpen] = useState(false);
  const [userNotes, setUserNotes] = useState<any[]>([]);
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [userClassRecordings, setUserClassRecordings] = useState<any[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [notesOffset, setNotesOffset] = useState(0);
  const [documentsOffset, setDocumentsOffset] = useState(0);
  const [recordingsOffset, setRecordingsOffset] = useState(0);
  const [hasMoreNotes, setHasMoreNotes] = useState(true);
  const [hasMoreDocuments, setHasMoreDocuments] = useState(true);
  const [hasMoreRecordings, setHasMoreRecordings] = useState(true);
  const ITEMS_PER_PAGE = 20;
  const [noteToAdd, setNoteToAdd] = useState<{ id: string; title: string; content: string } | null>(null);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch user resources when modal opens
  useEffect(() => {
    if (showResourceSharing && !isLoadingResources && userNotes.length === 0) {
      const fetchResources = async () => {
        setIsLoadingResources(true);
        try {
          const { data: response, error } = await supabase.functions.invoke('get-user-resources', {
            body: { resource_type: 'all', offset: 0, limit: ITEMS_PER_PAGE },
          });

          if (error || !response?.success) throw new Error('Failed to load resources');

          if (response.notes) {
            setUserNotes(response.notes);
            setHasMoreNotes(response.has_more_notes);
            setNotesOffset(ITEMS_PER_PAGE);
          }
          if (response.documents) {
            setUserDocuments(response.documents);
            setHasMoreDocuments(response.has_more_documents);
            setDocumentsOffset(ITEMS_PER_PAGE);
          }
          if (response.class_recordings) {
            setUserClassRecordings(response.class_recordings);
            setHasMoreRecordings(response.has_more_recordings);
            setRecordingsOffset(ITEMS_PER_PAGE);
          }
        } catch (error) {
          //console.error('Error fetching resources:', error);
          toast.error('Failed to load resources');
        } finally {
          setIsLoadingResources(false);
        }
      };
      fetchResources();
    }
  }, [showResourceSharing, currentUserId, isLoadingResources, userNotes.length, ITEMS_PER_PAGE]);

  const getChatTitle = () => {
    if (!session) return 'Chat';
    if (session.chat_type === 'group') return session.group?.name || 'Group Chat';
    const otherUser = session.user_id1 === currentUserId ? session.user2 : session.user1;
    return otherUser?.display_name || 'Unknown User';
  };

  const getOnlineStatus = () => {
    if (session?.chat_type === 'group') return null;
    const otherUser = session?.user_id1 === currentUserId ? session.user2 : session.user1;
    if (!otherUser?.last_active) return null;

    const lastActive = new Date(otherUser.last_active);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60));

    if (diffMinutes < 5) return { status: 'online', text: 'Active now', color: 'bg-green-500' };
    if (diffMinutes < 30) return { status: 'away', text: `Active ${diffMinutes}m ago`, color: 'bg-yellow-500' };
    if (diffMinutes < 60) return { status: 'offline', text: `Active ${diffMinutes}m ago`, color: 'bg-gray-400' };
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return { status: 'offline', text: `Active ${diffHours}h ago`, color: 'bg-gray-400' };
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return { status: 'offline', text: `Active ${diffDays}d ago`, color: 'bg-gray-400' };
    return { status: 'offline', text: 'Active a while ago', color: 'bg-gray-400' };
  };

  const onlineStatus = getOnlineStatus();

  const loadMoreNotes = async () => {
    if (isLoadingMore || !hasMoreNotes) return;
    setIsLoadingMore(true);
    try {
      const { data: response, error } = await supabase.functions.invoke('get-user-resources', {
        body: { resource_type: 'notes', offset: notesOffset, limit: ITEMS_PER_PAGE },
      });

      if (!error && response?.notes) {
        setUserNotes(prev => [...prev, ...response.notes]);
        setHasMoreNotes(response.has_more_notes);
        setNotesOffset(prev => prev + ITEMS_PER_PAGE);
      }
    } catch (error) {
      //console.error('Error loading more notes:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const loadMoreDocuments = async () => {
    if (isLoadingMore || !hasMoreDocuments) return;
    setIsLoadingMore(true);
    try {
      const { data: response, error } = await supabase.functions.invoke('get-user-resources', {
        body: { resource_type: 'documents', offset: documentsOffset, limit: ITEMS_PER_PAGE },
      });

      if (!error && response?.documents) {
        setUserDocuments(prev => [...prev, ...response.documents]);
        setHasMoreDocuments(response.has_more_documents);
        setDocumentsOffset(prev => prev + ITEMS_PER_PAGE);
      }
    } catch (error) {
      //console.error('Error loading more documents:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const loadMoreRecordings = async () => {
    if (isLoadingMore || !hasMoreRecordings) return;
    setIsLoadingMore(true);
    try {
      const { data: response, error } = await supabase.functions.invoke('get-user-resources', {
        body: { resource_type: 'class_recordings', offset: recordingsOffset, limit: ITEMS_PER_PAGE },
      });

      if (!error && response?.class_recordings) {
        setUserClassRecordings(prev => [...prev, ...response.class_recordings]);
        setHasMoreRecordings(response.has_more_recordings);
        setRecordingsOffset(prev => prev + ITEMS_PER_PAGE);
      }
    } catch (error) {
      //console.error('Error loading more recordings:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleShareResource = async (resourceId: string, resourceType: 'note' | 'document' | 'class_recording', message?: string): Promise<boolean> => {
    const success = await onSendMessageWithResource(message || '', resourceId, resourceType);
    if (success) {
      setShowResourceSharing(false);
      toast.success('Resource shared successfully');
    }
    return success;
  };
  const handleSendMessage = async (content: string, files?: File[]) => {
    const success = await onSendMessage(content, files);
    return success;
  };

  const handleAddSharedNote = async () => {
    if (!noteToAdd || !currentUserId) return;
    try {
      const { data: response, error } = await supabase.functions.invoke('save-shared-resource', {
        body: {
          resource_type: 'note',
          resource_data: {
            title: newNoteTitle || noteToAdd.title,
            content: noteToAdd.content,
          }
        },
      });

      if (error || !response?.success) {
        if (response?.message) {
          toast.error(response.message);
          return;
        }
        throw new Error('Failed to save note');
      }

      toast.success('Note added to your collection!', { icon: 'Sparkle' });
      setAddNoteDialogOpen(false);
      setNoteToAdd(null);
      setNewNoteTitle('');
    } catch {
      toast.error('Failed to save note');
    }
  };

  const startEdit = (message: ChatMessageWithDetails) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content || '');
  };

  const saveEdit = async () => {
    if (!editingMessageId || !editingContent.trim()) return;
    const success = await editMessage(editingMessageId, editingContent.trim());
    if (success) {
      setEditingMessageId(null);
      setEditingContent('');
    }
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
    //console.log('Copied message:', content);
  };

  const { confirm: confirmAction, ConfirmDialogComponent } = useConfirmDialog();

  const confirmDelete = async (messageId: string) => {
    const confirmed = await confirmAction({
      title: 'Delete Message',
      description: 'Delete this message? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!confirmed) return;
    await deleteMessage(messageId);
  };

  const renderResource = (resource: any) => {
    switch (resource.resource_type) {
      case 'post':
        return <SharedPostPreview postId={resource.resource_id} onClick={() => { navigate(`/social/post/${resource.resource_id}`); onBack(); }} />;
      case 'note':
        return (
          <SharedNotePreview
            noteId={resource.resource_id}
            onClick={async () => {
              const { data } = await supabase.from('notes').select('title, content').eq('id', resource.resource_id).single();
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
      case 'class_recording':
        return <SharedClassRecordingPreview recordingId={resource.resource_id} currentUserId={currentUserId} />;
      default:
        return null;
    }
  };

  const getMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

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

  return (
    <>
      <div className={`flex flex-col h-full w-full ${theme.background}`}>
        {/* Header */}
        <div className={`${theme.header} text-white p-4 flex items-center gap-3 shadow-lg`}>
          <Button variant="outline" size="icon" onClick={onBack} className="dark:text-white border-white/30 hover:bg-white/20 bg-transparent">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="relative" onClick={() => { onBack(); navigate(`/social/profile/${session.chat_type === 'group' ? session.group?.id : session.user_id1 === currentUserId ? session.user2?.id : session.user1?.id}`); }}>
            <Avatar className="h-12 w-12 ring-4 ring-white/30 shadow-lg cursor-pointer">
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
            {onlineStatus && (
              <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 ${onlineStatus.color} rounded-full ring-2 ring-white shadow-lg`} />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{getChatTitle()}</h3>
            {onlineStatus ? (
              <div className="flex items-center gap-1.5">
                <p className="text-sm opacity-90">{onlineStatus.text}</p>
                {onlineStatus.status === 'online' && (
                  <span className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm opacity-90">
                {session.chat_type === 'group' ? `${session.group?.members_count || 0} members` : 'Direct message'}
              </p>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-0 py-4 space-y-1">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="font-medium">No messages yet</p>
              <p className="text-sm">Say hello to start the conversation!</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isOwn = message.sender_id === currentUserId;
              const showAvatar = !isOwn && (index === 0 || messages[index - 1].sender_id !== message.sender_id);
              const showDateSeparator = index === 0 || getMessageDate(messages[index - 1].created_at) !== getMessageDate(message.created_at);
              const isConsecutive = index > 0 && messages[index - 1].sender_id === message.sender_id && new Date(message.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() < 60000;

              return (
                <React.Fragment key={message.id}>
                  {showDateSeparator && <DateSeparator date={getMessageDate(message.created_at)} />}

                  <div
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-2 animate-in slide-in-from-bottom-2 duration-300`}
                    style={{ marginTop: isConsecutive ? '8px' : '12px' }}
                  >
                    <div className={`flex max-w-52 gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                      {!isOwn && showAvatar && (
                        <Avatar className="h-8 w-8 mt-auto">
                          <AvatarImage src={message.sender?.avatar_url} />
                          <AvatarFallback>{message.sender?.display_name?.[0]}</AvatarFallback>
                        </Avatar>
                      )}
                      {!isOwn && !showAvatar && <div className="w-8" />}

                      <div
                        className={`relative px-0 py-0 rounded-xl max-w-full  group ${isOwn ? theme.ownBubble : theme.otherBubble} ${isOwn ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                      >
                        {/* Resources & Media */}
                        {message.resources?.length > 0 && (
                          <div className="mb-3 space-y-3">
                            {message.resources.map((res: any) => (
                              <div key={res.id}>{renderResource(res)}</div>
                            ))}
                          </div>
                        )}
                        {message.media?.length > 0 && (
                          <div className="mb-2 space-y-3">
                            {message.media.map((m: any) => (
                              <MediaRenderer key={m.id} media={m} />
                            ))}
                          </div>
                        )}

                        {/* Message Content or Edit Input */}
                        {editingMessageId === message.id ? (
                          <div className="flex flex-col gap-2 ">
                            <Input
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), saveEdit())}
                              autoFocus
                              className="bg-slate-500 dark:bg-slate-800"
                            />
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
                              <Button size="sm" onClick={saveEdit}>Save</Button>
                            </div>
                          </div>
                        ) : (
                          message.content && (
                            <div className="text-sm whitespace-pre-wrap px-2 break-words leading-relaxed">
                              {renderContentWithClickableLinks(message.content)}
                            </div>
                          )
                        )}

                        {/* Timestamp + Actions */}
                        <div className={`flex items-center justify-between px-2 mt-1 text-xs ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                          <div className="flex items-center gap-1">
                            <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {message.is_edited && <span className="italic">edited</span>}
                            {isOwn && message.is_read && <Check className="h-3 w-3" />}
                          </div>

                          {isOwn && editingMessageId !== message.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => startEdit(message)}>
                                  <EditIcon className="h-4 w-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => copyMessage(message.content || '')}>
                                  <CopyIcon className="h-4 w-4 mr-2" /> Copy
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={() => confirmDelete(message.id)}>
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          onShareNote={() => setShowResourceSharing(true)}
          isSending={isSending}
        />
      </div>

      {/* Dialogs */}
      <ResourceSharingModal
        isOpen={showResourceSharing}
        onClose={() => setShowResourceSharing(false)}
        onShareResource={handleShareResource}
        notes={userNotes}
        documents={userDocuments}
        classRecordings={userClassRecordings}
        isSharing={isSending}
        isLoading={isLoadingResources}
        onLoadMoreNotes={loadMoreNotes}
        onLoadMoreDocuments={loadMoreDocuments}
        onLoadMoreRecordings={loadMoreRecordings}
        hasMoreNotes={hasMoreNotes}
        hasMoreDocuments={hasMoreDocuments}
        hasMoreRecordings={hasMoreRecordings}
        isLoadingMore={isLoadingMore}
      />

      <Dialog open={addNoteDialogOpen} onOpenChange={setAddNoteDialogOpen}>
        <DialogContent className="sm:max-w-md z-50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-amber-600" />
              Add Note to Your Collection
            </DialogTitle>
            <DialogDescription>Save this shared note to your personal notes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder="Enter note title"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Preview</Label>
              <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm max-h-40 overflow-y-auto border border-amber-200 dark:border-amber-800">
                {noteToAdd?.content?.slice(0, 300)}
                {noteToAdd?.content && noteToAdd.content.length > 300 && '...'}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddNoteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSharedNote} className="bg-amber-600 hover:bg-amber-700">
              <Plus className="h-4 w-4 mr-2" />
              Add to My Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ConfirmDialogComponent}
    </>
  );
};