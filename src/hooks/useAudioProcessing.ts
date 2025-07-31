// hooks/useAudioProcessing.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generateId } from '../utils/helpers';
import { ClassRecording } from '../types/Class';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface UseAudioProcessingProps {
  onAddRecording: (recording: ClassRecording) => void;
  onUpdateRecording: (recording: ClassRecording) => void; // New prop for updating existing recordings
}

interface AudioDetails {
  url: string;
  type: string;
  name: string;
  document_id: string;
}

export const useAudioProcessing = ({ onAddRecording, onUpdateRecording }: UseAudioProcessingProps) => {
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [uploadedAudioDetails, setUploadedAudioDetails] = useState<AudioDetails | null>(null);
  const [isAudioOptionsVisible, setIsAudioOptionsVisible] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  // Removed audioProcessingJobId state
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);

  const triggerAudioUpload = useCallback(() => {
    audioInputRef.current?.click();
  }, []);

  // Centralized function to trigger audio processing Edge Function
  const triggerAudioProcessing = useCallback(async (fileUrl: string, documentId: string, userId: string, targetLang: string = 'en') => {
    setIsProcessingAudio(true);
    const toastId = toast.loading('Sending audio for AI processing (transcription, summary)...');
    try {
      const { data, error } = await supabase.functions.invoke('gemini-audio-processor', {
        body: {
          file_url: fileUrl,
          target_language: targetLang,
          // Removed user_id and document_id from body as they are no longer needed by the simplified function
        },
      });

      if (error) throw error;
      if (!data || (!data.transcript && !data.summary)) throw new Error('No transcription or summary received from audio processor.');

      // Update the corresponding ClassRecording and Document directly
      // Fetch the existing recording to merge new data
      const { data: existingRecording, error: fetchRecordingError } = await supabase
        .from('class_recordings')
        .select('*')
        .eq('document_id', documentId)
        .eq('user_id', userId)
        .single();

      if (fetchRecordingError || !existingRecording) {
        console.error('Failed to fetch existing recording for update:', fetchRecordingError?.message);
        toast.error('Failed to update recording details after processing.', { id: toastId });
        return;
      }

      const updatedRecording: ClassRecording = {
        id: existingRecording.id,
        title: existingRecording.title,
        subject: existingRecording.subject,
        audioUrl: existingRecording.audio_url,
        transcript: data.transcript || existingRecording.transcript,
        summary: data.summary || existingRecording.summary,
        duration: existingRecording.duration,
        date: existingRecording.date,
        createdAt: existingRecording.created_at,
        userId: existingRecording.user_id,
        document_id: existingRecording.document_id
      };

      const { error: updateRecordingError } = await supabase
        .from('class_recordings')
        .update({
          transcript: updatedRecording.transcript,
          summary: updatedRecording.summary,
        })
        .eq('document_id', documentId)
        .eq('user_id', userId);

      if (updateRecordingError) {
        console.error('Failed to update class recording after processing:', updateRecordingError.message);
        toast.error('Failed to update recording details after processing.', { id: toastId });
      }

      // Update the content_extracted in the documents table
      const { error: updateDocumentError } = await supabase
        .from('documents')
        .update({
          content_extracted: updatedRecording.transcript,
          processing_status: updateRecordingError ? 'error' : 'completed',
          processing_error: null
        })
        .eq('id', documentId)
        .eq('user_id', userId);

      if (updateDocumentError) {
        console.error('Failed to update document content_extracted after processing:', updateDocumentError.message);
      }

      onUpdateRecording(updatedRecording); // Update the client-side state
      setTranslatedContent(data.translated_content || null);

      toast.success('Audio processing completed!', { id: toastId });
    } catch (error) {
      let errorMessage = 'Failed to start audio processing.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `Function error (${error.context.status}): ${error.context.statusText}. Check function logs.`;
        if (error.message.includes("The model is overloaded")) {
          errorMessage = "AI model is currently overloaded. Please try again in a few moments.";
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes("The model is overloaded")) {
          errorMessage = "AI model is currently overloaded. Please try again in a few moments.";
        }
      }
      toast.error(errorMessage, { id: toastId });
      console.error('Error initiating audio processing:', error);
    } finally {
      setIsProcessingAudio(false); // Ensure loading state is reset on error or completion
      setIsAudioOptionsVisible(false); // Hide options after processing
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

    const allowedAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/webm'];
    if (!allowedAudioTypes.includes(file.type)) {
      toast.error('Unsupported audio file type. Please upload an MP3, WAV, M4A, or WebM file.');
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

      if (uploadError) throw new Error(`Audio upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Could not get public URL for the uploaded audio file.');
      }

      // Create a new document entry for the audio file first
      const { data: newDocument, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          title: `Uploaded Audio: ${file.name}`,
          file_name: file.name,
          file_url: urlData.publicUrl,
          content_extracted: 'Processing audio for content...', // Placeholder
          file_type: file.type,
          type: 'audio', // Specify the type as 'audio'
          processing_status: 'processing', // Set initial processing status
          processing_error: null, // Initialize processing_error
        })
        .select('id')
        .single();

      if (docError || !newDocument) throw new Error(docError?.message || 'Failed to create document record for audio.');

      // Create a new ClassRecording entry (initially with empty transcript/summary)
      const newRecording: ClassRecording = {
        id: generateId(),
        title: `Uploaded Audio: ${file.name}`,
        subject: 'Uploaded Audio',
        audioUrl: urlData.publicUrl,
        transcript: '', // Will be filled by processing
        summary: '',     // Will be filled by processing
        duration: 0, // Will be updated if we can get it from metadata
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        userId: user.id,
        document_id: newDocument.id
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
          created_at: newRecording.createdAt,
          document_id: newRecording.document_id
        });

      if (insertRecordingError) throw new Error(`Failed to save recording to database: ${insertRecordingError.message}`);

      setUploadedAudioDetails({ url: urlData.publicUrl, type: file.type, name: file.name, document_id: newDocument.id });
      setIsAudioOptionsVisible(true);
      toast.success('Audio file uploaded. Initiating AI processing...', { id: toastId });
      onAddRecording(newRecording); // Add the new recording to the state immediately

      // Now trigger the AI processing for this newly uploaded audio
      await triggerAudioProcessing(urlData.publicUrl, newDocument.id, user.id);

    } catch (error) {
      let errorMessage = 'An unknown error occurred during audio upload.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: toastId });
      console.error('Error during audio upload:', error);
      setIsProcessingAudio(false); // Ensure loading state is reset on error
    } finally {
      if (event.target) event.target.value = '';
    }
  }, [onAddRecording, triggerAudioProcessing]);

  const handleRecordingComplete = useCallback(async (audioBlob: Blob, title: string, subject: string) => {
    setIsProcessingAudio(true); // Renamed from isProcessing
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

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      const durationPromise = new Promise<number>((resolve) => {
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => resolve(0);
      });
      const duration = await durationPromise;
      URL.revokeObjectURL(audioUrl);

      const { data: newDocument, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          title: `Class Recording: ${title}`,
          file_name: `${title}.webm`,
          file_url: publicUrl,
          content_extracted: 'Processing audio for content...',
          file_type: 'audio/webm',
          type: 'audio',
          processing_status: 'processing',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          processing_error: null,
        })
        .select('id')
        .single();

      if (docError || !newDocument) throw new Error(docError?.message || 'Failed to create document record for audio.');

      const newRecording: ClassRecording = {
        id: generateId(),
        title,
        subject,
        audioUrl: publicUrl,
        transcript: '',
        summary: '',
        duration: Math.floor(duration),
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        userId: user.id,
        document_id: newDocument.id
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
          created_at: newRecording.createdAt,
          document_id: newRecording.document_id
        });

      if (insertError) throw new Error(`Failed to save recording to database: ${insertError.message}`);

      onAddRecording(newRecording);
      toast.success('Recording saved, initiating AI processing...', { id: toastId });

      await triggerAudioProcessing(publicUrl, newDocument.id, user.id);

    } catch (error) {
      let errorMessage = 'Failed to process recording.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: toastId });
      console.error('Error in handleRecordingComplete:', error);
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

      // Call the generate-note-from-document Edge Function
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

      // Update the class recording and document with the generated note content and summary
      const { error: updateRecordingError } = await supabase
        .from('class_recordings')
        .update({
          transcript: newNote.content,
          summary: newNote.ai_summary,
        })
        .eq('document_id', recording.document_id)
        .eq('user_id', user.id);

      if (updateRecordingError) {
        console.error('Failed to update class recording with generated note:', updateRecordingError.message);
        toast.error('Note generated, but failed to update recording details.', { id: toastId });
      } else {
        toast.success('Note generated and recording updated!', { id: toastId });
        // Fetch the updated recording to ensure all fields are correct before passing to onUpdateRecording
        const { data: fetchedRecording, error: fetchError } = await supabase
          .from('class_recordings')
          .select('*')
          .eq('document_id', recording.document_id)
          .eq('user_id', user.id)
          .single();

        if (fetchedRecording && !fetchError) {
          const updatedRecording: ClassRecording = {
            id: fetchedRecording.id,
            title: fetchedRecording.title,
            subject: fetchedRecording.subject,
            audioUrl: fetchedRecording.audio_url,
            transcript: fetchedRecording.transcript,
            summary: fetchedRecording.summary,
            duration: fetchedRecording.duration,
            date: fetchedRecording.date,
            createdAt: fetchedRecording.created_at,
            userId: fetchedRecording.user_id,
            document_id: fetchedRecording.document_id
          };
          onUpdateRecording(updatedRecording); // Use onUpdateRecording
        } else {
          console.error('Failed to refetch updated recording:', fetchError?.message);
        }
      }

    } catch (error) {
      let errorMessage = 'Failed to start audio note generation.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `Function error (${error.context.status}): ${error.context.statusText}. Check function logs.`;
        if (error.message.includes('The model is overloaded')) {
          errorMessage = 'AI model is currently overloaded. Please try again in a few moments.';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes('The model is overloaded')) {
          errorMessage = 'AI model is currently overloaded. Please try again in a few moments.';
        }
      }
      toast.error(errorMessage, { id: toastId });
      console.error('Error initiating audio note generation:', error);
    } finally {
      setIsGeneratingNote(false);
    }
  }, [onUpdateRecording]);

  // Removed useEffect for polling job status

  const handlePlayAudio = useCallback(() => {
    if (audioPlayerRef.current && uploadedAudioDetails) {
      if (isPlayingAudio) {
        audioPlayerRef.current.pause();
      } else {
        audioPlayerRef.current.play();
      }
      setIsPlayingAudio(!isPlayingAudio);
    } else {
      toast.info('No audio file to play.');
    }
  }, [isPlayingAudio, uploadedAudioDetails]);

  const handleAudioEnded = useCallback(() => {
    setIsPlayingAudio(false);
  }, []);

  const handleDownloadAudio = useCallback(() => {
    if (!uploadedAudioDetails) {
      toast.info('No audio file to download.');
      return;
    }
    const link = document.createElement('a');
    link.href = uploadedAudioDetails.url;
    link.download = uploadedAudioDetails.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audio file downloaded!');
  }, [uploadedAudioDetails]);

  const handleCopyAudioUrl = useCallback(() => {
    if (!uploadedAudioDetails) {
      toast.info('No audio URL to copy.');
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = uploadedAudioDetails.url;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      toast.success('Audio URL copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      toast.error('Failed to copy audio URL.');
    } finally {
      document.body.removeChild(textarea);
    }
  }, [uploadedAudioDetails]);

  const handleClearAudioProcessing = useCallback(() => {
    setUploadedAudioDetails(null);
    setIsAudioOptionsVisible(false);
    // Removed setAudioProcessingJobId(null)
    setIsProcessingAudio(false);
    setIsGeneratingNote(false);
    setTranslatedContent(null);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
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
    handleAudioEnded,
    handleDownloadAudio,
    handleCopyAudioUrl,
    handleClearAudioProcessing,
    setTranslatedContent,
  };
};
