// GoLiveDialog.tsx - Start live podcast streaming
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import {
  Radio,
  Users,
  Globe,
  Lock,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Award,
  CheckCircle2,
  XCircle,
  Sparkles,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '../ui/alert';
import { checkPodcastCreationEligibility } from '@/services/podcastModerationService';
import { createPodcastNotification } from '@/services/notificationHelpers';

interface GoLiveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLiveStart?: (podcastId: string) => void;
}

export const GoLiveDialog: React.FC<GoLiveDialogProps> = ({
  isOpen,
  onClose,
  onLiveStart
}) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [tags, setTags] = useState('');
  const [podcastType, setPodcastType] = useState<'audio' | 'image-audio' | 'video' | 'live-stream'>('live-stream');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isGeneratingAiCover, setIsGeneratingAiCover] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [eligibility, setEligibility] = useState<any>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(true);

  // Check eligibility when dialog opens
  useEffect(() => {
    if (isOpen) {
      checkEligibility();
    }
  }, [isOpen]);

  const checkEligibility = async () => {
    setCheckingEligibility(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const result = await checkPodcastCreationEligibility(user.id);
      setEligibility(result);
    } catch (error) {
      //console.error('Error checking eligibility:', error);
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleGoLive = async () => {
    // Check eligibility
    if (!eligibility?.canCreate) {
      toast.error(eligibility?.reason || 'You are not eligible to create podcasts');
      return;
    }

    if (!title.trim()) {
      toast.error('Please enter a title for your live podcast');
      return;
    }

    setIsStarting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create live podcast entry
      const { data: podcast, error } = await supabase
        .from('ai_podcasts')
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          cover_image_url: coverImage || null,
          is_public: isPublic,
          is_live: true,
          live_started_at: new Date().toISOString(),
          status: 'completed', // Required field
          script: '', // Required field
          audio_segments: [], // Required field
          duration_minutes: 0, // Will be updated as stream progresses
          sources: [],
          podcast_type: podcastType,
          style: 'casual', // Using casual style for live streams
          tags: tags.split(',').map(t => t.trim()).filter(Boolean)
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator as owner in podcast_members
      await supabase
        .from('podcast_members')
        .insert({
          podcast_id: podcast.id,
          user_id: user.id,
          role: 'owner'
        });

      // Send notification to all podcast members (including owner)
      const { data: members } = await supabase
        .from('podcast_members')
        .select('user_id')
        .eq('podcast_id', podcast.id);
      const memberIds = (members || []).map((m: any) => m.user_id);
      await Promise.all(memberIds.map(uid =>
        createPodcastNotification(
          uid,
          'podcast_live',
          title.trim(),
          podcast.id,
          {
            icon: podcast.user?.avatar_url,
            image: podcast.cover_image_url
          }
        )
      ));

      toast.success('You are now live! 🎙️');
      onLiveStart?.(podcast.id);
      onClose();

      // Note: navigation is intentionally omitted here to avoid triggering
      // the public listener view at the same time the host UI is mounted.
      // The parent component can choose to navigate if desired.

      // Reset form
      setTitle('');
      setDescription('');
      setCoverImage(null);
      setTags('');
      setIsPublic(true);
    } catch (error: any) {
      //console.error('Error starting live podcast:', error);
      toast.error('Failed to start live stream: ' + error.message);
    } finally {
      setIsStarting(false);
    }
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

      const prompt = title.trim()
        ? `A professional podcast cover for a live stream titled: ${title.trim()}. Modern, clean, vibrant, bold typography.`
        : "A professional live podcast cover, modern design, vibrant colors, clean typography.";

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-scroll bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-red-500 animate-pulse" />
            Go Live
          </DialogTitle>
          <DialogDescription>
            Start a live podcast stream. Your followers will be notified.
          </DialogDescription>
        </DialogHeader>

        {checkingEligibility ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
          </div>
        ) : !eligibility?.canCreate ? (
          <div className="space-y-4">
            <Alert className="border-orange-500">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <AlertDescription className="ml-2">
                {eligibility?.reason}
              </AlertDescription>
            </Alert>

            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <h4 className="font-medium flex items-center gap-2">
                <Award className="h-4 w-4" />
                Requirements to Create Podcasts
              </h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  {eligibility?.requirements.hasSubscription ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span>Active Scholar or Genius subscription</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="ml-6 text-muted-foreground">OR achieve milestones:</span>
                </li>
                <li className="flex items-center gap-2 text-sm ml-6">
                  {eligibility?.requirements.hasMinBadges ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span>Earn at least 3 badges</span>
                </li>
                <li className="flex items-center gap-2 text-sm ml-6">
                  {eligibility?.requirements.hasMinActivity ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span>Create 5+ notes or complete 3+ quizzes</span>
                </li>
              </ul>
              <Button
                onClick={() => window.location.href = '/subscription'}
                className="w-full mt-4"
                variant="outline"
              >
                View Subscription Plans
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">{/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Study Session: Advanced Calculus"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What will you be discussing?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              placeholder="e.g., math, study, calculus"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          {/* Podcast Type */}
          <div className="space-y-2">
            <Label htmlFor="podcastType">Podcast Type</Label>
            <select
              id="podcastType"
              value={podcastType}
              onChange={(e) => setPodcastType(e.target.value as any)}
              className="w-full rounded-md border p-2 bg-white dark:bg-slate-800"
            >
              <option value="live-stream">Live Stream</option>
              <option value="audio">Audio</option>
              <option value="image-audio">Image + Audio</option>
              <option value="video">Video</option>
            </select>
          </div>

          {/* Public/Private Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              {isPublic ? (
                <>
                  <Globe className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="font-medium text-sm">Public Stream</p>
                    <p className="text-xs text-muted-foreground">
                      Anyone can discover and join
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="font-medium text-sm">Private Stream</p>
                    <p className="text-xs text-muted-foreground">
                      Only invited members can join
                    </p>
                  </div>
                </>
              )}
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
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

          {/* Info Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Live streaming is currently in beta. Audio will be recorded and available after the stream ends.
            </AlertDescription>
          </Alert>
          </div>
        )}

        {eligibility?.canCreate && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isStarting}>
              Cancel
            </Button>
            <Button
              onClick={handleGoLive}
              disabled={isStarting || !title.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Radio className="h-4 w-4 mr-2" />
                  Go Live
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

