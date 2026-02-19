import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../../integrations/supabase/client';
import { generateId } from '../utils/helpers';
import { ClassRecording } from '../../../types/Class';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { Note } from '../../../types/Note';

interface UseAudioProcessingProps {
  onAddRecording: (recording: ClassRecording) => void;
  onUpdateRecording: (recording: ClassRecording) => void;
  onNoteCreated?: (note: Note) => void;
  onRefreshNotes?: () => Promise<void>;
}

interface AudioDetails {
  url: string;
  type: string;
  name: string;
  document_id: string;
}

export const useAudioProcessing = ({ onAddRecording, onUpdateRecording, onNoteCreated, onRefreshNotes }: UseAudioProcessingProps) => {
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [uploadedAudioDetails, setUploadedAudioDetails] = useState<AudioDetails | null>(null);
  const [isAudioOptionsVisible, setIsAudioOptionsVisible] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);

  const checkAndFixDurations = useCallback(async (recordings: ClassRecording[]) => {
    // Filter for recordings that have invalid duration but have content we can use
    const invalidRecordings = recordings.filter(
      r => (r.duration === 0 || r.duration === null) && (r.transcript || r.audioUrl)
    );

    if (invalidRecordings.length === 0) return;

    // // console.log(`Found ${invalidRecordings.length} recordings with invalid duration. Attempting fix...`);

    for (const recording of invalidRecordings) {
      let newDuration = 0;

      // Plan A: Estimate from transcript (Fastest, cheapest)
      if (recording.transcript && recording.transcript.length > 50) {
          const wordCount = recording.transcript.split(/\s+/).length;
          // Approx 150 words per minute
          newDuration = Math.ceil((wordCount / 150) * 60);
      }

      // Plan B: Retrieve from audio metadata (if Plan A failed or too short)
      // Only do this if we have no transcript estimate
      if ((newDuration === 0) && recording.audioUrl) {
         try {
             // Create a temporary audio element to check metadata
             const tempAudio = new Audio(recording.audioUrl);
             // Wait for metadata with a timeout
             const duration = await new Promise<number>((resolve) => {
                 const timeout = setTimeout(() => resolve(0), 5000);
                 tempAudio.onloadedmetadata = () => {
                     clearTimeout(timeout);
                     resolve(tempAudio.duration);
                 };
                 tempAudio.onerror = () => {
                     clearTimeout(timeout);
                     resolve(0);
                 }
             });
             if (duration > 0) newDuration = Math.floor(duration);
         } catch (e) {
             // Ignore error
         }
      }

      // Apply update if we found a valid duration
      if (newDuration > 0) {
        const { error } = await supabase
          .from('class_recordings')
          .update({ duration: newDuration })
          .eq('id', recording.id);
        
        if (!error) {
             // Update local state immediately
             onUpdateRecording({ ...recording, duration: newDuration });
             // toast.success(`Fixed duration for "${recording.title}"`);
        }
      }
    }
  }, [onUpdateRecording]);

  const triggerAudioUpload = useCallback(() => {
    audioInputRef.current?.click();
  }, []);

  const handlePlayAudio = useCallback(() => {
    if (audioPlayerRef.current && audioPlayerRef.current.src) {
      audioPlayerRef.current.play().then(() => {
        setIsPlayingAudio(true);
      }).catch(e => {

        toast.error('Failed to play audio. Please try again.');
        setIsPlayingAudio(false);
      });
    } else {
      toast.error('No audio file loaded.');
    }
  }, []);

  const handlePauseAudio = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    }
  }, []);

  const handleAudioEnded = useCallback(() => {
    setIsPlayingAudio(false);
  }, []);

  const handleDownloadAudio = useCallback(() => {
    if (!audioPlayerRef.current || !audioPlayerRef.current.src) {
      toast.info('No audio file to download.');
      return;
    }
    const link = document.createElement('a');
    link.href = audioPlayerRef.current.src;
    const urlParts = audioPlayerRef.current.src.split('/');
    const fileName = urlParts[urlParts.length - 1].split('?')[0] || 'downloaded_audio.webm';
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audio file downloaded!');
  }, []);

  const handleCopyAudioUrl = useCallback(() => {
    if (!audioPlayerRef.current || !audioPlayerRef.current.src) {
      toast.info('No audio URL to copy.');
      return;
    }
    navigator.clipboard.writeText(audioPlayerRef.current.src).then(() => {
      toast.success('Audio URL copied to clipboard!');
    }).catch(err => {

      toast.error('Failed to copy audio URL.');
    });
  }, []);

  const triggerAudioProcessing = useCallback(async (fileUrl: string, documentId: string, targetLang: string = 'en', recordingId?: string) => {
    setIsProcessingAudio(true);
    const toastId = toast.loading('Sending audio for AI processing...');
    try {
      const { data, error } = await supabase.functions.invoke('gemini-audio-processor', {
        body: {
          file_url: fileUrl,
          target_language: targetLang,
          recording_id: recordingId // Pass ID for background processing
        },
      });

      if (error) throw error;
      
      // Handle Background Processing Response (202 Accepted)
      if (data?.status === 'pending') {
         toast.success('Processing started in background. You will be notified when complete.', { id: toastId });
         setIsProcessingAudio(false);
         // Update local processing status if needed via onUpdateRecording logic, 
         // but the optimisic UI should handle "processing" state.
         return; 
      }

      if (!data || !data.transcript || !data.summary) {
        throw new Error('Invalid response from audio processor: Missing transcript or summary.');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: updateDocError } = await supabase
        .from('documents')
        .update({
          content_extracted: data.transcript,
          processing_status: 'completed',
          processing_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)
        .eq('user_id', user.id);

      if (updateDocError) {
        throw new Error(`Failed to update document: ${updateDocError.message}`);
      }

      // Prepare update object for recording
      const recordingUpdate: any = {
        transcript: data.transcript,
        summary: data.summary,
        updated_at: new Date().toISOString(),
      };

      // Update duration if returned from processor and current duration is 0 or null
      if (data.duration) {
        const { data: currentRecording } = await supabase
          .from('class_recordings')
          .select('duration')
          .eq('document_id', documentId)
          .eq('user_id', user.id)
          .single();

        if (currentRecording && (currentRecording.duration === 0 || currentRecording.duration === null)) {
          recordingUpdate.duration = data.duration;
        }
      }

      const { error: updateRecordingError } = await supabase
        .from('class_recordings')
        .update(recordingUpdate)
        .eq('document_id', documentId)
        .eq('user_id', user.id);

      if (updateRecordingError) {
        //console.error('Error updating class recording with processed audio:', updateRecordingError);
        throw new Error(`Failed to update recording: ${updateRecordingError.message}`);
      }

      const { data: fetchedRecording, error: fetchError } = await supabase
        .from('class_recordings')
        .select('*')
        .eq('document_id', documentId)
        .eq('user_id', user.id)
        .single();

      if (fetchedRecording && !fetchError) {
        const updatedRecording: ClassRecording = {
          id: fetchedRecording.id,
          title: fetchedRecording.title,
          subject: fetchedRecording.subject,
          audioUrl: fetchedRecording.audio_url,
          audio_url: fetchedRecording.audio_url,
          transcript: fetchedRecording.transcript,
          summary: fetchedRecording.summary,
          duration: fetchedRecording.duration,
          date: fetchedRecording.date,
          created_at: fetchedRecording.created_at,
          userId: fetchedRecording.user_id,
          user_id: fetchedRecording.user_id,
          document_id: fetchedRecording.document_id
        };
        onUpdateRecording(updatedRecording);
      } else {
        //console.error('Failed to refetch updated recording after processing:', fetchError?.message);
      }

      setTranslatedContent(data.translated_content || null);
      toast.success('Audio processing completed!', { id: toastId });

    } catch (error: any) {
      let errorMessage = 'Failed to process audio.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `Function error (${error.context.status}): ${error.context.statusText}. Check function logs.`;
        if (error.message.includes("The model is overloaded")) {
          errorMessage = "AI model is currently overloaded. Please try again in a few moments.";
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes("The model is overloaded")) {
          errorMessage = "AI model is currently overloaded. Please try again in a few moments.";
        }
      }
      toast.error(errorMessage, { id: toastId });
      //console.error('Error during audio processing:', error);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('documents')
          .update({
            processing_status: 'failed',
            processing_error: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', documentId)
          .eq('user_id', user.id);
      }
    } finally {
      setIsProcessingAudio(false);
      setIsAudioOptionsVisible(false);
    }
  }, [onUpdateRecording]);

  const handleAudioFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast.error('No file selected.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Not authenticated.');
      return;
    }

    // CHECK SUBSCRIPTION LIMITS BEFORE ATTEMPTING UPLOAD
    const { data: subscriptionData } = await supabase
      .from('subscriptions')
      .select('subscription_tier')
      .eq('user_id', user.id)
      .single();
    
    const tier = subscriptionData?.subscription_tier || 'free';
    const maxRecordings = tier === 'free' ? 50 : tier === 'scholar' ? 500 : Infinity;
    
    // Count existing recordings
    const { count: recordingCount } = await supabase
      .from('class_recordings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    
    if (recordingCount && recordingCount >= maxRecordings) {
      toast.error(`Recording limit reached (${maxRecordings}). You have created ${recordingCount} recordings.`, {
        action: {
          label: 'Upgrade',
          onClick: () => window.location.href = '/subscription'
        },
        duration: 5000
      });
      return;
    }

    const allowedAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/webm'];
    if (!allowedAudioTypes.includes(file.type)) {
      toast.error('Unsupported audio file type. Please upload an MP3, WAV, M4A, or WebM file.');
      if (event.target) event.target.value = '';
      return;
    }

    // Supabase Free Tier Limit Check (50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
        toast.error('File exceeds the 50MB upload limit. Please compress the audio or split it into smaller parts.', { duration: 5000 });
        if (event.target) event.target.value = '';
        return;
    }

    setIsProcessingAudio(true);
    const toastId = toast.loading('Uploading audio file...');

    try {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${user.id}/recordings/${generateId()}_${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) {
        if (uploadError.message.includes('The object exceeded the maximum allowed size')) {
          throw new Error('File is too large. Please ask an admin to increase the "documents" bucket size limit in Supabase.');
        }
        throw new Error(`Audio upload failed: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Could not get public URL for the uploaded audio file.');
      }

      const newDocumentId = generateId();
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          id: newDocumentId,
          user_id: user.id,
          title: `Uploaded Audio: ${file.name}`,
          file_name: file.name,
          file_type: file.type,
          file_url: urlData.publicUrl,
          content_extracted: 'Processing audio for content...',
          file_size: file.size,
          type: 'audio',
          processing_status: 'processing',
          processing_error: null,
        });

      if (docError) throw new Error(docError?.message || 'Failed to create document record for audio.');

      // Calculate duration for uploaded audio
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio(audioUrl);
      const durationPromise = new Promise<number>((resolve) => {
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => resolve(0);
      });
      const uploadedDuration = await durationPromise;
      URL.revokeObjectURL(audioUrl);

      const newRecording: ClassRecording = {
        id: generateId(),
        title: `Uploaded Audio: ${file.name}`,
        subject: 'Uploaded Audio',
        audioUrl: urlData.publicUrl,
        audio_url: urlData.publicUrl,
        transcript: '',
        summary: '',
        duration: Math.floor(uploadedDuration),
        date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        userId: user.id,
        user_id: user.id,
        document_id: newDocumentId
      };

      const { error: insertRecordingError } = await supabase
        .from('class_recordings')
        .insert({
          id: newRecording.id,
          user_id: newRecording.userId,
          title: newRecording.title,
          audio_url: newRecording.audioUrl,
          transcript: newRecording.transcript,
          summary: newRecording.summary,
          duration: newRecording.duration,
          subject: newRecording.subject,
          date: newRecording.date,
          created_at: newRecording.created_at,
          document_id: newRecording.document_id
        });

      if (insertRecordingError) throw new Error(`Failed to save recording to database: ${insertRecordingError.message}`);

      setUploadedAudioDetails({ url: urlData.publicUrl, type: file.type, name: file.name, document_id: newDocumentId });
      setIsAudioOptionsVisible(true);
      toast.success('Audio file uploaded. Initiating AI processing...', { id: toastId });
      onAddRecording(newRecording);

      await triggerAudioProcessing(urlData.publicUrl, newDocumentId, 'en', newRecording.id);

    } catch (error: any) {
      let errorMessage = 'An unknown error occurred during audio upload.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: toastId });
      //console.error('Error during audio upload:', error);
      setIsProcessingAudio(false);
    } finally {
      if (event.target) event.target.value = '';
    }
  }, [onAddRecording, triggerAudioProcessing]);

  const handleRecordingComplete = useCallback(async (audioBlob: Blob, title: string, subject: string, trackedDurationSeconds?: number) => {
    setIsProcessingAudio(true);
    const toastId = toast.loading('Saving recording and initiating AI processing...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileName = `${user.id}/recordings/${generateId()}-${title}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Use tracked wall-clock duration if provided (accurate for chunked recordings).
      // Fall back to Audio element metadata only when no tracked duration is available,
      // but note that WebM blobs from chunked MediaRecorder often report only the
      // first chunk's duration, making this unreliable.
      let duration = 0;
      if (trackedDurationSeconds && trackedDurationSeconds > 0) {
        duration = trackedDurationSeconds;
      } else {
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        const metadataDuration = await new Promise<number>((resolve) => {
          const timeout = setTimeout(() => resolve(0), 5000); // Don't wait forever
          audio.onloadedmetadata = () => {
            clearTimeout(timeout);
            // Infinity/NaN is common with MediaRecorder WebM
            const d = audio.duration;
            resolve(isFinite(d) && d > 0 ? d : 0);
          };
          audio.onerror = () => { clearTimeout(timeout); resolve(0); };
        });
        URL.revokeObjectURL(audioUrl);
        duration = metadataDuration;
      }

      const newDocumentId = generateId();
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          id: newDocumentId,
          user_id: user.id,
          title: `Class Recording: ${title}`,
          file_name: `${title}.webm`,
          file_type: 'audio/webm',
          file_url: publicUrl,
          content_extracted: 'Processing audio for content...',
          file_size: audioBlob.size,
          type: 'audio',
          processing_status: 'processing',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          processing_error: null,
        });

      if (docError) throw new Error(docError?.message || 'Failed to create document record for audio.');

      const newRecording: ClassRecording = {
        id: generateId(),
        title,
        subject,
        audioUrl: publicUrl,
        audio_url: publicUrl,
        transcript: '',
        summary: '',
        duration: Math.floor(duration),
        date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        userId: user.id,
        user_id: user.id,
        document_id: newDocumentId
      };

      const { error: insertError } = await supabase
        .from('class_recordings')
        .insert({
          id: newRecording.id,
          user_id: newRecording.userId,
          title: newRecording.title,
          audio_url: newRecording.audioUrl,
          transcript: newRecording.transcript,
          summary: newRecording.summary,
          duration: newRecording.duration,
          subject: newRecording.subject,
          date: newRecording.date,
          created_at: newRecording.created_at,
          document_id: newRecording.document_id
        });

      if (insertError) throw new Error(`Failed to save recording to database: ${insertError.message}`);

      onAddRecording(newRecording);
      toast.success('Recording saved, initiating AI processing...', { id: toastId });

      await triggerAudioProcessing(publicUrl, newDocumentId, 'en', newRecording.id);

    } catch (error: any) {
      let errorMessage = 'Failed to process recording.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: toastId });
      //console.error('Error in handleRecordingComplete:', error);
      setIsProcessingAudio(false);
    }
  }, [onAddRecording, triggerAudioProcessing]);

  const handleGenerateNoteFromAudio = useCallback(async (recording: ClassRecording) => {
    if (!recording.document_id) {
      toast.error('Linked document ID missing for this recording.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Not authenticated.');
      return;
    }

    setIsGeneratingNote(true);
    const toastId = toast.loading('Initiating full note generation from audio...');

    try {
      const { data: documentData, error: docFetchError } = await supabase
        .from('documents')
        .select('content_extracted')
        .eq('id', recording.document_id)
        .single();

      let contentToUse = documentData?.content_extracted || '';

      if (!contentToUse || contentToUse === 'Processing audio for content...') {
        toast.error('Audio content not yet extracted. Please wait for audio processing to complete or re-process the audio.', { id: toastId });
        setIsGeneratingNote(false);
        return;
      }

      const { data: newNote, error: generationError } = await supabase.functions.invoke('generate-note-from-document', {
        body: {
          documentId: recording.document_id,
          userProfile: {
            learning_style: 'visual',
            learning_preferences: {
              explanation_style: 'detailed and comprehensive',
              examples: true,
              difficulty: 'intermediate'
            }
          },
          selectedSection: null,
        },
      });

      if (generationError) throw new Error(generationError.message || 'Failed to generate note.');

      // Safely update the client-side state if the callback is provided
      if (newNote && onNoteCreated) {
        onNoteCreated(newNote);
      }
      
      // Ensure local data is consistent with server
      if (onRefreshNotes) {
        onRefreshNotes(); 
      }

      // Notify success - the Edge Function already inserted the note into the 'notes' table
      toast.success('Note generated successfully! Check your Notes tab.', { id: toastId });


    } catch (error: any) {
      let errorMessage = 'Failed to start audio note generation.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `Function error (${error.context.status}): ${error.context.statusText}. Check function logs.`;
        if (errorMessage.includes('The model is overloaded')) {
          errorMessage = 'AI model is currently overloaded. Please try again in a few moments.';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes('The model is overloaded')) {
          errorMessage = 'AI model is currently overloaded. Please try again in a few moments.';
        }
      }
      toast.error(errorMessage, { id: toastId });
      //console.error('Error initiating audio note generation:', error);
    } finally {
      setIsGeneratingNote(false);
    }
  }, [onUpdateRecording]);

  const handleClearAudioProcessing = useCallback(() => {
    setUploadedAudioDetails(null);
    setIsAudioOptionsVisible(false);
    setIsProcessingAudio(false);
    setIsGeneratingNote(false);
    setTranslatedContent(null);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current.src = '';
      setIsPlayingAudio(false);
    }
    toast.dismiss('audio-job-status');
  }, [setTranslatedContent]);

  return {
    isProcessingAudio,
    uploadedAudioDetails,
    isAudioOptionsVisible,
    audioInputRef,
    audioPlayerRef,
    isPlayingAudio,
    isGeneratingNote,
    translatedContent,
    triggerAudioUpload,
    handleAudioFileSelect,
    handleRecordingComplete,
    handleGenerateNoteFromAudio,
    handlePlayAudio,
    handlePauseAudio,
    handleAudioEnded,
    handleDownloadAudio,
    handleCopyAudioUrl,
    handleClearAudioProcessing,
    setTranslatedContent,
    triggerAudioProcessing,
    checkAndFixDurations // Exported function
  };
};
