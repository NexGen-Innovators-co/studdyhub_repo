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
  Loader2,
  AlertCircle,
  Award,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [tags, setTags] = useState('');
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
      console.error('Error checking eligibility:', error);
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
          is_public: isPublic,
          is_live: true,
          live_started_at: new Date().toISOString(),
          status: 'completed', // Required field
          script: '', // Required field
          audio_segments: [], // Required field
          duration_minutes: 0, // Will be updated as stream progresses
          sources: [],
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

      // Create social post about going live
      if (isPublic) {
        await supabase
          .from('social_posts')
          .insert({
            author_id: user.id,
            content: `🔴 LIVE NOW: ${title}${description ? '\n\n' + description : ''}\n\nJoin the live podcast now!`,
            privacy: 'public'
          });
      }

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

      // Reset form
      setTitle('');
      setDescription('');
      setTags('');
      setIsPublic(true);
    } catch (error: any) {
      console.error('Error starting live podcast:', error);
      toast.error('Failed to start live stream: ' + error.message);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
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
