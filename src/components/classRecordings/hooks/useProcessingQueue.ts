// hooks/useProcessingQueue.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProcessingJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  estimatedTimeRemaining: number | null;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
  result: any | null;
  title: string;
  type: 'transcription' | 'summarization' | 'quiz_generation';
}

interface UseProcessingQueueOptions {
  userId: string;
  onJobComplete?: (job: ProcessingJob) => void;
  onJobError?: (job: ProcessingJob) => void;
  pollInterval?: number;
}

export function useProcessingQueue(options: UseProcessingQueueOptions) {
  const { userId, onJobComplete, onJobError, pollInterval = 3000 } = options;

  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch all jobs for user
  const fetchJobs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('audio_processing_results')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedJobs: ProcessingJob[] = (data || []).map(item => ({
        id: item.id,
        status: item.status as ProcessingJob['status'],
        progress: item.status === 'completed' ? 100 : item.status === 'processing' ? 50 : 0,
        estimatedTimeRemaining: estimateRemainingTime(item),
        startedAt: item.created_at ? new Date(item.created_at).getTime() : null,
        completedAt: item.updated_at && item.status === 'completed' 
          ? new Date(item.updated_at).getTime() 
          : null,
        error: item.error_message,
        result: item.status === 'completed' ? {
          transcript: item.transcript,
          summary: item.summary,
          translatedContent: item.translated_content
        } : null,
        title: `Audio Processing - ${new Date(item.created_at).toLocaleString()}`,
        type: 'transcription'
      }));

      setJobs(mappedJobs);
      setIsLoading(false);

      // Check for newly completed or errored jobs
      mappedJobs.forEach(job => {
        const existingJob = jobs.find(j => j.id === job.id);
        if (existingJob?.status !== job.status) {
          if (job.status === 'completed') {
            onJobComplete?.(job);
          } else if (job.status === 'error') {
            onJobError?.(job);
          }
        }
      });

    } catch (err) {

      setIsLoading(false);
    }
  }, [userId, jobs, onJobComplete, onJobError]);

  // Start polling for active jobs
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;

    pollingRef.current = setInterval(() => {
      const hasActiveJobs = jobs.some(
        job => job.status === 'pending' || job.status === 'processing'
      );
      if (hasActiveJobs) {
        fetchJobs();
      }
    }, pollInterval);
  }, [jobs, fetchJobs, pollInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Add a new job to the queue
  const addJob = useCallback((job: Partial<ProcessingJob> & { id: string; title: string; type: ProcessingJob['type'] }) => {
    const newJob: ProcessingJob = {
      status: 'pending',
      progress: 0,
      estimatedTimeRemaining: null,
      startedAt: Date.now(),
      completedAt: null,
      error: null,
      result: null,
      ...job
    };

    setJobs(prev => [newJob, ...prev]);
    startPolling();
  }, [startPolling]);

  // Cancel a job (if supported)
  const cancelJob = useCallback(async (jobId: string) => {
    // For now, just mark as cancelled locally
    // In a real implementation, this would call an API to cancel
    setJobs(prev => prev.map(job => 
      job.id === jobId 
        ? { ...job, status: 'error' as const, error: 'Cancelled by user' }
        : job
    ));
  }, []);

  // Clear completed jobs
  const clearCompletedJobs = useCallback(() => {
    setJobs(prev => prev.filter(job => 
      job.status !== 'completed' && job.status !== 'error'
    ));
  }, []);

  // Get job by ID
  const getJob = useCallback((jobId: string) => {
    return jobs.find(job => job.id === jobId);
  }, [jobs]);

  // Setup real-time subscription
  useEffect(() => {
    fetchJobs();

    const channel = supabase
      .channel('processing-queue')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audio_processing_results',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopPolling();
    };
  }, [userId, fetchJobs, stopPolling]);

  // Start/stop polling based on active jobs
  useEffect(() => {
    const hasActiveJobs = jobs.some(
      job => job.status === 'pending' || job.status === 'processing'
    );

    if (hasActiveJobs) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [jobs, startPolling, stopPolling]);

  return {
    jobs,
    isLoading,
    activeJobs: jobs.filter(j => j.status === 'pending' || j.status === 'processing'),
    completedJobs: jobs.filter(j => j.status === 'completed'),
    failedJobs: jobs.filter(j => j.status === 'error'),
    addJob,
    cancelJob,
    clearCompletedJobs,
    getJob,
    refresh: fetchJobs
  };
}

// Helper to estimate remaining time based on average processing time
function estimateRemainingTime(item: any): number | null {
  if (item.status !== 'processing') return null;
  
  // Average processing time is about 30 seconds per minute of audio
  // This is a rough estimate
  const startTime = new Date(item.created_at).getTime();
  const elapsed = (Date.now() - startTime) / 1000;
  const estimatedTotal = 60; // Default estimate of 60 seconds
  
  return Math.max(0, estimatedTotal - elapsed);
}
