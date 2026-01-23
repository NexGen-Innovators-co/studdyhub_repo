// src/components/aiChat/PodcastGenerator.tsx - Complete with fixed types
import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import {
  Podcast,
  Loader2,
  X,
  Sparkles,
  CheckCircle2,
  XCircle,
  Award,
  Headphones,
  Image as ImageIcon,
  Video,
  Radio,
  FileText,
  File
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { checkPodcastCreationEligibility } from '@/services/podcastModerationService';
import { Link } from 'react-router-dom';

// Unified types matching database schema
export interface AudioSegment {
  speaker: string;
  audioContent?: string;
  text: string;
  index: number;
  audio_url?: string;
  start_time?: number;
  end_time?: number;
}

export interface VisualAsset {
  type: 'image' | 'video';
  concept: string;
  description: string;
  url: string;
  timestamp: number | null;
  segmentIndex?: number;
}

export interface PodcastData {
  id: string;
  title: string;
  description?: string | null;
  script?: string;
  audioSegments?: AudioSegment[];
  duration?: number;
  sources?: string[];
  style?: string;
  created_at?: string;
  podcast_type?: 'audio' | 'image-audio' | 'video' | 'live-stream' | null;
  visual_assets?: VisualAsset[] | null;
  cover_image_url?: string | null;
  is_live?: boolean | null;
  tags?: string[] | null;
  listen_count?: number | null;
  share_count?: number | null;
  user_id?: string;
  user?: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
    username?: string | null;
  };
  is_public?: boolean | null;
  audio_url?: string | null;
}

interface PodcastGeneratorProps {
  selectedNoteIds?: string[];
  selectedDocumentIds?: string[];
  onClose?: () => void;
  onPodcastGenerated?: (podcast: PodcastData) => void;
}

