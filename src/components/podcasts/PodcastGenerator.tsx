// src/components/aiChat/PodcastGenerator.tsx - Enhanced UI with Original Logic
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { speakText } from '@/services/cloudTtsService';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  File,
  Clock,
  Users,
  Mic,
  Upload,
  Play,
  Wand2,
  Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { checkPodcastCreationEligibility } from '@/services/podcastModerationService';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [currentStep, setCurrentStep] = useState(1);
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

  // Hosts and voices customization
  const [numberOfHosts, setNumberOfHosts] = useState<number>(2);
  const [hosts, setHosts] = useState<Array<{ name: string; voice: string }>>([
    { name: 'Thomas', voice: 'en-US-Neural2-D' },
    { name: 'Isabel', voice: 'en-US-Neural2-C' }
  ]);

  const voiceOptions = [
    { value: 'en-US-Neural2-A', label: 'Neural2 A', gender: 'male' },
    { value: 'en-US-Neural2-C', label: 'Neural2 C', gender: 'female' },
    { value: 'en-US-Neural2-D', label: 'Neural2 D', gender: 'male' },
    { value: 'en-US-Neural2-E', label: 'Neural2 E', gender: 'female' },
    { value: 'en-US-Neural2-F', label: 'Neural2 F', gender: 'female' },
    { value: 'en-US-Neural2-G', label: 'Neural2 G', gender: 'female' },
    { value: 'en-US-Neural2-H', label: 'Neural2 H', gender: 'female' },
    { value: 'en-US-Neural2-I', label: 'Neural2 I', gender: 'male' },
    { value: 'en-US-Neural2-J', label: 'Neural2 J', gender: 'male' }
  ];

  const podcastTypes = [
    {
      value: 'audio',
      icon: Headphones,
      label: 'Audio Only',
      description: 'Traditional audio podcast - perfect for listening on the go',
      badge: null,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      value: 'image-audio',
      icon: ImageIcon,
      label: 'Image + Audio',
      description: 'Audio with AI-generated visual illustrations',
      badge: 'AI Generated',
      color: 'from-purple-500 to-pink-500'
    },
    {
      value: 'video',
      icon: Video,
      label: 'Video Podcast',
      description: 'Full video with animated visuals and slides',
      badge: 'AI Generated',
      color: 'from-orange-500 to-red-500'
    },
    {
      value: 'live-stream',
      icon: Radio,
      label: 'Live AI Stream',
      description: 'Real-time AI-powered video stream',
      badge: 'Premium',
      color: 'from-green-500 to-emerald-500'
    }
  ];

  const styleOptions = [
    {
      value: 'casual',
      icon: '☕',
      label: 'Casual Chat',
      description: 'Friendly conversation, like chatting over coffee'
    },
    {
      value: 'educational',
      icon: '📚',
      label: 'Educational',
      description: 'Breaking down complex concepts clearly'
    },
    {
      value: 'deep-dive',
      icon: '🔬',
      label: 'Deep Dive',
      description: 'Analytical exploration of nuances'
    }
  ];

  const durationOptions = [
    { value: 'short', label: '5-7 min', icon: Clock, description: 'Quick overview' },
    { value: 'medium', label: '12-15 min', icon: Clock, description: 'Balanced coverage' },
    { value: 'long', label: '25-30 min', icon: Clock, description: 'In-depth discussion' }
  ];

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
          numberOfHosts,
          hosts,
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
        const backendPodcast = result.podcast;
        
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
      toast.error(error.message || 'Failed to generate podcast');
    } finally {
      setIsGenerating(false);
    }
  };

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-screen overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-0">
        <DialogHeader className="space-y-4 pb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              Generate AI Podcast
            </DialogTitle>
          </div>
          
          {!checkingEligibility && eligibility?.canCreate && (
            <>
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Step {currentStep} of {totalSteps}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-600 to-blue-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Step Indicators */}
              <div className="flex justify-between">
                {['Content', 'Type & Style', 'Hosts', 'Cover'].map((step, index) => (
                  <div
                    key={step}
                    className={`flex items-center gap-2 ${
                      index + 1 <= currentStep
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        index + 1 <= currentStep
                          ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      {index + 1 < currentStep ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span className="hidden sm:inline text-sm font-medium">{step}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-280px)] px-1">
          {checkingEligibility ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Checking eligibility...</span>
            </div>
          ) : !eligibility?.canCreate ? (
            <div className="space-y-4 p-6">
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
            <AnimatePresence mode="wait">
              {/* Step 1: Content Selection */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6 p-6"
                >
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Select Your Content
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Choose notes and documents to include in your podcast
                    </p>
                  </div>

                  {loadingContent ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                      <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading your content...</span>
                    </div>
                  ) : (
                    <>
                      <Tabs defaultValue="notes" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="notes" className="gap-2">
                            <FileText className="h-4 w-4" />
                            Notes ({availableNotes.length})
                          </TabsTrigger>
                          <TabsTrigger value="documents" className="gap-2">
                            <File className="h-4 w-4" />
                            Documents ({availableDocuments.length})
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="notes" className="mt-4">
                          {availableNotes.length > 0 ? (
                            <Card>
                              <CardContent className="p-4">
                                <ScrollArea className="h-[300px]" ref={notesScrollRef}>
                                  <div className="space-y-2">
                                    {availableNotes.map(note => (
                                      <motion.div
                                        key={note.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                          localSelectedNoteIds.includes(note.id)
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                                        }`}
                                        onClick={() => toggleNoteSelection(note.id)}
                                      >
                                        <Checkbox
                                          checked={localSelectedNoteIds.includes(note.id)}
                                          className="mt-1"
                                        />
                                        <div className="flex-1">
                                          <div className="font-medium text-gray-900 dark:text-white">
                                            {note.title}
                                          </div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            Updated {new Date(note.updated_at).toLocaleDateString()}
                                          </div>
                                        </div>
                                      </motion.div>
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
                              </CardContent>
                            </Card>
                          ) : (
                            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                              <p className="mb-2">No notes available yet.</p>
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
                        </TabsContent>

                        <TabsContent value="documents" className="mt-4">
                          {availableDocuments.length > 0 ? (
                            <Card>
                              <CardContent className="p-4">
                                <ScrollArea className="h-[300px]" ref={documentsScrollRef}>
                                  <div className="space-y-2">
                                    {availableDocuments.map(doc => (
                                      <motion.div
                                        key={doc.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                          localSelectedDocumentIds.includes(doc.id)
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                        }`}
                                        onClick={() => toggleDocumentSelection(doc.id)}
                                      >
                                        <Checkbox
                                          checked={localSelectedDocumentIds.includes(doc.id)}
                                          className="mt-1"
                                        />
                                        <div className="flex-1">
                                          <div className="font-medium text-gray-900 dark:text-white">
                                            {doc.title}
                                          </div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            Updated {new Date(doc.updated_at).toLocaleDateString()}
                                          </div>
                                        </div>
                                      </motion.div>
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
                              </CardContent>
                            </Card>
                          ) : (
                            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                              <p className="mb-2">No documents available yet.</p>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>

                      {(localSelectedNoteIds.length > 0 || localSelectedDocumentIds.length > 0) && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border border-green-200 dark:border-green-800 rounded-xl"
                        >
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span className="text-sm font-medium text-green-900 dark:text-green-100">
                            {localSelectedNoteIds.length + localSelectedDocumentIds.length} item(s) selected
                          </span>
                        </motion.div>
                      )}

                      {localSelectedNoteIds.length === 0 && localSelectedDocumentIds.length === 0 && (availableNotes.length > 0 || availableDocuments.length > 0) && (
                        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl">
                          <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-blue-900 dark:text-blue-100">
                            <p className="font-medium mb-1">No content selected</p>
                            <p className="text-blue-700 dark:text-blue-300">
                              We'll use your 5 most recent notes to generate the podcast.
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {/* Step 2: Type & Style */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6 p-6"
                >
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Choose Type & Style
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Select the format and tone for your podcast
                    </p>
                  </div>

                  {/* Podcast Type */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold text-gray-900 dark:text-white">
                      Podcast Type
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {podcastTypes.map((type) => {
                        const Icon = type.icon;
                        return (
                          <motion.div
                            key={type.value}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Card
                              className={`cursor-pointer transition-all ${
                                podcastType === type.value
                                  ? 'ring-2 ring-purple-500 bg-gradient-to-br ' + type.color + ' text-white'
                                  : 'hover:shadow-lg'
                              }`}
                              onClick={() => setPodcastType(type.value as any)}
                            >
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center justify-between text-base">
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-5 w-5" />
                                    {type.label}
                                  </div>
                                  {type.badge && (
                                    <Badge variant={type.badge === 'Premium' ? 'destructive' : 'secondary'} className="text-xs">
                                      {type.badge}
                                    </Badge>
                                  )}
                                </CardTitle>
                                <CardDescription className={podcastType === type.value ? 'text-white/80' : ''}>
                                  {type.description}
                                </CardDescription>
                              </CardHeader>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Style */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold text-gray-900 dark:text-white">
                      Podcast Style
                    </Label>
                    <div className="grid grid-cols-1 gap-3">
                      {styleOptions.map((option) => (
                        <motion.div
                          key={option.value}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            style === option.value
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                              : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                          }`}
                          onClick={() => setStyle(option.value as any)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-3xl">{option.icon}</div>
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {option.label}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {option.description}
                              </div>
                            </div>
                            {style === option.value && (
                              <CheckCircle2 className="h-6 w-6 text-purple-600" />
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold text-gray-900 dark:text-white">
                      Duration
                    </Label>
                    <div className="grid grid-cols-3 gap-3">
                      {durationOptions.map((option) => (
                        <motion.div
                          key={option.value}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Card
                            className={`cursor-pointer text-center transition-all ${
                              duration === option.value
                                ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-950'
                                : 'hover:shadow-lg'
                            }`}
                            onClick={() => setDuration(option.value as any)}
                          >
                            <CardContent className="p-4">
                              <Clock className={`h-6 w-6 mx-auto mb-2 ${
                                duration === option.value ? 'text-purple-600' : 'text-gray-400'
                              }`} />
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {option.label}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {option.description}
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Hosts */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6 p-6"
                >
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Configure Your Hosts
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Customize host names and voices
                    </p>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Number of Hosts
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-3">
                        {[1, 2, 3, 4].map((num) => (
                          <Button
                            key={num}
                            variant={numberOfHosts === num ? 'default' : 'outline'}
                            onClick={() => {
                              setNumberOfHosts(num);
                              setHosts(prev => {
                                const copy = prev.slice(0, num);
                                while (copy.length < num) {
                                  copy.push({ name: `Host ${copy.length + 1}`, voice: 'en-US-Neural2-D' });
                                }
                                return copy;
                              });
                            }}
                            className="flex-1"
                          >
                            {num}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    {hosts.slice(0, numberOfHosts).map((host, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                      >
                        <Card className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Mic className="h-4 w-4" />
                              {idx === 0 ? 'Main Host' : `Co-host ${idx}`}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-sm">Name</Label>
                              <input
                                value={host.name}
                                onChange={(e) => setHosts(prev => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], name: e.target.value };
                                  return copy;
                                })}
                                placeholder={`Host ${idx + 1} name`}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 outline-none"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm">Voice</Label>
                              <select
                                value={host.voice}
                                onChange={(e) => setHosts(prev => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], voice: e.target.value };
                                  return copy;
                                })}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 outline-none"
                              >
                                {voiceOptions.map(v => (
                                  <option key={v.value} value={v.value}>
                                    {v.label} — {v.gender === 'male' ? 'Male' : 'Female'}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex items-center gap-3">
                              <Badge variant="secondary" className="capitalize">
                                {voiceOptions.find(vo => vo.value === host.voice)?.gender || 'Unknown'}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const sample = `Hi, I'm ${host.name || `Host ${idx + 1}`}. This is a voice preview.`;
                                  try {
                                    const audioEl = await speakText({ text: sample, voice: host.voice });
                                    if (!audioEl) toast.error('Preview generation failed');
                                  } catch (e) {
                                    toast.error('Failed to play preview');
                                  }
                                }}
                                className="gap-2"
                              >
                                <Play className="h-3 w-3" />
                                Preview Voice
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 4: Cover Image */}
              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6 p-6"
                >
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Add Cover Image
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Upload or generate an AI cover for your podcast
                    </p>
                  </div>

                  <div className="space-y-4">
                    {coverImage ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative group"
                      >
                        <div className="aspect-video rounded-2xl overflow-hidden border-2 border-purple-200 dark:border-purple-800 shadow-lg">
                          <img
                            src={coverImage}
                            alt="Podcast cover"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          onClick={() => setCoverImage(null)}
                          className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 rounded-full text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
                        >
                          <X className="h-5 w-5" />
                        </button>
                        <div className="absolute bottom-4 left-4 right-4">
                          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg p-3 flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              Cover image ready
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Upload Option */}
                        <Card className="group cursor-pointer hover:shadow-xl transition-all border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500">
                          <label className="cursor-pointer">
                            <CardContent className="p-8 text-center">
                              {isUploadingImage ? (
                                <Loader2 className="h-12 w-12 mx-auto animate-spin text-purple-600" />
                              ) : (
                                <>
                                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                    <Upload className="h-8 w-8 text-white" />
                                  </div>
                                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                                    Upload Image
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    PNG, JPG up to 5MB
                                  </p>
                                </>
                              )}
                            </CardContent>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={handleImageUpload}
                              disabled={isUploadingImage || isGeneratingAiCover}
                            />
                          </label>
                        </Card>

                        {/* AI Generate Option */}
                        <Card
                          className="group cursor-pointer hover:shadow-xl transition-all border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500"
                          onClick={handleGenerateAiCover}
                        >
                          <CardContent className="p-8 text-center">
                            {isGeneratingAiCover ? (
                              <Loader2 className="h-12 w-12 mx-auto animate-spin text-purple-600" />
                            ) : (
                              <>
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                  <Wand2 className="h-8 w-8 text-white" />
                                </div>
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                                  Generate with AI
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  Create unique cover art
                                </p>
                              </>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {!coverImage && (
                      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl">
                        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-900 dark:text-blue-100">
                          <p className="font-medium mb-1">Cover images are optional</p>
                          <p className="text-blue-700 dark:text-blue-300">
                            Skip this step if you prefer. A default cover will be generated for you.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Summary Card */}
                  <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 border-purple-200 dark:border-purple-800">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        Podcast Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Content:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {localSelectedNoteIds.length + localSelectedDocumentIds.length || 5} items
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Type:</span>
                        <Badge variant="secondary" className="capitalize">
                          {podcastType.replace('-', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Style:</span>
                        <Badge variant="secondary" className="capitalize">
                          {style.replace('-', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {durationOptions.find(d => d.value === duration)?.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Hosts:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {numberOfHosts} host{numberOfHosts > 1 ? 's' : ''}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        {!checkingEligibility && eligibility?.canCreate && (
          <div className="flex items-center justify-between gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : onClose?.()}
              disabled={isGenerating}
            >
              {currentStep === 1 ? 'Cancel' : 'Back'}
            </Button>

            <div className="flex gap-2">
              {currentStep < totalSteps ? (
                <Button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8"
                >
                  Continue
                </Button>
              ) : (
                <Button
                  onClick={generatePodcast}
                  disabled={isGenerating}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Podcast className="mr-2 h-5 w-5" />
                      Generate Podcast
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};