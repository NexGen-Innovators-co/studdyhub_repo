import React, { useState, useEffect } from 'react';
import { Star, Send, Loader2, CheckCircle2, Pencil } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '../ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface RateAppDialogProps {
  trigger?: React.ReactNode;
  /** Externally controlled open state (optional – falls back to internal state) */
  externalOpen?: boolean;
  /** Callback when dialog open state changes externally */
  onExternalOpenChange?: (open: boolean) => void;
}

export const RateAppDialog: React.FC<RateAppDialogProps> = ({ trigger, externalOpen, onExternalOpenChange }) => {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);

  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onExternalOpenChange ?? setInternalOpen;
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [testimonial, setTestimonial] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existingRating, setExistingRating] = useState<number | null>(null);
  const [existingTestimonial, setExistingTestimonial] = useState<string | null>(null);
  const [testimonialStatus, setTestimonialStatus] = useState<'none' | 'pending' | 'approved'>('none');
  const [loaded, setLoaded] = useState(false);

  // Fetch existing rating & testimonial when dialog opens
  useEffect(() => {
    if (!open || !user) return;

    const fetchExisting = async () => {
      const [ratingRes, testimonialRes] = await Promise.all([
        supabase.from('app_ratings').select('rating').eq('user_id', user.id).maybeSingle(),
        supabase.from('app_testimonials').select('content, rating, is_approved').eq('user_id', user.id).maybeSingle(),
      ]);

      if (ratingRes.data) {
        setExistingRating(ratingRes.data.rating);
        setRating(ratingRes.data.rating);
      }

      if (testimonialRes.data) {
        setExistingTestimonial(testimonialRes.data.content);
        setTestimonial(testimonialRes.data.content);
        setRating(testimonialRes.data.rating);
        setTestimonialStatus(testimonialRes.data.is_approved ? 'approved' : 'pending');
      }

      setLoaded(true);
    };

    fetchExisting();
  }, [open, user]);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please sign in to rate the app');
      return;
    }
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setSubmitting(true);
    try {
      // Upsert rating
      const { error: ratingError } = await supabase
        .from('app_ratings')
        .upsert(
          { user_id: user.id, rating, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );

      if (ratingError) throw ratingError;

      // Upsert testimonial if provided
      if (testimonial.trim().length >= 10) {
        const { error: testError } = await supabase
          .from('app_testimonials')
          .upsert(
            {
              user_id: user.id,
              content: testimonial.trim(),
              rating,
              is_approved: false, // reset approval on edit
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );

        if (testError) throw testError;
        toast.success('Thanks! Your rating and testimonial have been submitted for review.');
        setTestimonialStatus('pending');
      } else {
        toast.success('Thanks for rating StuddyHub!');
      }

      setExistingRating(rating);
      if (testimonial.trim().length >= 10) {
        setExistingTestimonial(testimonial.trim());
      }
    } catch (err: any) {
      console.error('Rating submit error:', err);
      toast.error(err.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoveredRating || rating;

  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Only render a trigger when not externally controlled */}
      {externalOpen === undefined && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="gap-2">
              <Star className="h-4 w-4" />
              Rate App
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            Rate StuddyHub
          </DialogTitle>
          <DialogDescription>
            Your feedback helps us improve and lets other students know what to expect.
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-gray-600 dark:text-gray-400">Sign in to rate StuddyHub and share your experience.</p>
            <Button onClick={() => { setOpen(false); window.location.href = '/auth'; }}>
              Sign In
            </Button>
          </div>
        ) : !loaded ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* Star Rating */}
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                How would you rate your experience?
              </p>
              <div className="flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded"
                    aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                  >
                    <Star
                      className={`h-8 w-8 transition-colors duration-150 ${
                        star <= displayRating
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {displayRating > 0 && (
                <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                  {ratingLabels[displayRating]}
                </p>
              )}
            </div>

            {/* Testimonial Text */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Share your experience (optional)
                </label>
                {testimonialStatus !== 'none' && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    testimonialStatus === 'approved'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {testimonialStatus === 'approved' ? 'Published' : 'Pending review'}
                  </span>
                )}
              </div>
              <Textarea
                value={testimonial}
                onChange={(e) => setTestimonial(e.target.value)}
                placeholder="Tell other students what you love about StuddyHub..."
                className="min-h-[100px] resize-none"
                maxLength={500}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{testimonial.length < 10 && testimonial.length > 0 ? 'Min 10 characters' : ''}</span>
                <span>{testimonial.length}/500</span>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || rating === 0}
                className="gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : existingRating ? (
                  <Pencil className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {existingRating ? 'Update' : 'Submit'}
              </Button>
            </div>

            {existingRating && (
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                You previously rated {existingRating}/5
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
