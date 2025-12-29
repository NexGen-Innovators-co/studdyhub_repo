// src/components/dashboard/PodcastButton.tsx
import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Podcast, Loader2 } from 'lucide-react';
import { PodcastGenerator } from '../aiChat/PodcastGenerator';
import { checkPodcastCreationEligibility } from '@/services/podcastModerationService';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PodcastButtonProps {
  selectedNoteIds?: string[];
  selectedDocumentIds?: string[];
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const PodcastButton: React.FC<PodcastButtonProps> = ({
  selectedNoteIds = [],
  selectedDocumentIds = [],
  variant = 'default',
  size = 'default',
  className = ''
}) => {
  const [showGenerator, setShowGenerator] = useState(false);
  const [checking, setChecking] = useState(false);

  const hasSelection = selectedNoteIds.length > 0 || selectedDocumentIds.length > 0;

  const handleClick = async () => {
    if (!hasSelection) return;

    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in to generate podcasts');
        setChecking(false);
        return;
      }

      const eligibility = await checkPodcastCreationEligibility(user.id);
      if (eligibility.canCreate) {
        setShowGenerator(true);
      } else {
        toast.error(
          'You need an active subscription or sufficient achievements to generate podcasts. Check the requirements in the dialog.',
          { duration: 5000 }
        );
        // Still show the dialog so they can see requirements
        setShowGenerator(true);
      }
    } catch (error) {
      console.error('Error checking eligibility:', error);
      toast.error('Failed to check eligibility');
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={!hasSelection || checking}
        className={className}
        title={hasSelection ? 'Generate AI Podcast' : 'Select notes or documents first'}
      >
        {checking ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Podcast className="h-4 w-4 mr-2" />
        )}
        Generate Podcast
      </Button>

      {showGenerator && (
        <PodcastGenerator
          selectedNoteIds={selectedNoteIds}
          selectedDocumentIds={selectedDocumentIds}
          onClose={() => setShowGenerator(false)}
        />
      )}
    </>
  );
};
