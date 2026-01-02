import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { AlertTriangle, Flag, MessageSquareWarning, Volume2, FileX } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../integrations/supabase/client';

interface ReportPodcastDialogProps {
  isOpen: boolean;
  onClose: () => void;
  podcastId: string;
  podcastTitle: string;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or misleading content', icon: Flag },
  { value: 'inappropriate', label: 'Inappropriate or offensive content', icon: AlertTriangle },
  { value: 'misinformation', label: 'False or misleading information', icon: MessageSquareWarning },
  { value: 'copyright', label: 'Copyright violation', icon: FileX },
  { value: 'not_educational', label: 'Not educational content', icon: MessageSquareWarning },
  { value: 'audio_quality', label: 'Poor audio quality or technical issues', icon: Volume2 },
  { value: 'harassment', label: 'Harassment or hate speech', icon: AlertTriangle },
  { value: 'other', label: 'Other', icon: Flag },
];

export const ReportPodcastDialog: React.FC<ReportPodcastDialogProps> = ({
  isOpen,
  onClose,
  podcastId,
  podcastTitle
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      toast.error('Please select a reason');
      return;
    }

    if (!details.trim()) {
      toast.error('Please provide additional details');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Insert report into content_moderation_queue
      const { error } = await supabase
        .from('content_moderation_queue')
        .insert({
          content_type: 'podcast',
          content_id: podcastId,
          reported_by: user.id,
          reason: `${selectedReason}: ${details.trim()}`,
          status: 'pending',
          priority: selectedReason === 'harassment' || selectedReason === 'inappropriate' ? 10 : 1
        });

      if (error) throw error;

      toast.success('Report submitted', {
        description: 'Thank you for helping keep our platform safe. Our team will review this podcast.'
      });

      onClose();
      setSelectedReason('');
      setDetails('');
    } catch (error: any) {

      toast.error('Failed to submit report: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Report Podcast
          </DialogTitle>
          <DialogDescription>
            Report "{podcastTitle}" for review by our moderation team
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Reason for report *</Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {REPORT_REASONS.map((reason) => {
                const Icon = reason.icon;
                return (
                  <div key={reason.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={reason.value} id={reason.value} />
                    <Label
                      htmlFor={reason.value}
                      className="flex items-center gap-2 cursor-pointer font-normal"
                    >
                      <Icon className="h-4 w-4" />
                      {reason.label}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Additional details *</Label>
            <Textarea
              id="details"
              placeholder="Please provide specific details about why you're reporting this podcast..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {details.length}/500
            </p>
          </div>

          <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
            <p className="font-medium mb-1">What happens next?</p>
            <ul className="space-y-1 text-xs">
              <li>• Our moderation team will review your report within 24-48 hours</li>
              <li>• We'll take appropriate action if we find violations</li>
              <li>• False reports may affect your account standing</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
