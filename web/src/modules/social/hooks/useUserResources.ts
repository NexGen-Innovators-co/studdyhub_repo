import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
      supabase.from('notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      supabase.from('documents').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      supabase.from('class_recordings').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    ]).then(([notesResult, documentsResult, recordingsResult]) => {
      if (cancelled) return;
      if (notesResult.data) setUserNotes(notesResult.data);
      if (documentsResult.data) setUserDocuments(documentsResult.data);
      if (recordingsResult.data) setUserClassRecordings(recordingsResult.data);
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [userId]);

  return { userNotes, userDocuments, userClassRecordings, isLoadingResources: isLoading };
}
