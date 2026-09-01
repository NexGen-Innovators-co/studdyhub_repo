import { useState, useEffect } from 'react';
import { apiClient } from '@/services/apiClient';

export function useUserResources(userId: string | null) {
  const [userNotes, setUserNotes] = useState<any[]>([]);
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [userClassRecordings, setUserClassRecordings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      apiClient.get('notes', { user_id: userId }),
      apiClient.get('documents', { user_id: userId }),
      apiClient.get('class-recordings', { user_id: userId }),
    ]).then(([notesData, documentsData, recordingsData]) => {
      if (cancelled) return;
      if (notesData) setUserNotes(notesData);
      if (documentsData) setUserDocuments(documentsData);
      if (recordingsData) setUserClassRecordings(recordingsData);
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [userId]);

  return { userNotes, userDocuments, userClassRecordings, isLoadingResources: isLoading };
}
