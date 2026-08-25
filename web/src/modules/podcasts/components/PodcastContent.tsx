import React from 'react';

interface PodcastContentProps {
  selectedNoteIds?: string[];
  selectedDocumentIds?: string[];
  onClose?: () => void;
  onPodcastGenerated?: (podcast: any) => void;
}

const PodcastContent: React.FC<PodcastContentProps> = ({
  selectedNoteIds = [],
  selectedDocumentIds = [],
  onClose,
  onPodcastGenerated,
}) => {
  return (
    <div>
      <h2>Podcast Content</h2>
      <p>This is a placeholder for the PodcastContent component.</p>
    </div>
  );
};

export default PodcastContent;