import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw'; // Needed for rendering raw HTML, especially for Mermaid SVG
import { Sparkles, Hash, Save, Brain, RefreshCw, UploadCloud, Volume2, StopCircle, Menu, FileText, ChevronDown, ChevronUp, Download, Copy, FileDown, Mic, Play, Pause, XCircle } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Note, NoteCategory, UserProfile } from '../types';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import Mermaid from './Mermaid';
import { SectionSelectionDialog } from './SectionSelectionDialog';
import { DocumentViewerDialog } from './DocumentViewerDialog';

// Import Supabase generated types
import { Database } from '../integrations/supabase/types'; // Adjust path if your supabase.ts is elsewhere

// Explicitly type the supabase client for better type inference with custom tables
const typedSupabase = supabase as any; // Cast to any for broader compatibility, or use createClient<Database>() if your setup allows

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
  const [content, setContent] = useState(note.content);
  const [category, setCategory] = useState<NoteCategory>(note.category);
  const [tags, setTags] = useState(note.tags.join(', '));
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [documentSections, setDocumentSections] = useState<string[]>([]);
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedContent, setExtractedContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSummaryVisible, setIsSummaryVisible] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

    setIsSummaryVisible(true); // Ensure summary is visible by default when note loads

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
        if (!selectedVoiceURI) {
          const defaultVoice = availableVoices.find(voice => voice.name === 'Google US English') || availableVoices[0];
          if (defaultVoice) setSelectedVoiceURI(defaultVoice.voiceURI);
        }
      }
    };

    populateVoiceList();
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = populateVoiceList;
    }
  }, []);

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
            // Update the note content and link to the newly created document
            setContent(audioResult.transcript || 'No transcription available.');
            onNoteUpdate({
              ...note,
              content: audioResult.transcript || '', // Ensure content is updated in the note object
              aiSummary: audioResult.summary || 'No summary available.',
              document_id: audioResult.document_id || null // Set the document_id from the audio result
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
        console.error('Polling error:', error);
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
  }, [audioProcessingJobId, userProfile, note, onNoteUpdate]);


  const handleSave = () => {
    const updatedNote: Note = {
      ...note,
      title: title || 'Untitled Note',
      content,
      category,
      tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag !== ''),
      updatedAt: new Date()
    };

    onNoteUpdate(updatedNote);
    toast.success('Note saved successfully!');
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
      toast.success('Note regenerated successfully!', { id: toastId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate note.';
      toast.error(errorMessage, { id: toastId });
      console.error('Error regenerating note:', error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userProfile) {
      if (!userProfile) toast.error("Cannot upload: User profile is missing.");
      return;
    }

    const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported file type. Please upload a PDF, TXT file or a Word document.');
      if (event.target) event.target.value = '';
      return;
    }

    setIsUploading(true);
    setSelectedFile(file);
    const toastId = toast.loading('Uploading document...');

    try {
      const filePath = `${userProfile.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      toast.loading('Extracting text from document...', { id: toastId });

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error("Could not get public URL for the uploaded file.");
      }

      const { data: extractionData, error: extractionError } = await supabase.functions.invoke('gemini-document-extractor', {
        body: {
          file_url: urlData.publicUrl,
          file_type: file.type
        }
      });

      if (extractionError) throw extractionError;
      const extractedContent = extractionData.content_extracted;
      setExtractedContent(extractedContent);

      toast.loading('Analyzing document structure...', { id: toastId });
      const { data: structureData, error: structureError } = await supabase.functions.invoke('analyze-document-structure', {
        body: { documentContent: extractedContent }
      });

      if (structureError) throw structureError;

      if (structureData && structureData.sections && structureData.sections.length > 0) {
        setDocumentSections(structureData.sections);
        setIsSectionDialogOpen(true);
        toast.dismiss(toastId);
      } else {
        await generateNoteFromExtractedContent(extractedContent, file.name, urlData.publicUrl, file.type, toastId.toString());
      }

    } catch (error) {
      let errorMessage = 'An unknown error occurred.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `Function error (${error.context.status}): ${error.context.statusText}. Check function logs.`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast.error(errorMessage, { id: toastId });
      console.error('Error during upload and generate process:', error);
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  const generateNoteFromExtractedContent = async (contentToUse: string, fileName: string, fileUrl: string, fileType: string, toastId: string, selectedSection: string | null = null) => {
    if (!userProfile) {
      toast.error("User profile not found. Cannot generate personalized note.");
      return;
    }

    setIsGeneratingAI(true);
    toast.loading('Generating AI note...', { id: toastId });

    try {
      const { data: newDocument, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: userProfile.id,
          title: fileName,
          file_name: fileName,
          file_url: fileUrl,
          content_extracted: contentToUse,
          file_type: fileType,
        })
        .select('id')
        .single();

      if (docError || !newDocument) throw new Error(docError?.message || 'Failed to create document record.');

      const { data: newNote, error: generationError } = await supabase.functions.invoke('generate-note-from-document', {
        body: {
          documentId: newDocument.id,
          userProfile,
          selectedSection,
        },
      });

      if (generationError) throw new Error(generationError.message || 'Failed to generate note.');

      onNoteUpdate(newNote);
      toast.success('New note generated from document!', { id: toastId });

    } catch (error) {
      let errorMessage = 'An unknown error occurred.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `Function error (${error.context.status}): ${error.context.statusText}. Check function logs.`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: toastId });
      console.error('Error during note generation:', error);
    } finally {
      setIsGeneratingAI(false);
      setIsSectionDialogOpen(false);
      setDocumentSections([]);
      setSelectedFile(null);
      setExtractedContent(null);
    }
  };

  const handleSectionSelect = async (section: string | null) => {
    if (!selectedFile || !extractedContent || !userProfile) {
      toast.error("Missing file or extracted content to generate note.");
      return;
    }

    const toastId = toast.loading(`Generating note from ${section ? `section: ${section}` : 'full document'}...`);
    await generateNoteFromExtractedContent(extractedContent, selectedFile.name, supabase.storage.from('documents').getPublicUrl(`${userProfile.id}/${Date.now()}_${selectedFile.name}`).data.publicUrl, selectedFile.type, toastId as string, section);
  };

  const handleTextToSpeech = () => {
    if (!('speechSynthesis' in window)) {
      toast.error('Your browser does not support text-to-speech.');
      return;
    }

    if (isSpeaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!content.trim()) {
      toast.info("There's no content to read.");
      return;
    }

    const textToRead = content
      .replace(/```mermaid[\s\S]*?```/g, '(A diagram is present here.)')
      .replace(/###\s?.*?\s/g, '')
      .replace(/\*\*|\*|_|`|~/g, '')
      .replace(/(\r\n|\n|\r)/gm, " ");

    const utterance = new SpeechSynthesisUtterance(textToRead);

    if (selectedVoiceURI) {
      const selectedVoice = voices.find(v => v.voiceURI === selectedVoiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.error("Speech synthesis error", e);
      toast.error("An error occurred while reading the note.");
      setIsSpeaking(false);
    };

    speechSynthesis.speak(utterance);
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
      console.error('Error loading original document:', error);
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

    const previewElement = document.getElementById('note-preview-content');
    if (previewElement) {
      toast.loading('Generating PDF...', { id: 'pdf-download' });
      if (typeof window.html2pdf === 'undefined') {
        toast.error('PDF generation library not loaded. Please try again later.', { id: 'pdf-download' });
        console.error('html2pdf.js is not loaded. Please ensure it is included in your project, e.g., in public/index.html via <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>');
        return;
      }

      window.html2pdf()
        .from(previewElement)
        .set({
          margin: [10, 10, 10, 10],
          filename: `${title || 'untitled-note'}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, logging: true, dpi: 192, letterRendering: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .save()
        .then(() => {
          toast.success('Note downloaded as PDF!', { id: 'pdf-download' });
        })
        .catch((error: any) => {
          toast.error('Failed to generate PDF.', { id: 'pdf-download' });
          console.error('Error generating PDF:', error);
        });
    } else {
      toast.error('Could not find the note preview content to generate PDF.');
    }
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
      console.error('Failed to copy text: ', err);
      toast.error('Failed to copy note content.');
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const triggerAudioUpload = () => {
    audioInputRef.current?.click();
  };

  const handleAudioFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      const filePath = `${userProfile.id}/audio/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw new Error(`Audio upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error("Could not get public URL for the uploaded audio file.");
      }

      setUploadedAudioDetails({ url: urlData.publicUrl, type: file.type, name: file.name });
      setIsAudioOptionsVisible(true);
      toast.success('Audio file uploaded. Choose an action.', { id: toastId });

    } catch (error) {
      let errorMessage = 'An unknown error occurred during audio upload.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `Function error (${error.context.status}): ${error.context.statusText}. Check function logs.`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: toastId });
      console.error('Error during audio upload:', error);
    } finally {
      setIsProcessingAudio(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleGenerateNoteFromAudio = async () => {
    if (!uploadedAudioDetails || !userProfile) {
      toast.error("No audio uploaded or user profile missing.");
      return;
    }

    setIsGeneratingAudioNote(true);
    const toastId = toast.loading('Initiating full note generation from audio...');

    try {
      // Create a new document entry for the audio file first
      const { data: newDocument, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: userProfile.id,
          title: `Audio Note: ${uploadedAudioDetails.name}`,
          file_name: uploadedAudioDetails.name,
          file_url: uploadedAudioDetails.url,
          content_extracted: 'Processing audio for content...', // Placeholder
          file_type: uploadedAudioDetails.type,
        })
        .select('id')
        .single();

      if (docError || !newDocument) throw new Error(docError?.message || 'Failed to create document record for audio.');

      // Call the new background processing Edge Function, passing the new document_id
      const { data, error } = await supabase.functions.invoke('process-audio', {
        body: {
          file_url: uploadedAudioDetails.url,
          target_language: targetLanguage,
          user_id: userProfile.id,
          document_id: newDocument.id // Pass the newly created document ID
        },
      });

      if (error) throw error;
      if (!data || !data.job_id) throw new Error('No job ID received from audio processor.');

      setAudioProcessingJobId(data.job_id);
      toast.success('Audio processing job started. You will be notified when it\'s complete.', { id: toastId });
      setIsProcessingAudio(true);
    } catch (error) {
      let errorMessage = 'Failed to start audio note generation.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `Function error (${error.context.status}): ${error.context.statusText}. Check function logs.`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: toastId });
      console.error('Error initiating audio note generation:', error);
    } finally {
      setIsGeneratingAudioNote(false);
    }
  };

  const handleGenerateSummaryFromAudio = async () => {
    if (!uploadedAudioDetails || !userProfile) {
      toast.error("No audio uploaded or user profile missing.");
      return;
    }

    setIsGeneratingAudioSummary(true);
    const toastId = toast.loading('Initiating summary generation from audio...');

    try {
      const { data, error } = await supabase.functions.invoke('process-audio', {
        body: {
          file_url: uploadedAudioDetails.url,
          target_language: targetLanguage,
          user_id: userProfile.id,
          // document_id is not passed here as we are only generating a summary, not a full note linked to a new document
        },
      });

      if (error) throw error;
      if (!data || !data.job_id) throw new Error('No job ID received from audio processor.');

      setAudioProcessingJobId(data.job_id);
      toast.success('Audio summary job started. You will be notified when it\'s complete.', { id: toastId });
      setIsProcessingAudio(true);
    } catch (error) {
      let errorMessage = 'Failed to start audio summary generation.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `Function error (${error.context.status}): ${error.context.statusText}. Check function logs.`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: toastId });
      console.error('Error initiating audio summary generation:', error);
    } finally {
      setIsGeneratingAudioSummary(false);
    }
  };

  const handleTranslateAudio = async () => {
    if (!uploadedAudioDetails || !userProfile) {
      toast.error("No audio uploaded or user profile missing.");
      return;
    }
    if (targetLanguage === 'en') {
      toast.info("Please select a target language other than English for translation.");
      return;
    }

    setIsTranslatingAudio(true);
    const toastId = toast.loading(`Initiating translation of audio transcript to ${targetLanguage.toUpperCase()}...`);

    try {
      const { data, error } = await supabase.functions.invoke('process-audio', {
        body: {
          file_url: uploadedAudioDetails.url,
          target_language: targetLanguage,
          user_id: userProfile.id,
          // document_id is not passed here
        },
      });

      if (error) throw error;
      if (!data || !data.job_id) throw new Error('No job ID received from audio processor.');

      setAudioProcessingJobId(data.job_id);
      toast.success(`Audio translation job started. You will be notified when it's complete.`, { id: toastId });
      setIsProcessingAudio(true);
    } catch (error) {
      let errorMessage = 'Failed to start audio translation.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `Function error (${error.context.status}): ${error.context.statusText}. Check function logs.`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: toastId });
      console.error('Error initiating audio translation:', error);
    } finally {
      setIsTranslatingAudio(false);
    }
  };

  const handlePlayAudio = () => {
    if (audioPlayerRef.current && uploadedAudioDetails) {
      if (isPlayingAudio) {
        audioPlayerRef.current.pause();
      } else {
        audioPlayerRef.current.play();
      }
      setIsPlayingAudio(!isPlayingAudio);
    } else {
      toast.info("No audio file to play.");
    }
  };

  const handleAudioEnded = () => {
    setIsPlayingAudio(false);
  };

  const handleDownloadAudio = () => {
    if (!uploadedAudioDetails) {
      toast.info("No audio file to download.");
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
      toast.info("No audio URL to copy.");
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
      console.error('Failed to copy audio URL: ', err);
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
    setIsGeneratingAudioNote(false);
    setIsGeneratingAudioSummary(false);
    setIsTranslatingAudio(false);
    setTranslatedContent(null);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      setIsPlayingAudio(false);
    }
    toast.dismiss('audio-job-status');
  };


  const CodeRenderer = ({ inline, className, children, ...props }: any) => {
    const codeContent = String(children).trim();
    const match = /language-(\w+)/.exec(className || '');
    const lang = match && match[1];

    if (!inline && lang === 'mermaid') {
      return <Mermaid chart={codeContent} />;
    }

    return !inline && lang ? (
      <div className="relative my-4 rounded-md overflow-hidden">
        <div className="absolute top-0 right-0 bg-slate-700 text-white text-xs px-2 py-1 rounded-bl-md">
          {lang.toUpperCase()}
        </div>
        <pre className="p-4 bg-slate-800 text-white overflow-x-auto">
          <code className={`language-${lang}`} {...props}>
            {codeContent}
          </code>
        </pre>
      </div>
    ) : (
      <code className="bg-slate-100 text-purple-600 px-1 py-0.5 rounded" {...props}>
        {codeContent}
      </code>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Editor Header */}
      <div className="p-3 sm:p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          {/* Mobile toggle for notes history */}
          {onToggleNotesHistory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleNotesHistory}
              className="lg:hidden h-8 w-8 p-0 mr-2"
            >
              {isNotesHistoryOpen ? <FileText className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          )}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="text-2xl font-bold border-none p-0 shadow-none focus-visible:ring-0 bg-transparent flex-1 min-w-0"
          />
          {/* Desktop buttons */}
          <div className="hidden lg:flex items-center gap-2 flex-wrap justify-end">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept=".pdf,.txt,.doc,.docx" />
            <Button
              variant="outline"
              size="sm"
              onClick={triggerFileUpload}
              disabled={isUploading || isGeneratingAI || isProcessingAudio || !userProfile}
            >
              {isUploading ? (
                <Brain className="h-4 w-4 mr-2 animate-pulse" />
              ) : (
                <UploadCloud className="h-4 w-4 mr-2" />
              )}
              {isUploading ? 'Processing...' : 'Upload Doc & Generate'}
            </Button>
            <input type="file" ref={audioInputRef} onChange={handleAudioFileSelect} style={{ display: 'none' }} accept="audio/*" />
            <Button
              variant="outline"
              size="sm"
              onClick={triggerAudioUpload}
              disabled={isProcessingAudio || isUploading || isGeneratingAI || !userProfile}
            >
              {isProcessingAudio ? (
                <Brain className="h-4 w-4 mr-2 animate-pulse" />
              ) : (
                <Mic className="h-4 w-4 mr-2" />
              )}
              {isProcessingAudio ? 'Uploading Audio...' : 'Upload Audio'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={regenerateNoteFromDocument}
              disabled={isUploading || isGeneratingAI || isProcessingAudio || !note.document_id}
              className="text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              {isGeneratingAI ? (
                <Brain className="h-4 w-4 mr-2 animate-pulse" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isGeneratingAI ? 'Generating...' : 'Regenerate Note'}
            </Button>
            {/* New "View Original Document" button for desktop */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewOriginalDocument}
              disabled={!note.document_id || isLoadingDocument || isProcessingAudio}
            >
              {isLoadingDocument ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              View Original Document
            </Button>
            {/* New "Download Note" button for desktop */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadNote}
              disabled={!content.trim()}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Markdown
            </Button>
            {/* New "Download PDF" button for desktop */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={!content.trim()}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            {/* New "Copy Note Content" button for desktop */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyNoteContent}
              disabled={!content.trim()}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Content
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTextToSpeech}
              disabled={isUploading || isGeneratingAI || isProcessingAudio}
            >
              {isSpeaking ? (
                <StopCircle className="h-4 w-4 mr-2 animate-pulse text-red-500" />
              ) : (
                <Volume2 className="h-4 w-4 mr-2" />
              )}
              {isSpeaking ? 'Stop' : 'Read Aloud'}
            </Button>
            <Button onClick={handleSave} size="sm">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Full Preview' : 'Edit with Live Preview'}
            </Button>
          </div>

          {/* Mobile buttons toggler */}
          <div className="relative lg:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu className="h-4 w-4" />
              <span className="ml-2">More</span>
            </Button>
            {isMobileMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-md shadow-lg z-10 flex flex-col py-2">
                {/* Action Buttons */}
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept=".pdf,.txt,.doc,.docx" />
                <Button
                  variant="ghost"
                  className="justify-start px-4 py-2"
                  onClick={() => { triggerFileUpload(); setIsMobileMenuOpen(false); }}
                  disabled={isUploading || isGeneratingAI || isProcessingAudio || !userProfile}
                >
                  {isUploading ? (
                    <Brain className="h-4 w-4 mr-2 animate-pulse" />
                  ) : (
                    <UploadCloud className="h-4 w-4 mr-2" />
                  )}
                  {isUploading ? 'Processing...' : 'Upload Doc & Generate'}
                </Button>
                <input type="file" ref={audioInputRef} onChange={handleAudioFileSelect} style={{ display: 'none' }} accept="audio/*" />
                <Button
                  variant="ghost"
                  className="justify-start px-4 py-2"
                  onClick={() => { triggerAudioUpload(); setIsMobileMenuOpen(false); }}
                  disabled={isProcessingAudio || isUploading || isGeneratingAI || !userProfile}
                >
                  {isProcessingAudio ? (
                    <Brain className="h-4 w-4 mr-2 animate-pulse" />
                  ) : (
                    <Mic className="h-4 w-4 mr-2" />
                  )}
                  {isProcessingAudio ? 'Uploading Audio...' : 'Upload Audio'}
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start px-4 py-2"
                  onClick={() => { regenerateNoteFromDocument(); setIsMobileMenuOpen(false); }}
                  disabled={isUploading || isGeneratingAI || isProcessingAudio || !note.document_id}
                >
                  {isGeneratingAI ? (
                    <Brain className="h-4 w-4 mr-2 animate-pulse" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {isGeneratingAI ? 'Generating...' : 'Regenerate Note'}
                </Button>
                {/* New "View Original Document" button for mobile */}
                <Button
                  variant="ghost"
                  className="justify-start px-4 py-2"
                  onClick={() => { handleViewOriginalDocument(); setIsMobileMenuOpen(false); }}
                  disabled={!note.document_id || isLoadingDocument || isProcessingAudio}
                >
                  {isLoadingDocument ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  View Original Document
                </Button>
                {/* New "Download Note" button for mobile */}
                <Button
                  variant="ghost"
                  className="justify-start px-4 py-2"
                  onClick={() => { handleDownloadNote(); setIsMobileMenuOpen(false); }}
                  disabled={!content.trim()}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Markdown
                </Button>
                {/* New "Download PDF" button for mobile */}
                <Button
                  variant="ghost"
                  className="justify-start px-4 py-2"
                  onClick={() => { handleDownloadPdf(); setIsMobileMenuOpen(false); }}
                  disabled={!content.trim()}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                {/* New "Copy Note Content" button for mobile */}
                <Button
                  variant="ghost"
                  className="justify-start px-4 py-2"
                  onClick={() => { handleCopyNoteContent(); setIsMobileMenuOpen(false); }}
                  disabled={!content.trim()}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Content
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start px-4 py-2"
                  onClick={() => { handleTextToSpeech(); setIsMobileMenuOpen(false); }}
                  disabled={isUploading || isGeneratingAI || isProcessingAudio}
                >
                  {isSpeaking ? (
                    <StopCircle className="h-4 w-4 mr-2 animate-pulse text-red-500" />
                  ) : (
                    <Volume2 className="h-4 w-4 mr-2" />
                  )}
                  {isSpeaking ? 'Stop' : 'Read Aloud'}
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start px-4 py-2"
                  onClick={() => { handleSave(); setIsMobileMenuOpen(false); }}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start px-4 py-2"
                  onClick={() => { setIsEditing(!isEditing); setIsMobileMenuOpen(false); }}
                >
                  {isEditing ? <FileText className="h-4 w-4 mr-2" /> : <Menu className="h-4 w-4 mr-2" />}
                  {isEditing ? 'Full Preview' : 'Edit with Live Preview'}
                </Button>

                {/* Separator */}
                <div className="border-t border-slate-200 my-2 mx-4" />
                <p className="text-sm font-semibold text-slate-600 px-4 mb-2">Note Settings</p>

                {/* Category Select */}
                <div className="px-4 py-2">
                  <Select value={category} onValueChange={(value: NoteCategory) => setCategory(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="math">Mathematics</SelectItem>
                      <SelectItem value="science">Science</SelectItem>
                      <SelectItem value="history">History</SelectItem>
                      <SelectItem value="language">Languages</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Voice Select */}
                <div className="px-4 py-2">
                  <Select
                    value={selectedVoiceURI || ''}
                    onValueChange={(value) => setSelectedVoiceURI(value)}
                    disabled={isSpeaking || voices.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {voices.map((voice, index) => (
                        <SelectItem key={`${voice.voiceURI}-${index.toString()}`} value={voice.voiceURI}>
                          {`${voice.name} (${voice.lang})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tags Input */}
                <div className="flex items-center gap-2 px-4 py-2">
                  <Hash className="h-4 w-4 text-slate-400" />
                  <Input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Add tags (comma separated)..."
                    className="border-none shadow-none focus-visible:ring-0 bg-transparent flex-1"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* This section is now hidden on mobile and moved into the toggler */}
        <div className="hidden lg:flex items-center gap-4 flex-wrap">
          <Select value={category} onValueChange={(value: NoteCategory) => setCategory(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="math">Mathematics</SelectItem>
              <SelectItem value="science">Science</SelectItem>
              <SelectItem value="history">History</SelectItem>
              <SelectItem value="language">Languages</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={selectedVoiceURI || ''}
            onValueChange={(value) => setSelectedVoiceURI(value)}
            disabled={isSpeaking || voices.length === 0}
          >
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue placeholder="Select a voice" />
            </SelectTrigger>
            <SelectContent>
              {voices.map((voice, index) => (
                <SelectItem key={`${voice.voiceURI}-${index.toString()}`} value={voice.voiceURI}>
                  {`${voice.name} (${voice.lang})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Hash className="h-4 w-4 text-slate-400" />
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Add tags (comma separated)..."
              className="border-none shadow-none focus-visible:ring-0 bg-transparent flex-1"
            />
          </div>
        </div>
      </div>

      {/* Audio Options Panel */}
      {uploadedAudioDetails && isAudioOptionsVisible && (
        <div className="p-3 sm:p-4 border-b border-slate-200 bg-blue-50 flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-blue-800">Audio Options: {uploadedAudioDetails.name}</h3>
          <audio ref={audioPlayerRef} src={uploadedAudioDetails.url} onEnded={handleAudioEnded} className="w-full hidden" />
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePlayAudio}
              disabled={isGeneratingAudioNote || isGeneratingAudioSummary || isTranslatingAudio || isProcessingAudio}
            >
              {isPlayingAudio ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              {isPlayingAudio ? 'Pause Audio' : 'Play Audio'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAudio}
              disabled={isGeneratingAudioNote || isGeneratingAudioSummary || isTranslatingAudio || isProcessingAudio}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Audio
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAudioUrl}
              disabled={isGeneratingAudioNote || isGeneratingAudioSummary || isTranslatingAudio || isProcessingAudio}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Audio URL
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAudioProcessing}
              disabled={isGeneratingAudioNote || isGeneratingAudioSummary || isTranslatingAudio || isProcessingAudio}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Clear Audio
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={handleGenerateNoteFromAudio}
              disabled={isGeneratingAudioNote || isGeneratingAudioSummary || isTranslatingAudio || isProcessingAudio || !userProfile}
            >
              {isGeneratingAudioNote ? (
                <Brain className="h-4 w-4 mr-2 animate-pulse" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {isGeneratingAudioNote ? 'Generating Note...' : 'Generate Full Note'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGenerateSummaryFromAudio}
              disabled={isGeneratingAudioNote || isGeneratingAudioSummary || isTranslatingAudio || isProcessingAudio || !userProfile}
            >
              {isGeneratingAudioSummary ? (
                <Brain className="h-4 w-4 mr-2 animate-pulse" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {isGeneratingAudioSummary ? 'Generating Summary...' : 'Generate Only Summary'}
            </Button>
            <Select value={targetLanguage} onValueChange={setTargetLanguage} disabled={isGeneratingAudioNote || isGeneratingAudioSummary || isTranslatingAudio || isProcessingAudio}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Translate to..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="zh">Chinese</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
                <SelectItem value="ko">Korean</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTranslateAudio}
              disabled={isGeneratingAudioNote || isGeneratingAudioSummary || isTranslatingAudio || isProcessingAudio || targetLanguage === 'en' || !userProfile}
            >
              {isTranslatingAudio ? (
                <Brain className="h-4 w-4 mr-2 animate-pulse" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              {isTranslatingAudio ? 'Translating...' : 'Translate Transcript'}
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Area (Editor/Preview + AI Summary) */}
      {/* This flex container now manages the layout for editor/preview and the AI Summary */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Editor/Preview Area */}
        {isEditing ? (
          // Split view: Textarea on left, ReactMarkdown preview on right
          <div className="flex-1 p-3 sm:p-6 flex flex-col lg:flex-row gap-4 overflow-y-auto min-w-0">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing your note here..."
              className="flex-1 resize-none border shadow-sm focus-visible:ring-0 text-base leading-relaxed bg-transparent min-h-[50vh] lg:min-h-0"
            />
            <div className="flex-1 prose prose-sm max-w-none text-slate-700 leading-relaxed overflow-y-auto min-h-[50vh] lg:min-h-0 border rounded-md p-4 shadow-sm bg-white" id="note-preview-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  code: CodeRenderer,
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-4 rounded-lg shadow-md border border-slate-200">
                      <table className="w-full border-collapse" {...props} />
                    </div>
                  ),
                  thead: ({ node, ...props }) => <thead className="bg-gradient-to-r from-blue-100 to-purple-100" {...props} />,
                  th: ({ node, ...props }) => <th className="p-3 text-left border-b border-slate-300 font-semibold text-slate-800" {...props} />,
                  td: ({ node, ...props }) => <td className="p-3 border-b border-slate-200 group-last:border-b-0 even:bg-slate-50 hover:bg-blue-50 transition-colors" {...props} />,
                  h1: ({ node, ...props }) => <h1 className="text-3xl font-extrabold text-blue-700 mt-6 mb-3" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-2xl font-bold text-purple-700 mt-5 mb-2" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-xl font-semibold text-green-700 mt-4 mb-2" {...props} />,
                  h4: ({ node, ...props }) => <h4 className="text-lg font-semibold text-orange-700 mt-3 mb-1" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 text-slate-700" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1 text-slate-700" {...props} />,
                  blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-blue-400 pl-4 py-2 italic text-slate-600 bg-blue-50 rounded-r-md my-4" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-3 text-slate-700 leading-relaxed" {...props} />,
                  a: ({ node, ...props }) => <a className="text-blue-600 hover:underline" {...props} />,
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          // Full preview mode
          <div className="flex-1 p-3 sm:p-6 flex flex-col overflow-y-auto min-w-0">
            <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed flex-1 overflow-y-auto min-h-0" id="note-preview-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  code: CodeRenderer,
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-4 rounded-lg shadow-md border border-slate-200">
                      <table className="w-full border-collapse" {...props} />
                    </div>
                  ),
                  thead: ({ node, ...props }) => <thead className="bg-gradient-to-r from-blue-100 to-purple-100" {...props} />,
                  th: ({ node, ...props }) => <th className="p-3 text-left border-b border-slate-300 font-semibold text-slate-800" {...props} />,
                  td: ({ node, ...props }) => <td className="p-3 border-b border-slate-200 group-last:border-b-0 even:bg-slate-50 hover:bg-blue-50 transition-colors" {...props} />,
                  h1: ({ node, ...props }) => <h1 className="text-3xl font-extrabold text-blue-700 mt-6 mb-3" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-2xl font-bold text-purple-700 mt-5 mb-2" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-xl font-semibold text-green-700 mt-4 mb-2" {...props} />,
                  h4: ({ node, ...props }) => <h4 className="text-lg font-semibold text-orange-700 mt-3 mb-1" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 text-slate-700" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1 text-slate-700" {...props} />,
                  blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-blue-400 pl-4 py-2 italic text-slate-600 bg-blue-50 rounded-r-md my-4" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-3 text-slate-700 leading-relaxed" {...props} />,
                  a: ({ node, ...props }) => <a className="text-blue-600 hover:underline" {...props} />,
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* AI Summary Section - Now positioned responsively */}
        {note.aiSummary && (
          <>
            {/* Mobile backdrop for summary */}
            {isSummaryVisible && (
              <div
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setIsSummaryVisible(false)}
              />
            )}
            <div
              className={`
                lg:w-1/3 lg:max-w-sm lg:flex-shrink-0 lg:border-l lg:border-slate-200 lg:relative lg:h-auto lg:transform-none lg:rounded-none
                fixed bottom-0 left-0 right-0 h-1/2 bg-gradient-to-r from-purple-50 to-blue-50 z-50
                transition-transform duration-300 ease-in-out transform
                ${isSummaryVisible ? 'translate-y-0' : 'translate-y-full'}
                flex flex-col
                p-3 sm:p-6
              `}
            >
              <div className="flex items-center justify-between gap-2 mb-3 cursor-pointer" onClick={() => setIsSummaryVisible(!isSummaryVisible)}>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <h4 className="font-medium text-purple-800">AI Summary</h4>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {isSummaryVisible ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              </div>
              <div className="prose prose-sm max-w-none text-purple-700 leading-relaxed overflow-y-auto flex-1">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    code: CodeRenderer,
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-4 rounded-lg shadow-md border border-slate-200">
                        <table className="w-full border-collapse" {...props} />
                      </div>
                    ),
                    thead: ({ node, ...props }) => <thead className="bg-gradient-to-r from-purple-100 to-blue-100" {...props} />,
                    th: ({ node, ...props }) => <th className="p-3 text-left border-b border-slate-300 font-semibold text-purple-800" {...props} />,
                    td: ({ node, ...props }) => <td className="p-3 border-b border-slate-200 group-last:border-b-0 even:bg-purple-50 hover:bg-blue-50 transition-colors" {...props} />,
                    h1: ({ node, ...props }) => <h1 className="text-3xl font-extrabold text-purple-700 mt-6 mb-3" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-2xl font-bold text-blue-700 mt-5 mb-2" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-xl font-semibold text-teal-700 mt-4 mb-2" {...props} />,
                    h4: ({ node, ...props }) => <h4 className="text-lg font-semibold text-pink-700 mt-3 mb-1" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 text-purple-700" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1 text-purple-700" {...props} />,
                    blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-purple-400 pl-4 py-2 italic text-purple-600 bg-purple-50 rounded-r-md my-4" {...props} />,
                    p: ({ node, ...props }) => <p className="mb-3 text-purple-700 leading-relaxed" {...props} />,
                    a: ({ node, ...props }) => <a className="text-purple-600 hover:underline" {...props} />,
                  }}
                >
                  {note.aiSummary}
                </ReactMarkdown>
              </div>
            </div>
          </>
        )}

        {/* Translated Content Section - Still at the bottom, but within the main content area */}
        {translatedContent && (
          <div className="p-3 sm:p-6 border-t border-slate-200 bg-gradient-to-r from-green-50 to-teal-50">
            <div className="flex items-center justify-between gap-2 mb-3 cursor-pointer" onClick={() => setTranslatedContent(null)}>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-600" />
                <h4 className="font-medium text-green-800">Translated Content ({targetLanguage.toUpperCase()})</h4>
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>
            <div className="prose prose-sm max-w-none text-green-700 leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  code: CodeRenderer,
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-4 rounded-lg shadow-md border border-slate-200">
                      <table className="w-full border-collapse" {...props} />
                    </div>
                  ),
                  thead: ({ node, ...props }) => <thead className="bg-gradient-to-r from-green-100 to-teal-100" {...props} />,
                  th: ({ node, ...props }) => <th className="p-3 text-left border-b border-slate-300 font-semibold text-green-800" {...props} />,
                  td: ({ node, ...props }) => <td className="p-3 border-b border-slate-200 group-last:border-b-0 even:bg-green-50 hover:bg-teal-50 transition-colors" {...props} />,
                  h1: ({ node, ...props }) => <h1 className="text-3xl font-extrabold text-green-700 mt-6 mb-3" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-2xl font-bold text-teal-700 mt-5 mb-2" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-xl font-semibold text-blue-700 mt-4 mb-2" {...props} />,
                  h4: ({ node, ...props }) => <h4 className="text-lg font-semibold text-orange-700 mt-3 mb-1" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 text-green-700" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1 text-green-700" {...props} />,
                  blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-green-400 pl-4 py-2 italic text-green-600 bg-green-50 rounded-r-md my-4" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-3 text-green-700 leading-relaxed" {...props} />,
                  a: ({ node, ...props }) => <a className="text-green-600 hover:underline" {...props} />,
                }}
              >
                {translatedContent}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>


      <SectionSelectionDialog
        isOpen={isSectionDialogOpen}
        sections={documentSections}
        onSectionSelect={handleSectionSelect}
        onCancel={() => {
          setIsSectionDialogOpen(false);
          setIsUploading(false);
          setSelectedFile(null);
          setExtractedContent(null);
        }}
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
