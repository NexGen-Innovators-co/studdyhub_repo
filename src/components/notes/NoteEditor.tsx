// NoteEditor.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '../../integrations/supabase/client';
import { Note, NoteCategory, UserProfile } from '../../types';
import { Database } from '../../integrations/supabase/types';
import { generateSpeech } from '../../services/cloudTtsService';

import { NoteContentArea } from './components/NoteContentArea';
import { AISummarySection } from './components/AISummarySection';
import { TranslatedContentSection } from './components/TranslatedContentSection';
import { AudioOptionsSection } from './components/AudioOptionsSection';

// Dialogs
import { SectionSelectionDialog } from './components/SectionSelectionDialog';
import { DocumentViewerDialog } from './components/DocumentViewerDialog';
import { RotateCw } from 'lucide-react';
import { set } from 'date-fns';
import '../../noteStyle.css'
// Explicitly type the supabase client for better type inference with custom tables
const typedSupabase = supabase as any;

declare global {
  interface Window {
    html2pdf: any;
  }
}

interface NoteEditorProps {
  note: Note;
  onNoteUpdate: (note: Note) => void;
  userProfile: UserProfile | null;
  onToggleNotesHistory?: () => void;
  isNotesHistoryOpen?: boolean;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  onNoteUpdate,
  userProfile,
  onToggleNotesHistory,
  isNotesHistoryOpen
}) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content); // Markdown
  const [category, setCategory] = useState<NoteCategory>(note.category);
  const [tags, setTags] = useState(note.tags.join(', '));
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [documentSections, setDocumentSections] = useState<string[]>([]);
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedContent, setExtractedContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSummaryVisible, setIsSummaryVisible] = useState(true);

  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [originalDocumentContent, setOriginalDocumentContent] = useState<string | null>(null);
  const [originalDocumentFileType, setOriginalDocumentFileType] = useState<string | null>(null);
  const [originalDocumentFileUrl, setOriginalDocumentFileUrl] = useState<string | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);

  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  const [uploadedAudioDetails, setUploadedAudioDetails] = useState<{ url: string; type: string; name: string; } | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAudioOptionsVisible, setIsAudioOptionsVisible] = useState(false);
  const [audioProcessingJobId, setAudioProcessingJobId] = useState<string | null>(null);
  const [isGeneratingAudioNote, setIsGeneratingAudioNote] = useState(false);
  const [isGeneratingAudioSummary, setIsGeneratingAudioSummary] = useState(false);
  const [isTranslatingAudio, setIsTranslatingAudio] = useState(false);

  const [uploadedDocumentPublicUrl, setUploadedDocumentPublicUrl] = useState<string | null>(null);
  const [documentIdForDialog, setDocumentIdForDialog] = useState<string | null>(null);
  const [isLoading, setIsloading] = useState(false);
  const contentAreaRef = useRef<any>(null);

  // Reset on note change
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category);
    setTags(note.tags.join(', '));

    setTranslatedContent(null);
    setTargetLanguage('en');
    setUploadedAudioDetails(null);
    setIsAudioOptionsVisible(false);
    setAudioProcessingJobId(null);

    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    setIsSpeaking(false);

    return () => {
      if (currentAudio) {
        currentAudio.pause();
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
    };
  }, [note, currentAudio]);

  // Polling effect for audio processing job
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    const pollJobStatus = async () => {
      if (!audioProcessingJobId || !userProfile) return;

      try {
        const { data, error } = await typedSupabase
          .from('audio_processing_results')
          .select('*')
          .eq('id', audioProcessingJobId)
          .eq('user_id', userProfile.id)
          .single();

        if (error) {
          throw new Error(`Failed to fetch job status: ${error.message}`);
        }

        if (data) {
          const audioResult = data as Database['public']['Tables']['audio_processing_results']['Row'];

          if (audioResult.status === 'completed') {
            toast.success('Audio processing completed!');
            setContent(audioResult.transcript || 'No transcription available.');

            onNoteUpdate({
              ...note,
              content: audioResult.transcript || '',
              ai_summary: audioResult.summary || 'No summary available.',
              document_id: audioResult.document_id || null
            });
            setTranslatedContent(audioResult.translated_content || null);
            setAudioProcessingJobId(null);
            setIsProcessingAudio(false);
            setIsGeneratingAudioNote(false);
            setIsGeneratingAudioSummary(false);
            setIsTranslatingAudio(false);
            setIsAudioOptionsVisible(false);
            if (pollInterval) clearInterval(pollInterval);
          } else if (audioResult.status === 'error') {
            toast.error(`Audio processing failed: ${audioResult.error_message || 'Unknown error'}`);
            setAudioProcessingJobId(null);
            setIsProcessingAudio(false);
            setIsGeneratingAudioNote(false);
            setIsGeneratingAudioSummary(false);
            setIsTranslatingAudio(false);
            setIsAudioOptionsVisible(false);
            if (pollInterval) clearInterval(pollInterval);
          } else if (audioResult.status === 'processing') {
            toast.loading('Audio processing in progress...', { id: 'audio-job-status', duration: Infinity });
          }
        }
      } catch (error) {
        let errorMessage = 'Error polling audio job status.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast.error(errorMessage, { id: 'audio-job-status' });
        setAudioProcessingJobId(null);
        setIsProcessingAudio(false);
        setIsGeneratingAudioNote(false);
        setIsGeneratingAudioSummary(false);
        setIsTranslatingAudio(false);
        setIsAudioOptionsVisible(false);
        if (pollInterval) clearInterval(pollInterval);
      }
    };

    if (audioProcessingJobId) {
      pollJobStatus();
      pollInterval = setInterval(pollJobStatus, 5000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [audioProcessingJobId, userProfile, note, onNoteUpdate]);
  // Add this state to track if content has been modified
  const [isContentModified, setIsContentModified] = useState(false);

  // Enhanced save handler
  // Enhanced save handler
  const handleSave = useCallback(() => {

    if (!content) {
      toast.error("No content to save");
      return;
    }
    // Use the markdown from the ref (which includes diagrams) or fallback to content state
    setIsloading(true);
    const markdownToSave = content;


    const updatedNote: Note = {
      ...note,
      title: title || 'Untitled Note',
      content: markdownToSave,
      category,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
      ai_summary: note.ai_summary
    };

    // Update local state to ensure synchronization
    if (markdownToSave !== content) {
      setContent(markdownToSave);
    }
    setTimeout(() => {
      onNoteUpdate(updatedNote);
      setIsContentModified(false);
      setIsloading(false);
      toast.success("Note saved successfully");
    }, 1000);

  }, [note, title, content, category, tags, onNoteUpdate]);

  // Enhanced content change handler
  const handleContentChange = useCallback((newContent: string) => {

    setContent(newContent);
    setIsContentModified(true);
  }, []);

  // Add auto-save or manual save indicator in the UI if needed

  const regenerateNoteFromDocument = async () => {
    if (!note.document_id) {
      toast.error('This note is not linked to a source document and cannot be regenerated.');
      return;
    }
    if (!userProfile) {
      toast.error('User profile not found. Cannot generate personalized note.');
      return;
    }

    // Add validation for note ID
    if (!note.id) {
      toast.error('Cannot update note: Note ID is missing.');
      return;
    }

    setIsGeneratingAI(true);
    const toastId = toast.loading('Regenerating note with AI...');

    try {
      const { data: newNote, error } = await supabase.functions.invoke('generate-note-from-document', {
        body: {
          documentId: note.document_id,
          userProfile: userProfile,
        },
      });

      if (error) {
        throw new Error(error.message || 'An unknown error occurred');
      }

      // Ensure the updated note has the original note's ID and other required properties
      const updatedNote: Note = {
        ...note, // Preserve all original note properties including id
        title: newNote.title || note.title,
        content: newNote.content || note.content,
        ai_summary: newNote.ai_summary || note.ai_summary,
        updated_at: new Date().toISOString(), // Always update the timestamp
      };

      // Validate the note has an ID before updating
      if (!updatedNote.id) {
        throw new Error('Generated note is missing ID property');
      }

      onNoteUpdate(updatedNote);
      setContent(updatedNote.content);
      toast.success('Note regenerated successfully!', { id: toastId });
    } catch (error) {
      let errorMessage = 'Failed to regenerate note.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `AI regeneration failed: ${error.context.statusText}. Please try again.`;
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
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {

    const file = event.target.files?.[0];

    if (!file || !userProfile) {
      if (!userProfile) {

        toast.error("Cannot upload: User profile is missing.");
      }
      return;
    }



    const allowedDocumentTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    const allowedAudioTypes = [
      'audio/mpeg',
      'audio/wav',
      'audio/mp4',
      'audio/x-m4a',
      'audio/webm'
    ];

    // Route to audio handler if audio file
    if (allowedAudioTypes.includes(file.type)) {

      handleAudioFileSelect(event);
      return;
    }

    // Validate document type
    if (!allowedDocumentTypes.includes(file.type)) {

      toast.error('Unsupported file type. Please upload a PDF, TXT, Word document, or an audio file.');
      if (event.target) event.target.value = '';
      return;
    }

    setIsUploading(true);
    setSelectedFile(file);

    // Use unique toast ID based on timestamp
    const toastId = `upload-${Date.now()}`;
    toast.loading('Processing document...', { id: toastId });

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.toString().split(',')[1];
        const fileData = {
          name: file.name,
          mimeType: file.type,
          data: base64,
          size: file.size
        };

        const { data, error } = await supabase.functions.invoke('document-processor', {
          body: {
            userId: userProfile.id,
            files: [fileData]
          }
        });

        if (error) {
          throw new Error(`Extraction failed: ${error.message}`);
        }

        const processedDoc = data.documents[0];
        if (processedDoc.processing_status === 'failed') {
          throw new Error(processedDoc.processing_error || 'Processing failed');
        }

        const documentId = processedDoc.id;
        const extracted = processedDoc.content_extracted;

        setExtractedContent(extracted);
        setDocumentIdForDialog(documentId);
        setUploadedDocumentPublicUrl(processedDoc.file_url);

        toast.loading('Analyzing document structure...', { id: toastId });

        const { data: structureData, error: structureError } = await supabase.functions.invoke(
          'analyze-document-structure',
          { body: { documentContent: extracted } }
        );

        if (structureError) {
          throw structureError;
        }

        if (structureData.sections && structureData.sections.length > 0) {
          setDocumentSections(structureData.sections);
          setIsSectionDialogOpen(true);
          toast.dismiss(toastId);
        } else {
          await generateAIContentForNote(note, userProfile, null, toastId, documentId);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      let errorMessage = 'An unknown error occurred during document processing.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `Function error (${error.context.status}): ${error.context.statusText}.`;
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
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  const generateAIContentForNote = async (
    targetNote: Note,
    user: UserProfile,
    selectedSection: string | null,
    toastId: string,
    documentIdForGeneration: string | null
  ) => {
    setIsGeneratingAI(true);

    // Add validation for note ID if updating existing note
    if (targetNote.id) {
      toast.loading('Generating AI note content...', { id: toastId });
    } else {
      toast.loading('Creating new AI note...', { id: toastId });
    }

    try {
      const requestBody = {
        documentId: documentIdForGeneration,
        userProfile: user,
        selectedSection: selectedSection,
      };

      const { data: aiGeneratedNote, error: generationError } = await supabase.functions.invoke(
        'generate-note-from-document',
        { body: requestBody }
      );

      if (generationError) throw new Error(generationError.message || 'Failed to generate note content.');

      const updatedNote: Note = {
        ...targetNote, // Preserve original properties including ID
        title: aiGeneratedNote.title || targetNote.title,
        content: aiGeneratedNote.content,
        ai_summary: aiGeneratedNote.ai_summary,
        updated_at: new Date().toISOString(),
        document_id: documentIdForGeneration,
      };

      // For existing notes, validate ID before update
      if (targetNote.id) {
        if (!updatedNote.id) {
          throw new Error('Note ID is missing during update');
        }

        const { error: updateNoteError } = await supabase
          .from('notes')
          .update({
            title: updatedNote.title,
            content: updatedNote.content,
            ai_summary: updatedNote.ai_summary,
            updated_at: new Date().toISOString(),
            document_id: updatedNote.document_id,
          })
          .eq('id', updatedNote.id) // This line was causing the error
          .eq('user_id', user.id);

        if (updateNoteError) throw updateNoteError;

        onNoteUpdate(updatedNote);
        toast.success('Note updated from document!', { id: toastId });
      } else {
        // Create new note logic remains the same
        const { data: newNoteData, error: createNoteError } = await supabase
          .from('notes')
          .insert({
            title: updatedNote.title,
            content: updatedNote.content,
            category: updatedNote.category,
            tags: updatedNote.tags,
            user_id: user.id,
            ai_summary: updatedNote.ai_summary,
            document_id: updatedNote.document_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createNoteError) throw createNoteError;

        onNoteUpdate({
          ...updatedNote,
          id: newNoteData.id,
          created_at: new Date(newNoteData.created_at).toISOString(),
          updated_at: new Date(newNoteData.updated_at).toISOString(),
        });

        toast.success('New note generated from document!', { id: toastId });
      }

      setContent(updatedNote.content);
      setTitle(updatedNote.title);

    } catch (error) {
      let errorMessage = 'An unknown error occurred.';

      if (error instanceof FunctionsHttpError) {
        errorMessage = `AI generation failed: ${error.context.statusText}. Check function logs.`;

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
    } finally {
      setIsGeneratingAI(false);
      setIsSectionDialogOpen(false);
      setDocumentSections([]);
      setSelectedFile(null);
      setExtractedContent(null);
      setUploadedDocumentPublicUrl(null);
      setDocumentIdForDialog(null);
    }
  };

  // Also update handleSectionSelect to pass toast ID correctly
  const handleSectionSelect = async (section: string | null, documentIdFromDialog: string) => {
    if (!userProfile || !documentIdFromDialog) {
      toast.error("Missing user profile or document ID to generate note.");
      return;
    }

    // Create a unique toast ID for section generation
    const toastId = `section-${Date.now()}`;
    toast.loading(`Generating note from ${section ? `section: ${section}` : 'full document'}...`, { id: toastId });

    await generateAIContentForNote(
      note,
      userProfile,
      section,
      toastId, // Pass the unique toast ID
      documentIdFromDialog
    );
  };

  const processMarkdownForSpeech = (markdownContent: string): string => {
    let processedText = markdownContent;

    // Replace code blocks with descriptive text
    // Make the newline optional with \s* and use [\s\S]*? for non-greedy matching
    const codeBlockRegex = /```(\w*)\s*([\s\S]*?)```/g;
    processedText = processedText.replace(codeBlockRegex, (match, lang, code) => {
      const lowerLang = lang ? lang.toLowerCase() : '';
      if (lowerLang === 'mermaid') {
        return '(A Mermaid diagram is present here.)';
      } else if (lowerLang === 'dot') {
        return '(A DOT graph is present here.)';
      } else if (lowerLang === 'chartjs') {
        return '(A Chart.js graph is present here.)';
      } else if (lang) {
        return `(A ${lang} code block is present here.)`;
      } else {
        return '(A code block is present here.)';
      }
    });

    // Remove any remaining triple backticks or code block artifacts
    processedText = processedText.replace(/```[\s\S]*$/g, ''); // Remove incomplete code blocks at end
    processedText = processedText.replace(/```/g, ''); // Remove any remaining backticks

    // Remove other markdown formatting
    processedText = processedText
      .replace(/#{1,6}\s/g, '') // Remove ATX headings
      .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, '$1$2') // Remove bold
      .replace(/\*([^*]+)\*|_([^_]+)_/g, '$1$2') // Remove italics
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links, keep text
      .replace(/!\[([^\]]+)\]\([^\)]+\)/g, '(Image: $1)') // Replace images with alt text
      .replace(/^- /gm, '') // Remove list item markers
      .replace(/^\d+\. /gm, '') // Remove numbered list markers
      .replace(/>\s/g, '') // Remove blockquote markers
      .replace(/\|/g, ' ') // Replace table separators
      .replace(/---/g, ' ') // Replace horizontal rules
      .replace(/(\r\n|\n|\r)/gm, " ") // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
      .trim();

    return processedText;
  };

  const handleTextToSpeech = async () => {
    // If speech is currently active, stop it
    if (isSpeaking && currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
      setIsSpeaking(false);
      toast.info("Speech stopped.");
      return;
    }

    // Start speech
    if (!content.trim()) {
      toast.info("There's no content to read aloud.");
      return;
    }


    const textToRead = processMarkdownForSpeech(content);


    
    if (!textToRead || !textToRead.trim()) {
      toast.info("The note has no readable content after processing.");
      return;
    }

    try {
      toast.loading('Generating speech...', { id: 'note-tts' });
      

      const { audioContent, error } = await generateSpeech({
        text: textToRead,
        voice: 'female',
        rate: 1.0,
        pitch: 0
      });

      toast.dismiss('note-tts');



      if (error || !audioContent) {
        toast.error(error || 'Failed to generate speech');
        return;
      }

      // Play audio
      const cleanedAudio = audioContent
        .trim()
        .replace(/^data:audio\/[a-z]+;base64,/, '')
        .replace(/\s/g, '');


      const audio = new Audio(`data:audio/mp3;base64,${cleanedAudio}`);
      
      // Ensure audio is not muted and has volume
      audio.volume = 1.0;
      audio.muted = false;

      
      setCurrentAudio(audio);

      audio.onplay = () => {

        setIsSpeaking(true);
      };
      audio.onended = () => {
        console.log('[TTS] Audio playback ended');
        setIsSpeaking(false);
        setCurrentAudio(null);
      };
      audio.onerror = (e) => {
        console.error('[TTS] Audio playback error:', e);
        console.error('[TTS] Audio error details:', audio.error);
        toast.error("Failed to play audio");
        setIsSpeaking(false);
        setCurrentAudio(null);
      };

      // Properly handle play() promise to avoid AbortError
      try {
        console.log('[TTS] Calling audio.play()');
        await audio.play();
        console.log('[TTS] audio.play() successful - paused:', audio.paused, 'readyState:', audio.readyState);
        
        // Check playback after a small delay
        setTimeout(() => {
          console.log('[TTS] Playback check - currentTime:', audio.currentTime, 'paused:', audio.paused, 'ended:', audio.ended);
        }, 100);
        
        setIsSpeaking(true);
      } catch (playError: any) {
        // Ignore AbortError (happens when play is interrupted)
        if (playError.name !== 'AbortError') {
          console.error('Audio play error:', playError);
          toast.error("Failed to play audio");
        }
        setIsSpeaking(false);
        setCurrentAudio(null);
      }
    } catch (error: any) {
      console.error('TTS error:', error);
      toast.error(error.message || 'Failed to generate speech');
      setIsSpeaking(false);
    }
  };

  const handleViewOriginalDocument = async () => {
    if (!note.document_id) {
      toast.info('No original document linked to this note.');
      return;
    }

    setIsLoadingDocument(true);
    const toastId = toast.loading('Loading original document...');

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('content_extracted, file_url, file_type')
        .eq('id', note.document_id)
        .single();

      if (error) throw new Error(error.message);
      if (!data) throw new Error('Document not found.');

      setOriginalDocumentContent(data.content_extracted);
      setOriginalDocumentFileType(data.file_type);
      setOriginalDocumentFileUrl(data.file_url);
      setIsDocumentViewerOpen(true);
      toast.success('Document loaded.', { id: toastId });
    } catch (error) {
      let errorMessage = 'Failed to load original document.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsLoadingDocument(false);
    }
  };

  const handleDownloadNote = () => {
    if (!content.trim()) {
      toast.info("There's no content to download.");
      return;
    }
    const fileName = `${title || 'untitled-note'}.md`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast.success('Note downloaded as Markdown!');
  };

  const handleDownloadPdf = () => {
    if (!content.trim()) {
      toast.info("There's no content to convert to PDF.");
      return;
    }

    // Get the HTML content from the editor
    const htmlContent = contentAreaRef.current?.getInnerHTML() || '';

    if (!htmlContent) {
      toast.error('Could not retrieve note content for PDF generation.');
      return;
    }

    toast.loading('Generating PDF...', { id: 'pdf-download' });

    if (typeof window.html2pdf === 'undefined') {
      toast.error('PDF generation library not loaded. Please try again later.', { id: 'pdf-download' });
      //console.error('html2pdf.js is not loaded. Please ensure it is included in your project.');
      return;
    }

    // Create a temporary container for PDF generation
    const tempContainer = document.createElement('div');
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = '210mm'; // A4 width
    tempContainer.style.padding = '20mm';
    tempContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    tempContainer.style.fontSize = '12pt';
    tempContainer.style.lineHeight = '1.6';
    tempContainer.style.color = '#000';

    // Add title and content with better styling
    tempContainer.innerHTML = `
    <style>
      /* PDF-specific styles */
      * {
        box-sizing: border-box;
      }
      h1, h2, h3, h4, h5, h6 {
        color: #000;
        margin-top: 1em;
        margin-bottom: 0.5em;
        font-weight: bold;
      }
      h1 { font-size: 24pt; }
      h2 { font-size: 20pt; }
      h3 { font-size: 16pt; }
      p { 
        margin: 0.5em 0;
        color: #000;
      }
      pre {
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 10px;
        overflow-x: auto;
        font-family: 'Courier New', monospace;
        font-size: 10pt;
        margin: 1em 0;
      }
      code {
        background: #f5f5f5;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
        font-size: 10pt;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        margin: 1em 0;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }
      th {
        background: #f5f5f5;
        font-weight: bold;
      }
      ul, ol {
        margin: 0.5em 0;
        padding-left: 2em;
      }
      li {
        margin: 0.25em 0;
      }
      blockquote {
        border-left: 4px solid #ddd;
        padding-left: 1em;
        margin: 1em 0;
        color: #666;
      }
      img, svg {
        max-width: 100%;
        height: auto;
        margin: 1em 0;
      }
      a {
        color: #0066cc;
        text-decoration: underline;
      }
    </style>
    <div style="margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px;">
      <h1 style="font-size: 24pt; font-weight: bold; margin: 0 0 10px 0; color: #000;">
        ${title || 'Untitled Note'}
      </h1>
      ${category !== 'general' ? `<p style="color: #666; font-size: 10pt; margin: 5px 0;">Category: ${category}</p>` : ''}
      ${tags ? `<p style="color: #666; font-size: 10pt; margin: 5px 0;">Tags: ${tags}</p>` : ''}
    </div>
    <div style="color: #000;">
      ${htmlContent}
    </div>
  `;

    document.body.appendChild(tempContainer);

    window.html2pdf()
      .from(tempContainer)
      .set({
        margin: [15, 15, 15, 15],
        filename: `${(title || 'untitled-note').replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          logging: false,
          dpi: 192,
          letterRendering: true,
          backgroundColor: '#ffffff',
          useCORS: true
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
          compress: true
        },
        pagebreak: {
          mode: ['avoid-all', 'css', 'legacy'],
          before: '.page-break-before',
          after: '.page-break-after',
          avoid: ['pre', 'code', 'table', 'img', 'svg']
        }
      })
      .save()
      .then(() => {
        toast.success('Note downloaded as PDF!', { id: 'pdf-download' });
        document.body.removeChild(tempContainer);
      })
      .catch((error: any) => {
        toast.error('Failed to generate PDF.', { id: 'pdf-download' });
        //console.error('Error generating PDF:', error);
        if (document.body.contains(tempContainer)) {
          document.body.removeChild(tempContainer);
        }
      });
  };

  const handleCopyNoteContent = () => {
    if (!content.trim()) {
      toast.info("There's no content to copy.");
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = content;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      toast.success('Note content copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy note content.');
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const handleDownloadHTML = () => {
    if (!content.trim()) {
      toast.info("There's no content to download.");
      return;
    }
    const htmlContent = contentAreaRef.current?.getInnerHTML() || '';
    const fileName = `${title || 'untitled-note'}.html`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast.success('Note downloaded as HTML!');
  };

  const handleDownloadTXT = () => {
    if (!content.trim()) {
      toast.info("There's no content to download.");
      return;
    }
    const plainText = processMarkdownForSpeech(content);
    const fileName = `${title || 'untitled-note'}.txt`;
    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast.success('Note downloaded as Text!');
  };

  const handleDownloadWord = () => {
    if (!content.trim()) {
      toast.info("There's no content to download.");
      return;
    }
    const htmlContent = contentAreaRef.current?.getInnerHTML() || '';
    const wordContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${title}</title></head><body>${htmlContent}</body></html>`;
    const fileName = `${title || 'untitled-note'}.doc`;
    const blob = new Blob(['\ufeff', wordContent], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast.success('Note downloaded as Word!');
  };

  const handleAudioFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    ////console.log("handleAudioFileSelect triggered!");
    toast.info("Audio file selected, starting upload...");
    const file = event.target.files?.[0];
    if (!file || !userProfile) {
      if (!userProfile) toast.error("Cannot upload: User profile is missing.");
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
      const filePath = `${userProfile.id}/audio/${Date.now()}_${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      if (!publicUrlData?.publicUrl) {
        throw new Error("Could not get public URL for the uploaded audio file.");
      }

      // Calculate audio duration from the file
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio(audioUrl);
      const durationPromise = new Promise<number>((resolve) => {
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => resolve(0);
      });
      const audioDuration = await durationPromise;
      URL.revokeObjectURL(audioUrl);

      // Create a document record for the audio
      const { data: newDocument, error: createDocError } = await supabase
        .from('documents')
        .insert({
          user_id: userProfile.id,
          title: file.name,
          file_name: file.name,
          file_url: publicUrlData.publicUrl,
          file_type: file.type,
          type: 'audio',
          processing_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (createDocError || !newDocument) {
        throw new Error('Failed to create document record for audio.');
      }

      // Create a class recording entry with duration
      const { error: recordingError } = await supabase
        .from('class_recordings')
        .insert({
          user_id: userProfile.id,
          title: file.name,
          subject: 'Note Audio',
          audio_url: publicUrlData.publicUrl,
          duration: Math.floor(audioDuration),
          transcript: '',
          summary: '',
          document_id: newDocument.id,
          date: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });

      if (recordingError) {
        // Non-critical error, continue
        console.warn('Failed to create class recording entry:', recordingError);
      }

      setUploadedAudioDetails({
        url: publicUrlData.publicUrl,
        type: file.type,
        name: file.name
      });
      setDocumentIdForDialog(newDocument.id);
      setIsAudioOptionsVisible(true);
      toast.success('Audio file uploaded. Processing options available.', { id: toastId });
    } catch (error) {
      let errorMessage = 'An error occurred during audio file upload.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: toastId });
    } finally {
      if (event.target) event.target.value = '';
      setIsProcessingAudio(false);
    }
  };

  const handleAudioPlayerPlay = () => setIsPlayingAudio(true);
  const handleAudioPlayerPause = () => setIsPlayingAudio(false);
  const handleAudioPlayerEnded = () => setIsPlayingAudio(false);

  const handleProcessAudio = async (
    action: 'transcribe' | 'summarize' | 'translate',
    language: string | null = null,
    documentId: string | null = null
  ) => {
    if (!uploadedAudioDetails || !userProfile) {
      toast.error("No audio file uploaded or user profile missing.");
      return;
    }

    let audioDocumentId = documentId;
    if (!audioDocumentId) {
      try {
        const { data: newDocument, error: createDocError } = await supabase
          .from('documents')
          .insert({
            user_id: userProfile.id,
            title: uploadedAudioDetails.name,
            file_name: uploadedAudioDetails.name,
            file_url: uploadedAudioDetails.url,
            file_type: uploadedAudioDetails.type,
            type: 'audio',
            processing_status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (createDocError || !newDocument) throw new Error(createDocError?.message || 'Failed to create new document record for audio.');
        audioDocumentId = newDocument.id;
        onNoteUpdate({ ...note, document_id: audioDocumentId });
        setDocumentIdForDialog(audioDocumentId);
      } catch (error) {
        let errorMessage = 'Failed to create document record for audio.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast.error(errorMessage);
        setIsProcessingAudio(false);
        return;
      }
    }

    setIsProcessingAudio(true);
    let toastMessage = '';
    let edgeFunctionName = '';

    switch (action) {
      case 'transcribe':
        toastMessage = 'Transcribing audio...';
        edgeFunctionName = 'process-audio-for-transcription';
        setIsGeneratingAudioNote(true);
        break;
      case 'summarize':
        toastMessage = 'Generating audio summary...';
        edgeFunctionName = 'process-audio-for-summary';
        setIsGeneratingAudioSummary(true);
        break;
      case 'translate':
        toastMessage = `Translating audio to ${language}...`;
        edgeFunctionName = 'process-audio-for-translation';
        setIsTranslatingAudio(true);
        break;
      default:
        toast.error('Invalid audio processing action.');
        setIsProcessingAudio(false);
        return;
    }

    const toastId = toast.loading(toastMessage);

    try {
      const { data, error } = await supabase.functions.invoke(edgeFunctionName, {
        body: {
          audioUrl: uploadedAudioDetails.url,
          fileType: uploadedAudioDetails.type,
          userId: userProfile.id,
          documentId: audioDocumentId,
          targetLanguage: language
        },
      });

      if (error) throw error;
      if (!data || !data.jobId) throw new Error('No job ID received from audio processing function.');

      setAudioProcessingJobId(data.jobId);
      toast.success('Audio processing job started. We will notify you when it\'s done!', { id: toastId });

    } catch (error) {
      let errorMessage = `Failed to start audio ${action}.`;
      if (error instanceof FunctionsHttpError) {
        errorMessage = `Function error (${error.context.status}): ${error.context.statusText}.`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: toastId });
      setIsProcessingAudio(false);
      setIsGeneratingAudioNote(false);
      setIsGeneratingAudioSummary(false);
      setIsTranslatingAudio(false);
    }
  };
  return (
    <div className="flex bg-white flex-col h-full w-full dark:bg-gray-950">
      {/* Audio Options Section */}
      <AudioOptionsSection
        uploadedAudioDetails={uploadedAudioDetails}
        isAudioOptionsVisible={isAudioOptionsVisible}
        audioPlayerRef={audioPlayerRef}
        isPlayingAudio={isPlayingAudio}
        handlePlayAudio={handleAudioPlayerPlay}
        handleAudioEnded={handleAudioPlayerEnded}
        handleDownloadAudio={() => { }}
        handleCopyAudioUrl={() => { }}
        handleClearAudioProcessing={() => { }}
        handleGenerateNoteFromAudio={() => handleProcessAudio('transcribe', null, note.document_id)}
        handleGenerateSummaryFromAudio={() => handleProcessAudio('summarize', null, note.document_id)}
        targetLanguage={targetLanguage}
        setTargetLanguage={setTargetLanguage}
        handleTranslateAudio={() => handleProcessAudio('translate', targetLanguage, note.document_id)}
        isGeneratingAudioNote={isGeneratingAudioNote}
        isGeneratingAudioSummary={isGeneratingAudioSummary}
        isTranslatingAudio={isTranslatingAudio}
        isProcessingAudio={isProcessingAudio}
        userProfile={userProfile}
      />

      {/* Main Editor Container - Centered with max-width */}
      <div className="flex-1 h-full overflow-hidden flex">
        <div className="w-full max-w-[1200px] mx-auto flex flex-col lg:flex-row shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900">
          {/* Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <NoteContentArea
              ref={contentAreaRef}
              content={content}
              setContent={handleContentChange}
              userProfile={userProfile}
              title={title}
              setTitle={setTitle}
              category={category}
              setCategory={setCategory}
              tags={tags}
              setTags={setTags}
              onSave={handleSave}
              onToggleNotesHistory={onToggleNotesHistory}
              isNotesHistoryOpen={isNotesHistoryOpen}
              isUploading={isUploading}
              isGeneratingAI={isGeneratingAI}
              isProcessingAudio={isProcessingAudio}
              regenerateNoteFromDocument={regenerateNoteFromDocument}
              handleViewOriginalDocument={handleViewOriginalDocument}
              documentId={note.document_id}
              handleDownloadNote={handleDownloadNote}
              handleDownloadPdf={handleDownloadPdf}
              handleDownloadHTML={handleDownloadHTML}
              handleDownloadTXT={handleDownloadTXT}
              handleDownloadWord={handleDownloadWord}
              handleCopyNoteContent={handleCopyNoteContent}
              handleTextToSpeech={handleTextToSpeech}
              isSpeaking={isSpeaking}
              fileInputRef={fileInputRef}
              handleFileSelect={handleFileSelect}
              audioInputRef={audioInputRef}
              handleAudioFileSelect={handleAudioFileSelect}
              note={note}
              isLoading={isLoading}
              isSummaryVisible={isSummaryVisible}
              // Add these missing props for empty state functionality:
              onCreateFirstNote={() => {
                // Create a new empty note
                const newNote: Note = {
                  id: '', // Will be generated by database
                  title: 'Untitled Note',
                  content: '',
                  category: 'general',
                  tags: [],
                  user_id: userProfile?.id || '',
                  ai_summary: null,
                  document_id: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                onNoteUpdate(newNote);
              }}
              onCreateFromTemplate={() => {
                // Open template selection dialog or use a predefined template
                toast.info('Template selection coming soon!');
                // For now, create a note with template structure
                const templateNote: Note = {
                  id: '',
                  title: 'Template Note',
                  content: '# Title\n\n## Subtitle\n\n- Bullet point 1\n- Bullet point 2\n\n**Important** text here.',
                  category: 'general',
                  tags: ['template'],
                  user_id: userProfile?.id || '',
                  ai_summary: null,
                  document_id: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),

                };
                onNoteUpdate(templateNote);
              }}
              onCreateFromDocument={() => {
                // Trigger document upload
                fileInputRef.current?.click();
              }}
            />
          </div>

          {note.ai_summary && isSummaryVisible && (
            <AISummarySection
              ai_summary={note.ai_summary}
              isSummaryVisible={isSummaryVisible}
              setIsSummaryVisible={setIsSummaryVisible}
            />
          )}


          {/* Translated Content Section */}
          {translatedContent && (
            <div className="lg:w-80 lg:border-l lg:border-gray-200 lg:dark:border-gray-700">
              <TranslatedContentSection
                translatedContent={translatedContent}
                targetLanguage={targetLanguage}
                setTranslatedContent={setTranslatedContent}
              />
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <SectionSelectionDialog
        isOpen={isSectionDialogOpen}
        sections={documentSections}
        onSectionSelect={(section) => handleSectionSelect(section, documentIdForDialog!)}
        onCancel={() => {
          setIsSectionDialogOpen(false);
          setIsUploading(false);
          setSelectedFile(null);
          setExtractedContent(null);
          setUploadedDocumentPublicUrl(null);
          setDocumentIdForDialog(null);
        }}
        documentId={documentIdForDialog!}
      />

      <DocumentViewerDialog
        isOpen={isDocumentViewerOpen}
        onClose={() => setIsDocumentViewerOpen(false)}
        content={originalDocumentContent}
        fileType={originalDocumentFileType}
        fileUrl={originalDocumentFileUrl}
      />
    </div>
  );
}