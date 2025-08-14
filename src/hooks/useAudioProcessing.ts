import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../integrations/supabase/client';
import { generateId } from '../utils/helpers';
import { ClassRecording } from '../types/Class';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface UseAudioProcessingProps {
  onAddRecording: (recording: ClassRecording) => void;
  onUpdateRecording: (recording: ClassRecording) => void;
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
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);

  const triggerAudioUpload = useCallback(() => {
    audioInputRef.current?.click();
  }, []);

  const handlePlayAudio = useCallback(() => {
    if (audioPlayerRef.current && audioPlayerRef.current.src) {
      audioPlayerRef.current.play().then(() => {
        setIsPlayingAudio(true);
      }).catch(e => {
        console.error("Error playing audio:", e);
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
      console.error('Failed to copy audio URL:', err);
      toast.error('Failed to copy audio URL.');
    });
  }, []);

  const triggerAudioProcessing = useCallback(async (fileUrl: string, documentId: string, targetLang: string = 'en') => {
    setIsProcessingAudio(true);
    const toastId = toast.loading('Sending audio for AI processing (transcription, summary)...');
    try {
      const { data, error } = await supabase.functions.invoke('gemini-audio-processor', {
        body: {
          file_url: fileUrl,
          target_language: targetLang,
        },
      });

      if (error) throw error;
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
        console.error('Error updating document with processed audio:', updateDocError);
        throw new Error(`Failed to update document: ${updateDocError.message}`);
      }

      const { error: updateRecordingError } = await supabase
        .from('class_recordings')
        .update({
          transcript: data.transcript,
          summary: data.summary,
          updated_at: new Date().toISOString(),
        })
        .eq('document_id', documentId)
        .eq('user_id', user.id);

      if (updateRecordingError) {
        console.error('Error updating class recording with processed audio:', updateRecordingError);
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
          transcript: fetchedRecording.transcript,
          summary: fetchedRecording.summary,
          duration: fetchedRecording.duration,
          date: fetchedRecording.date,
          createdAt: fetchedRecording.created_at,
          userId: fetchedRecording.user_id,
          document_id: fetchedRecording.document_id
        };
        onUpdateRecording(updatedRecording);
      } else {
        console.error('Failed to refetch updated recording after processing:', fetchError?.message);
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
      console.error('Error during audio processing:', error);

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

      const newRecording: ClassRecording = {
        id: generateId(),
        title: `Uploaded Audio: ${file.name}`,
        subject: 'Uploaded Audio',
        audioUrl: urlData.publicUrl,
        transcript: '',
        summary: '',
        duration: 0,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        userId: user.id,
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
          created_at: newRecording.createdAt,
          document_id: newRecording.document_id
        });

      if (insertRecordingError) throw new Error(`Failed to save recording to database: ${insertRecordingError.message}`);

      setUploadedAudioDetails({ url: urlData.publicUrl, type: file.type, name: file.name, document_id: newDocumentId });
      setIsAudioOptionsVisible(true);
      toast.success('Audio file uploaded. Initiating AI processing...', { id: toastId });
      onAddRecording(newRecording);

      await triggerAudioProcessing(urlData.publicUrl, newDocumentId);

    } catch (error: any) {
      let errorMessage = 'An unknown error occurred during audio upload.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: toastId });
      console.error('Error during audio upload:', error);
      setIsProcessingAudio(false);
    } finally {
      if (event.target) event.target.value = '';
    }
  }, [onAddRecording, triggerAudioProcessing]);

  const handleRecordingComplete = useCallback(async (audioBlob: Blob, title: string, subject: string) => {
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

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      const durationPromise = new Promise<number>((resolve) => {
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => resolve(0);
      });
      const duration = await durationPromise;
      URL.revokeObjectURL(audioUrl);

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
        transcript: '',
        summary: '',
        duration: Math.floor(duration),
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        userId: user.id,
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
          created_at: newRecording.createdAt,
          document_id: newRecording.document_id
        });

      if (insertError) throw new Error(`Failed to save recording to database: ${insertError.message}`);

      onAddRecording(newRecording);
      toast.success('Recording saved, initiating AI processing...', { id: toastId });

      await triggerAudioProcessing(publicUrl, newDocumentId);

    } catch (error: any) {
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
          onUpdateRecording(updatedRecording);
        } else {
          console.error('Failed to refetch updated recording:', fetchError?.message);
        }
      }

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
      console.error('Error initiating audio note generation:', error);
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
  };
};