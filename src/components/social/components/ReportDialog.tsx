import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Label } from '../../ui/label';
import { AlertTriangle, Flag, MessageSquareWarning, UserX, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../integrations/supabase/client';
import { sanitizeText, stripHtml } from '../../../utils/validation';

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  postId?: string;
  commentId?: string;
  userId?: string;
  reportedUserId?: string;
  reportType: 'post' | 'comment' | 'user';
}

const REPORT_REASONS = {
  post: [
    { value: 'spam', label: 'Spam or misleading', icon: Flag },
    { value: 'harassment', label: 'Harassment or hate speech', icon: AlertTriangle },
    { value: 'inappropriate', label: 'Inappropriate content', icon: MessageSquareWarning },
    { value: 'violence', label: 'Violence or dangerous', icon: AlertTriangle },
    { value: 'false', label: 'False information', icon: MessageSquareWarning },
    { value: 'other', label: 'Other', icon: Flag },
  ],
  comment: [
    { value: 'spam', label: 'Spam', icon: Flag },
    { value: 'harassment', label: 'Harassment', icon: AlertTriangle },
    { value: 'inappropriate', label: 'Inappropriate', icon: MessageSquareWarning },
    { value: 'other', label: 'Other', icon: Flag },
  ],
  user: [
    { value: 'harassment', label: 'Harassment', icon: UserX },
    { value: 'impersonation', label: 'Impersonation', icon: UserX },
    { value: 'spam', label: 'Spam account', icon: Flag },
    { value: 'inappropriate', label: 'Inappropriate behavior', icon: MessageSquareWarning },
    { value: 'other', label: 'Other', icon: Flag },
  ]
};

export const ReportDialog: React.FC<ReportDialogProps> = ({
  isOpen,
  onClose,
  postId,
  commentId,
  userId,
  reportedUserId,
  reportType
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reasons = REPORT_REASONS[reportType];

  const handleSubmit = async () => {
    if (!selectedReason) {
      toast.error('Please select a reason');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to report');
        return;
      }

      // Insert report
      const { error } = await supabase
        .from('social_reports')
        .insert({
          reporter_id: user.id,
          post_id: postId || null,
          comment_id: commentId || null,
          reported_user_id: reportedUserId || null,
          reason: selectedReason,
          description: description.trim() ? sanitizeText(stripHtml(description)) : null,
          status: 'pending'
        });

      if (error) throw error;

      toast.success('Report submitted successfully. Our team will review it shortly.');
      onClose();
      setSelectedReason('');
      setDescription('');
    } catch (error) {
      //console.error('Error submitting report:', error);
      toast.error('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-red-500" />
            Report {reportType}
          </DialogTitle>
          <DialogDescription>
            Help us keep the community safe by reporting content that violates our guidelines.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium mb-3 block">Why are you reporting this?</Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              <div className="space-y-2">
                {reasons.map(({ value, label, icon: Icon }) => (
                  <div key={value} className="flex items-center space-x-3 border rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                    <RadioGroupItem value={value} id={value} />
                    <Label
                      htmlFor={value}
                      className="flex items-center gap-2 cursor-pointer flex-1 font-normal"
                    >
                      <Icon className="h-4 w-4 text-slate-500" />
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium mb-2 block">
              Additional details (optional)
            </Label>
            <Textarea
              id="description"
              placeholder="Provide more context about why you're reporting this..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none h-24"
              maxLength={500}
            />
            <p className="text-xs text-slate-500 mt-1">
              {description.length}/500 characters
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={!selectedReason || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
