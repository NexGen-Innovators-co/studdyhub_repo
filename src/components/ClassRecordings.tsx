import React, { useState, useEffect, useRef } from 'react';
import { Play, FileText, Brain, Clock, BookOpen, Mic, Pause, Download, Copy, XCircle, Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ClassRecording, Quiz, QuizQuestion } from '../types/Class';
import { VoiceRecorder } from './VoiceRecorder';
import { formatDate } from '../utils/helpers';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generateId } from '../utils/helpers';
import { FunctionsHttpError } from '@supabase/supabase-js'; // Import FunctionsHttpError

interface ClassRecordingsProps {
  recordings?: ClassRecording[]; // Make optional with default
  onAddRecording: (recording: ClassRecording) => void;
  onGenerateQuiz: (recording: ClassRecording, quiz: Quiz) => void;
}

export const ClassRecordings: React.FC<ClassRecordingsProps> = ({
  recordings = [], // Default to empty array
  onAddRecording,
  onGenerateQuiz
}) => {
  console.log('ClassRecordings received recordings prop:', recordings, 'Type:', Array.isArray(recordings) ? 'array' : typeof recordings); // Enhanced debug log

  const [selectedRecording, setSelectedRecording] = useState<ClassRecording | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  // Updated type for uploadedAudioDetails to always include document_id
  const [uploadedAudioDetails, setUploadedAudioDetails] = useState<{ url: string; type: string; name: string; document_id: string; } | null>(null);
  const [isAudioOptionsVisible, setIsAudioOptionsVisible] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProcessingJobId, setAudioProcessingJobId] = useState<string | null>(null);
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [quizMode, setQuizMode] = useState<{ recording: ClassRecording; quiz: Quiz } | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleRecordingComplete = async (audioBlob: Blob, title: string, subject: string) => {
    setIsProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileName = `${user.id}/recordings/${generateId()}-${title}.webm`; // Changed path to recordings subfolder
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents') // Assuming 'documents' bucket is used for all user files
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Calculate duration from audio blob
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      const durationPromise = new Promise<number>((resolve) => {
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => resolve(0); // Fallback if metadata fails
      });
      const duration = await durationPromise;
      URL.revokeObjectURL(audioUrl);

      // Create a document record for the audio file
      const { data: newDocument, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          title: `Class Recording: ${title}`,
          file_name: `${title}.webm`,
          file_url: publicUrl,
          content_extracted: 'Processing audio for content...', // Placeholder
          file_type: 'audio/webm',
        })
        .select('id')
        .single();

      if (docError || !newDocument) throw new Error(docError?.message || 'Failed to create document record for audio.');

      const newRecording: ClassRecording = {
        id: generateId(),
        title,
        subject,
        audioUrl: publicUrl,
        transcript: '', // Will be updated by polling
        summary: '',     // Will be updated by polling
        duration: Math.floor(duration), // Correct duration in seconds
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        userId: user.id,
        document_id: newDocument.id // Link to the document
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
      toast.success('Recording saved, initiating AI processing...');

      // Trigger the AI processing for transcription and summary
      await triggerAudioProcessing(publicUrl, newDocument.id, user.id);

    } catch (error) {
      let errorMessage = 'Failed to process recording.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
      console.error('Error in handleRecordingComplete:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerAudioUpload = () => {
    audioInputRef.current?.click();
  };

  // Centralized function to trigger audio processing Edge Function
  const triggerAudioProcessing = async (fileUrl: string, documentId: string, userId: string, targetLang: string = 'en') => {
    setIsProcessingAudio(true);
    const toastId = toast.loading('Sending audio for AI processing (transcription, summary)...');
    try {
      const { data, error } = await supabase.functions.invoke('gemini-audio-processor', {
        body: {
          file_url: fileUrl,
          target_language: targetLang,
          user_id: userId,
          document_id: documentId,
        },
      });

      if (error) throw error;
      if (!data || !data.job_id) throw new Error('No job ID received from audio processor.');

      setAudioProcessingJobId(data.job_id);
      toast.success('Audio processing job started. You will be notified when it\'s complete.', { id: toastId });
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
      setIsProcessingAudio(false); // Ensure loading state is reset on error
    }
  };

  const handleAudioFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      const filePath = `${user.id}/recordings/${generateId()}_${safeFileName}`; // Consistent path
      console.log('Uploading audio file to path:', filePath);

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
      console.log('Public audio URL generated:', urlData.publicUrl);

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
        })
        .select('id')
        .single();

      if (docError || !newDocument) throw new Error(docError?.message || 'Failed to create document record for audio.');
      console.log('Audio document record created with ID:', newDocument.id);

      // Create a new ClassRecording entry (initially with empty transcript/summary)
      const newRecording: ClassRecording = {
        id: generateId(),
        title: `Uploaded Audio: ${file.name}`,
        subject: 'Uploaded Audio',
        audioUrl: urlData.publicUrl,
        transcript: '', // Will be filled by polling
        summary: '',     // Will be filled by polling
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

      // Set uploadedAudioDetails with the document_id
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
    } finally {
      // setIsProcessingAudio(false); // Keep true until AI processing is done via polling
      if (event.target) event.target.value = '';
    }
  };

  const handleGenerateNoteFromAudio = async (recording?: ClassRecording) => {
    // Ensure audioDetails always has document_id
    const audioDetails = recording 
      ? { url: recording.audioUrl, type: 'audio/webm', name: recording.title, document_id: recording.document_id || '' } 
      : uploadedAudioDetails;

    if (!audioDetails || !audioDetails.document_id) { // Ensure document_id is present
      toast.error('No audio uploaded or linked document ID missing.');
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
      // Check if the document already has content_extracted. If so, we can use it directly.
      const { data: documentData, error: docFetchError } = await supabase
        .from('documents')
        .select('content_extracted')
        .eq('id', audioDetails.document_id)
        .single();

      let contentToUse = documentData?.content_extracted || '';

      // If content_extracted is empty or placeholder, trigger audio processing first
      if (!contentToUse || contentToUse === 'Processing audio for content...') {
        toast.loading('Audio content not yet extracted. Processing audio first...', { id: toastId });
        // This will trigger the polling useEffect to update the document and recording
        await triggerAudioProcessing(audioDetails.url, audioDetails.document_id, user.id, targetLanguage);
        // We'll rely on the polling mechanism to update the note once audio processing is complete.
        // The rest of this function will be handled by the polling success path.
        return; 
      }

      // If content is already extracted, proceed with note generation directly
      const { data: newNote, error: generationError } = await supabase.functions.invoke('generate-note-from-document', {
        body: {
          documentId: audioDetails.document_id,
          userProfile: { // Placeholder user profile, ideally fetched from context/state
            learning_style: 'visual',
            learning_preferences: {
              explanation_style: 'detailed and comprehensive',
              examples: true,
              difficulty: 'intermediate'
            }
          },
          selectedSection: null, // For full audio, no specific section
        },
      });

      if (generationError) throw new Error(generationError.message || 'Failed to generate note.');

      // Update the existing recording with the generated note content
      const { error: updateError } = await supabase
        .from('class_recordings')
        .update({
          transcript: newNote.content, // Assuming the generated note content can serve as an updated transcript
          summary: newNote.ai_summary,
        })
        .eq('document_id', audioDetails.document_id) // Use document_id for update
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Failed to update class recording with generated note:', updateError.message);
        toast.error('Note generated, but failed to update recording details.', { id: toastId });
      } else {
        toast.success('Note generated and recording updated!', { id: toastId });
        // Manually update the state of recordings to reflect the change
        // Fetch the updated recording to ensure all fields are correct before passing to onAddRecording
        const { data: fetchedRecording, error: fetchError } = await supabase
          .from('class_recordings')
          .select('*')
          .eq('document_id', audioDetails.document_id)
          .eq('user_id', user.id)
          .single();

        if (fetchedRecording && !fetchError) {
            // Map snake_case to camelCase for ClassRecording type
            const updatedRecording: ClassRecording = {
                id: fetchedRecording.id,
                title: fetchedRecording.title,
                subject: fetchedRecording.subject,
                audioUrl: fetchedRecording.audio_url,
                transcript: fetchedRecording.transcript,
                summary: fetchedRecording.summary,
                duration: fetchedRecording.duration,
                date: fetchedRecording.date,
                createdAt: fetchedRecording.created_at, // Map here
                userId: fetchedRecording.user_id, // Map here
                document_id: fetchedRecording.document_id
            };
            onAddRecording(updatedRecording);
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
  };


  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    const pollJobStatus = async () => {
      if (!audioProcessingJobId) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
          .from('audio_processing_results')
          .select('*')
          .eq('id', audioProcessingJobId)
          .eq('user_id', user.id)
          .single();

        if (error) {
          throw new Error(`Failed to fetch job status: ${error.message}`);
        }

        if (data) {
          if (data.status === 'completed') {
            toast.success('Audio processing completed!');
            // Update the corresponding ClassRecording and Document
            const { error: updateRecordingError } = await supabase
              .from('class_recordings')
              .update({
                transcript: data.transcript || '',
                summary: data.summary || '',
              })
              .eq('document_id', data.document_id)
              .eq('user_id', user.id);

            if (updateRecordingError) {
              console.error('Failed to update class recording after processing:', updateRecordingError.message);
            }

            // Update the content_extracted in the documents table
            const { error: updateDocumentError } = await supabase
              .from('documents')
              .update({
                content_extracted: data.transcript || '', // Store transcript as extracted content
              })
              .eq('id', data.document_id)
              .eq('user_id', user.id);

            if (updateDocumentError) {
              console.error('Failed to update document content_extracted after processing:', updateDocumentError.message);
            }

            // Find the updated recording and trigger onAddRecording to refresh UI
            const { data: updatedRecording, error: fetchUpdatedRecordingError } = await supabase
              .from('class_recordings')
              .select('*')
              .eq('document_id', data.document_id)
              .eq('user_id', user.id)
              .single();

            if (updatedRecording && !fetchUpdatedRecordingError) {
              // Map snake_case to camelCase for ClassRecording type
              const mappedRecording: ClassRecording = {
                  id: updatedRecording.id,
                  title: updatedRecording.title,
                  subject: updatedRecording.subject,
                  audioUrl: updatedRecording.audio_url,
                  transcript: updatedRecording.transcript,
                  summary: updatedRecording.summary,
                  duration: updatedRecording.duration,
                  date: updatedRecording.date,
                  createdAt: updatedRecording.created_at, // Map here
                  userId: updatedRecording.user_id, // Map here
                  document_id: updatedRecording.document_id
              };
              onAddRecording(mappedRecording); // This will re-add/update the recording in the parent state
            }

            setTranslatedContent(data.translated_content || null);
            setAudioProcessingJobId(null);
            setIsProcessingAudio(false);
            setIsAudioOptionsVisible(false);
            if (pollInterval) clearInterval(pollInterval);
          } else if (data.status === 'error') {
            toast.error(`Audio processing failed: ${data.error_message || 'Unknown error'}`);
            setAudioProcessingJobId(null);
            setIsProcessingAudio(false);
            setIsAudioOptionsVisible(false);
            if (pollInterval) clearInterval(pollInterval);
          } else if (data.status === 'processing') {
            toast.loading('Audio processing in progress...', { id: 'audio-job-status', duration: Infinity });
          }
        }
      } catch (error) {
        let errorMessage = 'Error polling audio job status.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast.error(errorMessage, { id: 'audio-job-status' });
        console.error('Polling error:', error);
        setAudioProcessingJobId(null);
        setIsProcessingAudio(false);
        setIsAudioOptionsVisible(false);
        if (pollInterval) clearInterval(pollInterval);
      }
    };

    if (audioProcessingJobId) {
      pollInterval = setInterval(pollJobStatus, 5000);
      pollJobStatus();
    } else {
      if (pollInterval) clearInterval(pollInterval);
      toast.dismiss('audio-job-status');
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      toast.dismiss('audio-job-status');
    };
  }, [audioProcessingJobId, onAddRecording]); // Removed uploadedAudioDetails from dependencies as it's not directly used here

  const handlePlayAudio = () => {
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
  };

  const handleAudioEnded = () => {
    setIsPlayingAudio(false);
  };

  const handleDownloadAudio = () => {
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
  };

  const handleCopyAudioUrl = () => {
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
  };

  const handleClearAudioProcessing = () => {
    setUploadedAudioDetails(null);
    setIsAudioOptionsVisible(false);
    setAudioProcessingJobId(null);
    setIsProcessingAudio(false);
    setIsGeneratingNote(false);
    setTranslatedContent(null);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      setIsPlayingAudio(false);
    }
    toast.dismiss('audio-job-status');
  };

  const handleGenerateQuizFromRecording = async (recording: ClassRecording) => {
    const toastId = toast.loading('Generating quiz...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!recording.transcript || recording.transcript.split(' ').length < 50) {
        toast.error('This content may not be suitable for quiz generation. Please try a recording with more informational content.', { id: toastId });
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: {
          name: recording.title,
          file_url: recording.audioUrl,
          transcript: recording.transcript
        },
      });

      if (error) throw new Error(error.message || 'Failed to generate quiz');

      if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
        toast.error('Unable to generate quiz questions from this content. Try a recording with more structured information.', { id: toastId });
        console.warn('Invalid quiz data:', data);
        return;
      }

        const quiz: Quiz = {
          id: generateId(),
          classId: recording.id,
          title: data.title || recording.title,
          questions: data.questions,
          userId: user.id,
          createdAt: new Date().toISOString()
        };

      const { error: insertError } = await supabase
        .from('quizzes')
        .insert({
          id: quiz.id,
          class_id: quiz.classId,
          title: quiz.title,
          questions: quiz.questions as any,
          user_id: user.id,
          created_at: quiz.createdAt
        });

      if (insertError) throw new Error(`Failed to save quiz to database: ${insertError.message}`);

      onGenerateQuiz(recording, quiz);
      setQuizMode({ recording, quiz });
      setUserAnswers(new Array(quiz.questions?.length || 0).fill(null));
      setCurrentQuestionIndex(0);
      toast.success('Quiz generated and saved successfully!', { id: toastId });
    } catch (error) {
      let errorMessage = 'Failed to generate quiz.';
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes('The model is overloaded')) {
          errorMessage = 'AI model is currently overloaded. Please try again in a few moments.';
        }
      }
      toast.error(errorMessage, { id: toastId });
      console.error('Error generating quiz:', error);
      setQuizMode(null);
    }
  };

  const handleAnswerSelect = (questionIndex: number, optionIndex: number) => {
    setUserAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[questionIndex] = optionIndex;
      return newAnswers;
    });
  };

  const handleNextQuestion = () => {
    const totalQuestions = quizMode?.quiz?.questions?.length || 0;
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setShowResults(true);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleExitQuizMode = () => {
    setQuizMode(null);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setShowResults(false);
  };

  const calculateScore = (): number => {
    if (!quizMode?.quiz?.questions?.length) return 0;
    
    const totalQuestions = quizMode.quiz.questions.length;
    const correctAnswers = quizMode.quiz.questions.reduce((score, question, index) => {
      return userAnswers[index] === question.correctAnswer ? score + 1 : score;
    }, 0);
    
    return Math.round((correctAnswers / totalQuestions) * 100);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0 min';
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  const handleGenerateNoteClick = (recording: ClassRecording) => {
    handleGenerateNoteFromAudio(recording);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Class Recordings</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={triggerAudioUpload}
          disabled={isProcessingAudio || isProcessing || isGeneratingNote}
          className="text-slate-600 border-slate-200 hover:bg-slate-50"
        >
          {isProcessingAudio ? (
            <Brain className="h-4 w-4 mr-2 animate-pulse" />
          ) : (
            <Mic className="h-4 w-4 mr-2" />
          )}
          {isProcessingAudio ? 'Uploading Audio...' : 'Upload Audio'}
        </Button>
        <input
          type="file"
          ref={audioInputRef}
          onChange={handleAudioFileSelect}
          style={{ display: 'none' }}
          accept="audio/*"
        />
      </div>

      {isProcessing && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Brain className="h-5 w-5 text-blue-600 animate-pulse" />
              <span>Processing recording with AI...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadedAudioDetails && isAudioOptionsVisible && (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Audio Options: {uploadedAudioDetails.name}</h3>
            <audio ref={audioPlayerRef} src={uploadedAudioDetails.url} onEnded={handleAudioEnded} className="w-full hidden" />
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePlayAudio}
                disabled={isGeneratingNote || isProcessingAudio}
                className="text-slate-600 border-slate-200 hover:bg-slate-50"
              >
                {isPlayingAudio ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {isPlayingAudio ? 'Pause Audio' : 'Play Audio'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAudio}
                disabled={isGeneratingNote || isProcessingAudio}
                className="text-slate-600 border-slate-200 hover:bg-slate-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Audio
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAudioUrl}
                disabled={isGeneratingNote || isProcessingAudio}
                className="text-slate-600 border-slate-200 hover:bg-slate-50"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Audio URL
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAudioProcessing}
                disabled={isGeneratingNote || isProcessingAudio}
                className="text-slate-600 hover:bg-slate-50"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Clear Audio
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => handleGenerateNoteFromAudio()}
                disabled={isGeneratingNote || isProcessingAudio}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700"
              >
                {isGeneratingNote ? (
                  <Brain className="h-4 w-4 mr-2 animate-pulse" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                {isGeneratingNote ? 'Generating Note...' : 'Generate Note'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {translatedContent && (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-600" />
                <h4 className="font-medium text-slate-800">Translated Content ({targetLanguage.toUpperCase()})</h4>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTranslatedContent(null)}
                className="h-6 w-6 p-0 text-slate-600 hover:bg-slate-50"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-slate-700">{translatedContent}</p>
          </CardContent>
        </Card>
      )}

      <VoiceRecorder onRecordingComplete={handleRecordingComplete} />

      <div className="grid gap-4">
        {Array.isArray(recordings) && recordings !== undefined && recordings.length > 0 ? (
          recordings.map((recording) => (
            <Card key={recording.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{recording.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary">{recording.subject}</Badge>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="h-3 w-3" />
                        {formatDuration(recording.duration)}
                      </div>
                      <span className="text-sm text-gray-500">
                        {recording.date ? formatDate(new Date(recording.date)) : 'No date'}
                      </span>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedRecording(
                      selectedRecording?.id === recording.id ? null : recording
                    )}
                    className="text-slate-600 border-slate-200 hover:bg-slate-50"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {selectedRecording?.id === recording.id ? 'Hide' : 'View'} Details
                  </Button>
                </div>
              </CardHeader>
              
              {selectedRecording?.id === recording.id && (
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {recording.audioUrl && (
                      <audio controls className="w-full">
                        <source src={recording.audioUrl} type="audio/wav" />
                      </audio>
                    )}
                    
                    <div>
                      <h4 className="font-semibold mb-2">AI Summary</h4>
                      <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded">
                        {recording.summary || 'No summary available.'}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2">Transcript</h4>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                        {recording.transcript || 'No transcript available.'}
                      </p>
                    </div>
                    
                    <Button 
                      onClick={() => handleGenerateNoteClick(recording)}
                      disabled={isGeneratingNote || isProcessingAudio}
                      className="w-full mb-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700"
                    >
                      {isGeneratingNote ? (
                        <Brain className="h-4 w-4 mr-2 animate-pulse" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      {isGeneratingNote ? 'Generating Note...' : 'Generate Note'}
                    </Button>
                    
                    <Button 
                      onClick={() => handleGenerateQuizFromRecording(recording)}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700"
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      Generate Quiz from this Class
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        ) : (
          <Card className="text-center py-8">
            <CardContent>
              <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-500 mb-2">No recordings yet</h3>
              <p className="text-gray-400">Start recording or uploading audio to get AI-powered summaries and transcripts</p>
            </CardContent>
          </Card>
        )}
      </div>

      {quizMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800">{quizMode.quiz.title}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExitQuizMode}
                  className="text-slate-600 hover:bg-slate-50"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {!showResults ? (
                quizMode.quiz.questions && quizMode.quiz.questions.length > 0 && quizMode.quiz.questions[currentQuestionIndex] ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">
                        Question {currentQuestionIndex + 1} of {quizMode.quiz.questions.length}
                      </span>
                      <div className="w-64 h-2 bg-slate-200 rounded-full">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-full transition-all duration-300"
                          style={{ width: `${((currentQuestionIndex + 1) / quizMode.quiz.questions.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 mb-4">
                        {quizMode.quiz.questions?.[currentQuestionIndex]?.question || 'Question not available'}
                      </h3>
                      <div className="space-y-3">
                        {(quizMode.quiz.questions?.[currentQuestionIndex]?.options || []).map((option, index) => (
                          <Button
                            key={index}
                            variant={userAnswers[currentQuestionIndex] === index ? "default" : "outline"}
                            className={`w-full text-left justify-start p-4 transition-all duration-200 ${
                              userAnswers[currentQuestionIndex] === index
                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                                : 'text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                            onClick={() => handleAnswerSelect(currentQuestionIndex, index)}
                          >
                            {option}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        onClick={handlePreviousQuestion}
                        disabled={currentQuestionIndex === 0}
                        className="text-slate-600 border-slate-200 hover:bg-slate-50"
                      >
                        Previous
                      </Button>
                      <Button
                        onClick={handleNextQuestion}
                        disabled={userAnswers[currentQuestionIndex] === null}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                      >
                        {currentQuestionIndex < (quizMode.quiz.questions?.length || 0) - 1 ? 'Next' : 'Finish'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-500 mb-2">No questions available</h3>
                    <p className="text-gray-400">The quiz could not be generated. Please try again.</p>
                    <Button
                      onClick={handleExitQuizMode}
                      className="mt-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                    >
                      Close
                    </Button>
                  </div>
                )
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-slate-800">Quiz Results</h3>
                    <p className="text-lg text-slate-600 mt-2">
                      Your score: <span className="font-semibold text-blue-600">{calculateScore()}%</span>
                    </p>
                  </div>

                  <div className="space-y-4">
                    {quizMode.quiz.questions && Array.isArray(quizMode.quiz.questions) && quizMode.quiz.questions.length > 0 ? (
                      quizMode.quiz.questions.map((question, index) => (
                        <div key={question.id || index} className="border border-slate-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            {userAnswers[index] === question.correctAnswer ? (
                              <Check className="h-5 w-5 text-green-600" />
                            ) : (
                              <X className="h-5 w-5 text-red-600" />
                            )}
                            <h4 className="font-semibold text-slate-800">{question.question}</h4>
                          </div>
                          <p className="text-sm text-slate-600">
                            Your answer: {question.options[userAnswers[index] ?? -1] || 'Not answered'}
                          </p>
                          {userAnswers[index] !== question.correctAnswer && (
                            <p className="text-sm text-slate-600">
                              Correct answer: {question.options[question.correctAnswer]}
                            </p>
                          )}
                          <p className="text-sm text-slate-700 mt-2">{question.explanation}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-600">No questions available.</p>
                    )}
                  </div>

                  <Button
                    onClick={handleExitQuizMode}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                  >
                    Exit Quiz
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
