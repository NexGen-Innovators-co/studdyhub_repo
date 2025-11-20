// NoteEditor.tsx
import React, { useState, useEffect, useRef } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '../../integrations/supabase/client';
import { Note, NoteCategory, UserProfile } from '../../types';
import { Database } from '../../integrations/supabase/types';

// Import refactored components
import { NoteEditorHeader } from './components/NoteEditorHeader';
import { NoteContentArea } from './components/NoteContentArea';
import { AISummarySection } from './components/AISummarySection';
import { TranslatedContentSection } from './components/TranslatedContentSection';
import { AudioOptionsSection } from './components/AudioOptionsSection';

// Dialogs
import { SectionSelectionDialog } from './components/SectionSelectionDialog';
import { DocumentViewerDialog } from './components/DocumentViewerDialog';

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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
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

    if ('speechSynthesis' in window && speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    setIsSpeaking(false);

    return () => {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
    };
  }, [note]);

  useEffect(() => {
    const populateVoiceList = () => {
      if (typeof speechSynthesis === 'undefined') {
        return;
      }
      const availableVoices = speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        // Only set a default if one isn't already selected or if the selected one is no longer available
        if (!selectedVoiceURI || !availableVoices.some(v => v.voiceURI === selectedVoiceURI)) {
          const defaultVoice = availableVoices.find(voice => voice.name.includes('Google') && voice.lang.startsWith('en')) ||
            availableVoices.find(voice => voice.lang.startsWith('en')) ||
            availableVoices[0];
          if (defaultVoice) {
            setSelectedVoiceURI(defaultVoice.voiceURI);
          }
        }
      } else {
        // If no voices are immediately available, try again after a short delay
        setTimeout(populateVoiceList, 500);
      }
    };

    // Populate voices initially
    populateVoiceList();
    // Listen for voice changes (e.g., after network voices load)
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = populateVoiceList;
    }
  }, [selectedVoiceURI]);

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
              aiSummary: audioResult.summary || 'No summary available.',
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

  const handleSave = () => {
    const currentMarkdown =  content;

    const updatedNote: Note = {
      ...note,
      title: title || 'Untitled Note',
      content: currentMarkdown,
      category,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      updatedAt: new Date(),
      aiSummary:note.aiSummary
    };

    onNoteUpdate(updatedNote);
    toast.success('Note saved!');
  };
  const regenerateNoteFromDocument = async () => {
    if (!note.document_id) {
      toast.error('This note is not linked to a source document and cannot be regenerated.');
      return;
    }
    if (!userProfile) {
      toast.error('User profile not found. Cannot generate personalized note.');
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

      onNoteUpdate(newNote);
      setContent(newNote.content);
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
      //console.error('Error regenerating note:', error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    //console.log("🚀 handleFileSelect triggered!");
    const file = event.target.files?.[0];

    if (!file || !userProfile) {
      if (!userProfile) {
        //console.error("❌ User profile is missing");
        toast.error("Cannot upload: User profile is missing.");
      }
      return;
    }

    // console.log("📄 File selected:", {
    //   name: file.name,
    //   type: file.type,
    //   size: file.size,
    //   userId: userProfile.id
    // });

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
      //console.log("🎵 Routing to audio file handler");
      handleAudioFileSelect(event);
      return;
    }

    // Validate document type
    if (!allowedDocumentTypes.includes(file.type)) {
      //console.error("❌ Unsupported file type:", file.type);
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
      //console.error('Error processing document:', error);
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  const generateAIContentForNote = async (
    targetNote: Note,
    user: UserProfile,
    selectedSection: string | null,
    toastId: string, // Receive the toast ID
    documentIdForGeneration: string | null
  ) => {
    setIsGeneratingAI(true);

    // Update the existing toast
    toast.loading('Generating AI note content...', { id: toastId });

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
        ...targetNote,
        title: aiGeneratedNote.title || targetNote.title,
        content: aiGeneratedNote.content,
        aiSummary: aiGeneratedNote.aiSummary,
        updatedAt: new Date(),
        document_id: documentIdForGeneration,
      };

      if (!targetNote.id) {
        const { data: newNoteData, error: createNoteError } = await supabase
          .from('notes')
          .insert({
            title: updatedNote.title,
            content: updatedNote.content,
            category: updatedNote.category,
            tags: updatedNote.tags,
            user_id: user.id,
            ai_summary: updatedNote.aiSummary,
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
          createdAt: new Date(newNoteData.created_at),
          updatedAt: new Date(newNoteData.updated_at),
        });

        toast.success('New note generated from document!', { id: toastId });
      } else {
        const { error: updateNoteError } = await supabase
          .from('notes')
          .update({
            title: updatedNote.title,
            content: updatedNote.content,
            ai_summary: updatedNote.aiSummary,
            updated_at: new Date().toISOString(),
            document_id: updatedNote.document_id,
          })
          .eq('id', updatedNote.id)
          .eq('user_id', user.id);

        if (updateNoteError) throw updateNoteError;

        onNoteUpdate(updatedNote);
        toast.success('Note updated from document!', { id: toastId });
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
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
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
  const handleTextToSpeech = () => {
    if (!('speechSynthesis' in window)) {
      toast.error("Text-to-speech is not supported in this browser.");
      return;
    }

    // If speech is currently active (according to our state), the user wants to stop it.
    if (isSpeaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      toast.info("Speech stopped.");
      return; // Exit the function, as the action was to stop.
    }

    // If we reach here, the user wants to start speech.
    if (!content.trim()) {
      toast.info("There's no content to read aloud.");
      return;
    }



    const textToRead = processMarkdownForSpeech(content);
    if (!textToRead) {
      toast.info("The note has no readable content after processing.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToRead);

    // Re-fetch voices to ensure we have the most current list
    const currentAvailableVoices = speechSynthesis.getVoices();
    let voiceToUse: SpeechSynthesisVoice | undefined = undefined;

    // Try to find the previously selected voice first among current voices
    if (selectedVoiceURI) {
      voiceToUse = currentAvailableVoices.find(v => v.voiceURI === selectedVoiceURI);
    }

    // If selected voice not found or not set, try to find a suitable default
    if (!voiceToUse && currentAvailableVoices.length > 0) {
      voiceToUse = currentAvailableVoices.find(voice => voice.name.includes('Google') && voice.lang.startsWith('en')) ||
        currentAvailableVoices.find(voice => voice.lang.startsWith('en')) ||
        currentAvailableVoices[0];
      if (voiceToUse) {
        setSelectedVoiceURI(voiceToUse.voiceURI); // Update state with the fallback voice
      }
    }

    if (voiceToUse) {
      utterance.voice = voiceToUse;
    } else {
      // If no voice is found after all attempts, show error and prevent speaking
      toast.error("No suitable text-to-speech voice found on your device. Please check your device settings.");
      //console.error("No suitable voice found for speech synthesis.");
      return;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
      //console.error("Speech synthesis error:", e);
      let errorMessage = "An unknown error occurred while reading the note.";
      if (e.error === "interrupted") {
        errorMessage = "Speech was interrupted. This can happen if you switch apps, receive a call, or rapidly tap the read button.";
      } else if (e.error === "synthesis-failed") {
        errorMessage = "Speech synthesis failed. This may be due to voice unavailability or a browser issue.";
      } else if (e.error) {
        errorMessage = `Speech error: ${e.error}. This may be due to browser limitations or voice availability.`;
      }
      toast.error(errorMessage);
      setIsSpeaking(false);
    };

    try {
      speechSynthesis.speak(utterance);
    } catch (error) {
      //console.error("Error calling speechSynthesis.speak:", error);
      toast.error("Failed to start reading. Your browser might have restrictions.");
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
      //console.error('Error loading original document:', error);
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

  // ============================================
// FILE 1: NoteEditor.tsx
// Replace the handleDownloadPdf function with this:
// ============================================

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
    console.error('html2pdf.js is not loaded. Please ensure it is included in your project.');
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
      console.error('Error generating PDF:', error);
      if (document.body.contains(tempContainer)) {
        document.body.removeChild(tempContainer);
      }
    });
};

// ============================================
// FILE 2: ALTERNATIVE APPROACH (if html2pdf is not loaded)
// Add this as a fallback method in NoteEditor.tsx
// ============================================

const handleDownloadPdfFallback = () => {
  if (!content.trim()) {
    toast.info("There's no content to convert to PDF.");
    return;
  }

  // Use browser's print-to-PDF as fallback
  const htmlContent = contentAreaRef.current?.getInnerHTML() || '';
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('Please allow pop-ups to generate PDF');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title || 'Untitled Note'}</title>
      <style>
        @page {
          margin: 2cm;
          size: A4;
        }
        body {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 12pt;
          line-height: 1.6;
          color: #000;
          max-width: 210mm;
          margin: 0 auto;
          padding: 20px;
          background: white;
        }
        h1, h2, h3, h4, h5, h6 {
          color: #000;
          margin-top: 1em;
          margin-bottom: 0.5em;
          font-weight: bold;
          break-after: avoid;
        }
        h1 { font-size: 24pt; }
        h2 { font-size: 20pt; }
        h3 { font-size: 16pt; }
        pre {
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 10px;
          overflow-x: auto;
          font-family: 'Courier New', monospace;
          font-size: 10pt;
          margin: 1em 0;
          break-inside: avoid;
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
          break-inside: avoid;
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
        img, svg {
          max-width: 100%;
          height: auto;
          break-inside: avoid;
        }
        @media print {
          body {
            background: white;
          }
        }
      </style>
    </head>
    <body>
      <div style="margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px;">
        <h1>${title || 'Untitled Note'}</h1>
        ${category !== 'general' ? `<p style="color: #666; font-size: 10pt;">Category: ${category}</p>` : ''}
        ${tags ? `<p style="color: #666; font-size: 10pt;">Tags: ${tags}</p>` : ''}
      </div>
      ${htmlContent}
    </body>
    </html>
  `);

  printWindow.document.close();
  
  // Wait for content to load before printing
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      toast.success('Opening print dialog. Choose "Save as PDF" as your printer.');
    }, 500);
  };
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
      //console.error('Failed to copy text: ', err);
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
    ("handleAudioFileSelect triggered!");
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

      setUploadedAudioDetails({
        url: publicUrlData.publicUrl,
        type: file.type,
        name: file.name
      });
      setIsAudioOptionsVisible(true);
      toast.success('Audio file uploaded. Processing options available.', { id: toastId });
      setIsProcessingAudio(false);
    } catch (error) {
      let errorMessage = 'An error occurred during audio file upload.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: toastId });
      //console.error('Error uploading audio file:', error);
      setIsProcessingAudio(false);
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
    <div className="flex flex-col max-h-[95vh] bg-white dark:bg-gray-950 rounded-lg shadow-sm ">
      <NoteEditorHeader
        title={title}
        setTitle={setTitle}
        category={category}
        setCategory={setCategory}
        tags={tags}
        setTags={setTags}
        isUploading={isUploading}
        isGeneratingAI={isGeneratingAI}
        isProcessingAudio={isProcessingAudio}
        userProfile={userProfile}
        regenerateNoteFromDocument={regenerateNoteFromDocument}
        handleViewOriginalDocument={handleViewOriginalDocument}
        handleDownloadNote={handleDownloadNote}
        handleDownloadPdf={handleDownloadPdf}
        handleDownloadHTML={handleDownloadHTML}
        handleDownloadTXT={handleDownloadTXT}
        handleDownloadWord={handleDownloadWord}
        handleCopyNoteContent={handleCopyNoteContent}
        handleTextToSpeech={handleTextToSpeech}
        isSpeaking={isSpeaking}
        handleSave={handleSave}
        selectedVoiceURI={selectedVoiceURI}
        setSelectedVoiceURI={setSelectedVoiceURI}
        voices={voices}
        documentId={note.document_id}
        onToggleNotesHistory={onToggleNotesHistory}
        isNotesHistoryOpen={isNotesHistoryOpen}
        fileInputRef={fileInputRef}
        handleFileSelect={handleFileSelect}
        audioInputRef={audioInputRef}
        handleAudioFileSelect={handleAudioFileSelect}
      />

      <AudioOptionsSection
        uploadedAudioDetails={uploadedAudioDetails}
        isAudioOptionsVisible={isAudioOptionsVisible}
        audioPlayerRef={audioPlayerRef}
        isPlayingAudio={isPlayingAudio}
        handlePlayAudio={handleAudioPlayerPlay}
        handleAudioEnded={handleAudioPlayerEnded}
        handleDownloadAudio={() => { /* Placeholder if needed, but handled by NoteEditorHeader */ }}
        handleCopyAudioUrl={() => { /* Placeholder if needed, but handled by NoteEditorHeader */ }}
        handleClearAudioProcessing={() => { /* Placeholder if needed, but handled by NoteEditorHeader */ }}
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

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
        <NoteContentArea
          ref={contentAreaRef}
          content={content}
          setContent={setContent}
          userProfile={userProfile}
          title={title}
          note={note}
        />

        {note.aiSummary && (
          <AISummarySection
            aiSummary={note.aiSummary}
            isSummaryVisible={isSummaryVisible}
            setIsSummaryVisible={setIsSummaryVisible}
          />
        )}

        {translatedContent && (
          <TranslatedContentSection
            translatedContent={translatedContent}
            targetLanguage={targetLanguage}
            setTranslatedContent={setTranslatedContent}
          />
        )}
      </div>

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
};