export const PodcastGenerator: React.FC<PodcastGeneratorProps> = ({
  selectedNoteIds = [],
  selectedDocumentIds = [],
  onClose,
  onPodcastGenerated
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [style, setStyle] = useState<'casual' | 'educational' | 'deep-dive'>('educational');
  const [duration, setDuration] = useState<'short' | 'medium' | 'long'>('medium');
  const [podcastType, setPodcastType] = useState<'audio' | 'image-audio' | 'video' | 'live-stream'>('audio');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isGeneratingAiCover, setIsGeneratingAiCover] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [eligibility, setEligibility] = useState<{
    canCreate: boolean;
    hasSubscription: boolean;
    hasAchievements: boolean;
    requirementsMet: string[];
    requirementsNeeded: string[];
  } | null>(null);

  // Local state for content selection
  const [localSelectedNoteIds, setLocalSelectedNoteIds] = useState<string[]>(selectedNoteIds);
  const [localSelectedDocumentIds, setLocalSelectedDocumentIds] = useState<string[]>(selectedDocumentIds);
  const [availableNotes, setAvailableNotes] = useState<Array<{ id: string, title: string, updated_at: string }>>([]);
  const [availableDocuments, setAvailableDocuments] = useState<Array<{ id: string, title: string, updated_at: string }>>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [notesPage, setNotesPage] = useState(1);
  const [documentsPage, setDocumentsPage] = useState(1);
  const [notesHasMore, setNotesHasMore] = useState(true);
  const [documentsHasMore, setDocumentsHasMore] = useState(true);

  // Check eligibility on mount
  useEffect(() => {
    const checkEligibility = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setCheckingEligibility(false);
          return;
        }

        // Check if user is admin first
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (adminUser) {
          setEligibility({
            canCreate: true,
            hasSubscription: true,
            hasAchievements: true,
            requirementsMet: ['Admin Access'],
            requirementsNeeded: []
          });
          setCheckingEligibility(false);
          return;
        }

        const result = await checkPodcastCreationEligibility(user.id);

        setEligibility({
          canCreate: result.canCreate,
          hasSubscription: result.requirements.hasSubscription,
          hasAchievements: result.requirements.hasMinBadges && result.requirements.hasMinActivity,
          requirementsMet: [],
          requirementsNeeded: []
        });
      } catch (error) {
        //console.error('Error checking eligibility:', error);
        setEligibility({
          canCreate: true,
          hasSubscription: false,
          hasAchievements: false,
          requirementsMet: [],
          requirementsNeeded: []
        });
      } finally {
        setCheckingEligibility(false);
      }
    };

    checkEligibility();
  }, []);

  // Fetch available notes and documents
  useEffect(() => {
    const fetchContent = async () => {
      setLoadingContent(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch notes
        const { data: notes } = await supabase
          .from('notes')
          .select('id, title, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .range((notesPage - 1) * 20, notesPage * 20 - 1);

        if (notes) {
          setAvailableNotes(prev => notesPage === 1 ? notes : [...prev, ...notes]);
          setNotesHasMore(notes.length === 20);
        }

        // Fetch documents
        const { data: documents } = await supabase
          .from('documents')
          .select('id, title, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .range((documentsPage - 1) * 20, documentsPage * 20 - 1);

        if (documents) {
          setAvailableDocuments(prev => documentsPage === 1 ? documents : [...prev, ...documents]);
          setDocumentsHasMore(documents.length === 20);
        }
      } catch (error) {
        //console.error('Error fetching content:', error);
      } finally {
        setLoadingContent(false);
      }
    };

    fetchContent();
  }, [notesPage, documentsPage]);

  // Infinite scroll refs
  const notesScrollRef = React.useRef<HTMLDivElement>(null);
  const documentsScrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = (ref: React.RefObject<HTMLDivElement>, hasMore: boolean, loadMore: () => void) => {
      if (!ref.current || !hasMore) return;
      const { scrollTop, scrollHeight, clientHeight } = ref.current;
      if (scrollTop + clientHeight >= scrollHeight - 10) {
        loadMore();
      }
    };

    const notesDiv = notesScrollRef.current;
    const docsDiv = documentsScrollRef.current;

    if (notesDiv) {
      const onScroll = () => handleScroll(notesScrollRef, notesHasMore, () => setNotesPage(p => p + 1));
      notesDiv.addEventListener('scroll', onScroll);
      return () => notesDiv.removeEventListener('scroll', onScroll);
    }
    if (docsDiv) {
      const onScroll = () => handleScroll(documentsScrollRef, documentsHasMore, () => setDocumentsPage(p => p + 1));
      docsDiv.addEventListener('scroll', onScroll);
      return () => docsDiv.removeEventListener('scroll', onScroll);
    }
  }, [notesHasMore, documentsHasMore]);

  const toggleNoteSelection = (noteId: string) => {
    setLocalSelectedNoteIds(prev =>
      prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]
    );
  };

  const toggleDocumentSelection = (docId: string) => {
    setLocalSelectedDocumentIds(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setIsUploadingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('podcasts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('podcasts')
        .getPublicUrl(filePath);

      setCoverImage(publicUrl);
      toast.success('Cover image uploaded successfully');
    } catch (error: any) {
      //console.error('Error uploading image:', error);
      toast.error('Failed to upload cover image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleGenerateAiCover = async () => {
    setIsGeneratingAiCover(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const selectedTitles = [
        ...availableNotes.filter(n => localSelectedNoteIds.includes(n.id)).map(n => n.title),
        ...availableDocuments.filter(d => localSelectedDocumentIds.includes(d.id)).map(d => d.title)
      ];

      const prompt = selectedTitles.length > 0
        ? `A professional podcast cover for a show about ${selectedTitles.join(', ')}. Modern, clean, educational style, vibrant colors.`
        : "A professional educational podcast cover, modern design, vibrant colors, clean typography.";

      const { data, error } = await supabase.functions.invoke('generate-image-from-text', {
        body: { description: prompt, userId: user.id }
      });

      if (error) throw error;
      if (data?.imageUrl) {
        setCoverImage(data.imageUrl);
        toast.success('AI cover generated successfully');
      } else {
        throw new Error('No image URL returned');
      }
    } catch (error: any) {
      //console.error('Error generating AI cover:', error);
      toast.error('Failed to generate AI cover');
    } finally {
      setIsGeneratingAiCover(false);
    }
  };

  const generatePodcast = async () => {
    if (!eligibility?.canCreate) {
      toast.error('You do not meet the requirements to generate podcasts');
      return;
    }

    setIsGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('generate-podcast', {
        body: {
          noteIds: localSelectedNoteIds,
          documentIds: localSelectedDocumentIds,
          style,
          duration,
          podcastType,
          cover_image_url: coverImage,
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to generate podcast');
      }

      const result = response.data;

      if (!result) {
        throw new Error('No response data received from server');
      }

      if (result.success) {
        // Map backend response to frontend types
        const backendPodcast = result.podcast;
        
        // Parse audio_segments if it's a string
        let audioSegments: AudioSegment[] = [];
        if (backendPodcast.audio_segments) {
          if (typeof backendPodcast.audio_segments === 'string') {
            try {
              audioSegments = JSON.parse(backendPodcast.audio_segments);
            } catch (e) {
              audioSegments = backendPodcast.audio_segments;
            }
          } else {
            audioSegments = backendPodcast.audio_segments;
          }
        }

        // Parse visual_assets if it's a string
        let visualAssets: VisualAsset[] | null = null;
        if (backendPodcast.visual_assets) {
          if (typeof backendPodcast.visual_assets === 'string') {
            try {
              visualAssets = JSON.parse(backendPodcast.visual_assets);
            } catch (e) {
              visualAssets = backendPodcast.visual_assets;
            }
          } else {
            visualAssets = backendPodcast.visual_assets;
          }
        }

        const podcast: PodcastData = {
          id: backendPodcast.id,
          title: backendPodcast.title,
          description: backendPodcast.description,
          script: backendPodcast.script,
          audioSegments: audioSegments,
          duration: backendPodcast.duration_minutes || backendPodcast.duration || 0,
          sources: backendPodcast.sources || [],
          style: backendPodcast.style,
          created_at: backendPodcast.created_at,
          podcast_type: backendPodcast.podcast_type as 'audio' | 'image-audio' | 'video' | 'live-stream' | null,
          visual_assets: visualAssets,
          cover_image_url: backendPodcast.cover_image_url,
          is_live: backendPodcast.is_live || false,
          tags: backendPodcast.tags || [],
          listen_count: backendPodcast.listen_count || 0,
          share_count: backendPodcast.share_count || 0,
          user_id: backendPodcast.user_id || user.id,
          is_public: backendPodcast.is_public || false,
        };

        toast.success('Podcast generated successfully!', { icon: '🎙️' });
        onPodcastGenerated?.(podcast);
        onClose?.();
      } else {
        throw new Error(result.error || 'Failed to generate podcast');
      }
    } catch (error: any) {
      //console.error('Error generating podcast:', error);
      toast.error(error.message || 'Failed to generate podcast');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Generate AI Podcast
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Create a conversational podcast from your selected content
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(85vh-120px)] pr-2">
          {checkingEligibility ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Checking eligibility...</span>
            </div>
          ) : !eligibility?.canCreate ? (
            <div className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                  Podcast Generation Requirements
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                  To generate AI podcasts, you need to meet one of the following:
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm">
                    {eligibility?.hasSubscription ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    )}
                    <span className={eligibility?.hasSubscription ? 'text-green-700 dark:text-green-400' : 'text-yellow-800 dark:text-yellow-200'}>
                      Active Scholar or Genius subscription
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    {eligibility?.hasAchievements ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    )}
                    <span className={eligibility?.hasAchievements ? 'text-green-700 dark:text-green-400' : 'text-yellow-800 dark:text-yellow-200'}>
                      3+ badges AND (5+ notes OR 3+ quizzes completed)
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <Award className="h-5 w-5 text-purple-500 flex-shrink-0" />
                    <span className="text-yellow-800 dark:text-yellow-200">
                      Verified Creator badge
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild className="flex-1">
                  <Link to="/subscription">View Subscription Plans</Link>
                </Button>
                <Button variant="outline" onClick={onClose}>Close</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Content Selection */}
              <div>
                <Label className="text-sm font-medium mb-3 block text-gray-900 dark:text-white">
                  Select Content for Podcast
                </Label>

                {loadingContent ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading your content...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Notes Selection */}
                    {availableNotes.length > 0 && (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="h-4 w-4 text-purple-600" />
                          <Label className="text-sm font-medium text-gray-900 dark:text-white">
                            Notes ({availableNotes.length})
                          </Label>
                        </div>
                        <ScrollArea className="h-[150px]" ref={notesScrollRef}>
                          <div className="space-y-2">
                            {availableNotes.map(note => (
                              <div key={note.id} className="flex items-start space-x-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                                <Checkbox
                                  id={`note-${note.id}`}
                                  checked={localSelectedNoteIds.includes(note.id)}
                                  onCheckedChange={() => toggleNoteSelection(note.id)}
                                />
                                <label
                                  htmlFor={`note-${note.id}`}
                                  className="flex-1 text-sm cursor-pointer leading-none text-gray-900 dark:text-gray-100"
                                >
                                  <div className="font-medium">{note.title}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(note.updated_at).toLocaleDateString()}
                                  </div>
                                </label>
                              </div>
                            ))}
                            {notesHasMore && (
                              <div className="flex justify-center py-2">
                                <Button size="sm" variant="outline" onClick={() => setNotesPage(p => p + 1)} disabled={loadingContent}>
                                  {loadingContent ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load More'}
                                </Button>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    )}

                    {/* Documents Selection */}
                    {availableDocuments.length > 0 && (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                        <div className="flex items-center gap-2 mb-3">
                          <File className="h-4 w-4 text-blue-600" />
                          <Label className="text-sm font-medium text-gray-900 dark:text-white">
                            Documents ({availableDocuments.length})
                          </Label>
                        </div>
                        <ScrollArea className="h-[150px]" ref={documentsScrollRef}>
                          <div className="space-y-2">
                            {availableDocuments.map(doc => (
                              <div key={doc.id} className="flex items-start space-x-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                                <Checkbox
                                  id={`doc-${doc.id}`}
                                  checked={localSelectedDocumentIds.includes(doc.id)}
                                  onCheckedChange={() => toggleDocumentSelection(doc.id)}
                                />
                                <label
                                  htmlFor={`doc-${doc.id}`}
                                  className="flex-1 text-sm cursor-pointer leading-none text-gray-900 dark:text-gray-100"
                                >
                                  <div className="font-medium">{doc.title}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(doc.updated_at).toLocaleDateString()}
                                  </div>
                                </label>
                              </div>
                            ))}
                            {documentsHasMore && (
                              <div className="flex justify-center py-2">
                                <Button size="sm" variant="outline" onClick={() => setDocumentsPage(p => p + 1)} disabled={loadingContent}>
                                  {loadingContent ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load More'}
                                </Button>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    )}

                    {availableNotes.length === 0 && availableDocuments.length === 0 && (
                      <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                        <p className="mb-2">No content available yet.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onClose?.();
                            window.location.href = '/chat';
                          }}
                        >
                          Create Notes in AI Chat
                        </Button>
                      </div>
                    )}

                    {/* Selection Summary */}
                    {(localSelectedNoteIds.length > 0 || localSelectedDocumentIds.length > 0) && (
                      <div className="flex items-center gap-2 text-sm bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-green-900 dark:text-green-100">
                          Selected: {localSelectedNoteIds.length} note{localSelectedNoteIds.length !== 1 ? 's' : ''}
                          {localSelectedDocumentIds.length > 0 && (
                            <> • {localSelectedDocumentIds.length} document{localSelectedDocumentIds.length !== 1 ? 's' : ''}</>
                          )}
                        </span>
                      </div>
                    )}

                    {localSelectedNoteIds.length === 0 && localSelectedDocumentIds.length === 0 && (availableNotes.length > 0 || availableDocuments.length > 0) && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <Sparkles className="h-4 w-4 inline mr-2 text-blue-600" />
                        No content selected. We'll use your 5 most recent notes to generate the podcast.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cover Image Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium text-gray-900 dark:text-white">
                    Cover Image (Optional)
                  </Label>
                  {!coverImage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1.5 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                      onClick={handleGenerateAiCover}
                      disabled={isGeneratingAiCover || isUploadingImage}
                    >
                      {isGeneratingAiCover ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Generate with AI
                    </Button>
                  )}
                </div>
                <div className="flex flex-col gap-4">
                  {coverImage ? (
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group">
                      <img
                        src={coverImage}
                        alt="Podcast cover"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => setCoverImage(null)}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          {isUploadingImage ? (
                            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                          ) : (
                            <>
                              <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                              <p className="text-sm text-gray-600 dark:text-gray-400">Click to upload cover image</p>
                              <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={isUploadingImage || isGeneratingAiCover}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Podcast Type Selection */}
              <div>
                <Label className="text-sm font-medium mb-3 block text-gray-900 dark:text-white">Podcast Type</Label>
                <RadioGroup value={podcastType} onValueChange={(v) => setPodcastType(v as any)}>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                      <RadioGroupItem value="audio" id="audio" />
                      <div className="flex-1">
                        <Label htmlFor="audio" className="cursor-pointer font-medium flex items-center gap-2 text-gray-900 dark:text-white">
                          <Headphones className="h-4 w-4" />
                          Audio Only
                        </Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Traditional audio podcast - perfect for listening on the go
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                      <RadioGroupItem value="image-audio" id="image-audio" />
                      <div className="flex-1">
                        <Label htmlFor="image-audio" className="cursor-pointer font-medium flex items-center gap-2 text-gray-900 dark:text-white">
                          <ImageIcon className="h-4 w-4" />
                          Image + Audio
                          <Badge variant="secondary" className="text-xs">AI Generated</Badge>
                        </Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Audio with AI-generated visual illustrations for key concepts
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                      <RadioGroupItem value="video" id="video" />
                      <div className="flex-1">
                        <Label htmlFor="video" className="cursor-pointer font-medium flex items-center gap-2 text-gray-900 dark:text-white">
                          <Video className="h-4 w-4" />
                          Video Podcast
                          <Badge variant="secondary" className="text-xs">AI Generated</Badge>
                        </Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Full video with animated visuals, slides, and dynamic content
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                      <RadioGroupItem value="live-stream" id="live-stream" />
                      <div className="flex-1">
                        <Label htmlFor="live-stream" className="cursor-pointer font-medium flex items-center gap-2 text-gray-900 dark:text-white">
                          <Radio className="h-4 w-4 text-red-500" />
                          Live AI Stream
                          <Badge variant="destructive" className="text-xs">Premium</Badge>
                        </Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Real-time AI-powered video stream with interactive visuals
                        </p>
                      </div>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Style Selection */}
              <div>
                <Label className="text-sm font-medium mb-3 block text-gray-900 dark:text-white">Podcast Style</Label>
                <RadioGroup value={style} onValueChange={(v) => setStyle(v as any)}>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                      <RadioGroupItem value="casual" id="casual" />
                      <div className="flex-1">
                        <Label htmlFor="casual" className="cursor-pointer font-medium text-gray-900 dark:text-white">
                          Casual Chat
                        </Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Friendly conversation between two hosts, like chatting over coffee
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                      <RadioGroupItem value="educational" id="educational" />
                      <div className="flex-1">
                        <Label htmlFor="educational" className="cursor-pointer font-medium text-gray-900 dark:text-white">
                          Educational
                        </Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Informative discussion breaking down complex concepts clearly
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                      <RadioGroupItem value="deep-dive" id="deep-dive" />
                      <div className="flex-1">
                        <Label htmlFor="deep-dive" className="cursor-pointer font-medium text-gray-900 dark:text-white">
                          Deep Dive
                        </Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Analytical exploration of nuances and connections
                        </p>
                      </div>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Duration Selection */}
              <div>
                <Label className="text-sm font-medium mb-3 block text-gray-900 dark:text-white">Duration</Label>
                <RadioGroup value={duration} onValueChange={(v) => setDuration(v as any)}>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                      <RadioGroupItem value="short" id="short" />
                      <Label htmlFor="short" className="cursor-pointer text-gray-900 dark:text-white">
                        5-7 min
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                      <RadioGroupItem value="medium" id="medium" />
                      <Label htmlFor="medium" className="cursor-pointer text-gray-900 dark:text-white">
                        12-15 min
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                      <RadioGroupItem value="long" id="long" />
                      <Label htmlFor="long" className="cursor-pointer text-gray-900 dark:text-white">
                        25-30 min
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Generate Button */}
              <Button
                onClick={generatePodcast}
                disabled={isGenerating || !eligibility?.canCreate}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating Podcast...
                  </>
                ) : (
                  <>
                    <Podcast className="mr-2 h-5 w-5" />
                    Generate Podcast
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};