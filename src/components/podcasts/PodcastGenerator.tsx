// src/components/aiChat/PodcastGenerator.tsx
import React, { useState, useEffect, Suspense } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import {
  Podcast,
  Loader2,
  Play,
  Pause,
  Download,
  X,
  Volume2,
  Clock,
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

interface PodcastGeneratorProps {
  selectedNoteIds?: string[];
  selectedDocumentIds?: string[];
  onClose?: () => void;
  onPodcastGenerated?: (podcast: PodcastData) => void;
}

export interface AudioSegment {
  speaker: string;
  audioContent: string;
  text: string;
  index: number;
  audio_url?: string; // For live podcasts stored in storage
}

export interface PodcastData {
  id: string;
  title: string;
  script: string;
  audioSegments: AudioSegment[];
  duration: number;
  sources: string[];
  style: string;
  created_at: string;
  cover_image_url?: string; // Optional cover image
  is_live?: boolean; // Whether podcast is live
  description?: string; // Optional description
  tags?: string[]; // Optional tags
  listen_count?: number; // Optional listen count
}

// Fixing the import error for PodcastContent
const LazyPodcastContent = React.lazy(() => import('./PodcastContent')); // Ensure PodcastContent.tsx exists in the same directory

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
  const [availableNotes, setAvailableNotes] = useState<Array<{id: string, title: string, updated_at: string}>>([]);
  const [availableDocuments, setAvailableDocuments] = useState<Array<{id: string, title: string, updated_at: string}>>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [notesPage, setNotesPage] = useState(1);
  const [documentsPage, setDocumentsPage] = useState(1);
  const [notesHasMore, setNotesHasMore] = useState(true);
  const [documentsHasMore, setDocumentsHasMore] = useState(true);

  // Pagination state for podcasts
  const [podcasts, setPodcasts] = useState<PodcastData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePodcasts, setHasMorePodcasts] = useState(true);
  const [loadingPodcasts, setLoadingPodcasts] = useState(false);

  // Check eligibility on mount
  useEffect(() => {
    const checkEligibility = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setCheckingEligibility(false);
          return;
        }

        // Check if user is admin first - admins have full access
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (adminUser) {
          // Admins bypass all checks
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

        // Allow creation on error to not block users
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

        // Fetch paginated notes
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

        // Fetch paginated documents
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

      } finally {
        setLoadingContent(false);
      }
    };

    fetchContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesPage, documentsPage]);

  // Fetch podcasts
  useEffect(() => {
    const fetchPodcasts = async (page: number) => {
      setLoadingPodcasts(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: fetchedPodcasts, error } = await supabase
          .from('podcasts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range((page - 1) * 10, page * 10 - 1);

        if (error) throw error;

        if (fetchedPodcasts) {
          setPodcasts(prev => [...prev, ...fetchedPodcasts]);
          setHasMorePodcasts(fetchedPodcasts.length === 10);
        }
      } catch (error) {
        console.error('Error fetching podcasts:', error);
      } finally {
        setLoadingPodcasts(false);
      }
    };

    fetchPodcasts(currentPage);
  }, [currentPage]);

  // Infinite scroll for notes/documents
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
      prev.includes(noteId) 
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    );
  };

  const toggleDocumentSelection = (docId: string) => {
    setLocalSelectedDocumentIds(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
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
      console.error('Error uploading image:', error);
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

      // Get titles of selected notes/docs for the prompt
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
      console.error('Error generating AI cover:', error);
      toast.error('Failed to generate AI cover');
    } finally {
      setIsGeneratingAiCover(false);
    }
  };

  const generatePodcast = async () => {
    // Allow generation without pre-selected content for podcast page
    // if (selectedNoteIds.length === 0 && selectedDocumentIds.length === 0) {
    //   toast.error('Please select at least one note or document');
    //   return;
    // }

    // Check eligibility before generating
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

      // Check for errors in the response
      if (response.error) {
        throw new Error(response.error.message || 'Failed to generate podcast');
      }

      const result = response.data;
      
      if (!result) {
        throw new Error('No response data received from server');
      }

      if (result.success) {
        // Map snake_case fields from backend to camelCase for frontend compatibility
        const podcast = {
          ...result.podcast,
          audioSegments: result.podcast.audio_segments,
          visualAssets: result.podcast.visual_assets,
        };
        toast.success('Podcast generated successfully!', { icon: '🎙️' });
        onPodcastGenerated?.(podcast);
        onClose?.();
      } else {
        throw new Error(result.error || 'Failed to generate podcast');
      }
    } catch (error: any) {

      toast.error(error.message || 'Failed to generate podcast');
    } finally {
      setIsGenerating(false);
    }
  };

  // Fixing the undefined 'loadMorePodcasts' function
  const loadMorePodcasts = () => {
    if (hasMorePodcasts && !loadingPodcasts) {
      setCurrentPage((prev) => prev + 1);
    }
  };
    
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-lg">
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Generate AI Podcast
            </DialogTitle>
            <DialogDescription>
              Create a conversational podcast from your selected content
            </DialogDescription>
          </DialogHeader>

          <Suspense fallback={<div>Loading content...</div>}>
            <LazyPodcastContent
              selectedNoteIds={selectedNoteIds}
              selectedDocumentIds={selectedDocumentIds}
              onClose={onClose}
              onPodcastGenerated={onPodcastGenerated}
            />
          </Suspense>

          {/* Render podcasts */}
          <div className="mt-4">
            <h3 className="text-lg font-semibold">Your Podcasts</h3>
            <div>
              {podcasts.map(podcast => (
                <div key={podcast.id} className="border-b py-2">
                  <Link to={`/podcast/${podcast.id}`} className="text-blue-600 hover:underline truncate block max-w-full">
                    {podcast.title}
                  </Link>
                  <p className="text-sm text-gray-500">{podcast.description}</p>
                </div>
              ))}
            </div>

            {/* Load more button */}
            {hasMorePodcasts && (
              <div className="flex justify-center mt-4">
                <Button onClick={loadMorePodcasts} disabled={loadingPodcasts}>
                  {loadingPodcasts ? 'Loading...' : 'Load More Podcasts'}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
