// NoteEditor.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '../../integrations/supabase/client';
import { Note, NoteCategory, UserProfile } from '../../types';
import { Database } from '../../integrations/supabase/types';
import { generateSpeech, playAudioContent } from '../../services/cloudTtsService';
import mermaid from 'mermaid';
import { Chart, registerables } from 'chart.js';
import katex from 'katex';
import { Button } from '../ui/button';
import { Sparkles, RotateCw, Lightbulb, Eye } from 'lucide-react';

Chart.register(...registerables);

import { NoteContentArea } from './components/NoteContentArea';
import { AISummarySection } from './components/AISummarySection';
import { TranslatedContentSection } from './components/TranslatedContentSection';
import { AudioOptionsSection } from './components/AudioOptionsSection';

// Dialogs
import { SectionSelectionDialog } from './components/SectionSelectionDialog';
import { DocumentViewerDialog } from './components/DocumentViewerDialog';
import { set } from 'date-fns';
import '../../noteStyle.css'
// Explicitly type the supabase client for better type inference with custom tables
const typedSupabase = supabase as any;

declare global {
  interface Window {
    html2pdf: any;
  }
}

// A4 = 210x297mm.  html2pdf margin = 10mm each side.
// Content area = 190mm wide × 277mm tall.
// At scale:2 html2canvas renders at 2× then downscales, so we set the
// container width to the CSS-pixel equivalent of 190mm ≈ 718px.
const PDF_CONTAINER_WIDTH_PX = 718;
const PDF_PAGE_HEIGHT_PX     = 1047;  // 277mm × 3.78 px/mm ≈ 1047px

const renderLatexInContainer = (root: HTMLElement | null) => {
  if (!root) return;

  const latexNodes = root.querySelectorAll('[data-latex]');
  latexNodes.forEach((node) => {
    const element = node as HTMLElement;
    const latexSource = element.getAttribute('data-latex') || element.textContent || '';
    if (!latexSource.trim()) return;

    const displayAttr = element.getAttribute('data-display-mode');
    const displayMode = displayAttr
      ? displayAttr === 'true'
      : element.tagName.toLowerCase() !== 'span';

    try {
      katex.render(latexSource, element, {
        displayMode,
        throwOnError: false,
        strict: 'ignore',
        trust: true,
      });
      element.classList.add(displayMode ? 'latex-block' : 'latex-inline');
    } catch {
      element.classList.add('latex-error-block');
      element.textContent = latexSource;
    }
  });
};

/**
 * Check if a DOM node is a "visual block" (diagram, chart, image, table, etc.)
 * These should always be isolated in their own section so they never get
 * grouped with text into a single break-inside:avoid block.
 */
const isVisualBlock = (node: Node): boolean => {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as HTMLElement;
  const tag = el.tagName;
  if (['IMG', 'SVG', 'CANVAS', 'TABLE', 'FIGURE'].includes(tag)) return true;
  if (el.classList.contains('diagram-container')) return true;
  if (el.hasAttribute('data-mermaid') || el.hasAttribute('data-chartjs') || el.hasAttribute('data-dot')) return true;
  // Check first child too (wrapper divs around diagrams)
  if (el.children.length === 1) return isVisualBlock(el.children[0]);
  return false;
};

const wrapSectionsForPdf = (root: HTMLElement | null) => {
  if (!root) return;
  const contentRoot = root.querySelector('[data-note-body]');
  if (!contentRoot) return;

  const childNodes = Array.from(contentRoot.childNodes);
  if (!childNodes.length) return;

  const createSection = (cls = 'pdf-section') => {
    const section = document.createElement('section');
    section.className = cls;
    return section;
  };

  let currentSection = createSection();
  const sections: HTMLElement[] = [];
  let lastWasHeading = false;

  const flushCurrent = () => {
    if (currentSection.childNodes.length) {
      sections.push(currentSection);
      currentSection = createSection();
    }
  };

  childNodes.forEach((node) => {
    const isElement = node.nodeType === Node.ELEMENT_NODE;
    const isHeading = isElement && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes((node as HTMLElement).tagName);
    const isVisual  = isElement && isVisualBlock(node);

    if (isHeading) {
      // Flush text before the heading, then start a new section with the heading
      flushCurrent();
      currentSection.appendChild(node);
      lastWasHeading = true;
    } else if (isVisual) {
      // If previous node was a heading, keep heading + visual together
      if (lastWasHeading && currentSection.childNodes.length) {
        // The heading is in currentSection, add the visual to it and flush as a visual section
        currentSection.appendChild(node);
        currentSection.classList.add('pdf-visual');
        flushCurrent();
      } else {
        // Flush any text that precedes this visual
        flushCurrent();
        // Put the visual in its own dedicated section
        const visualSection = createSection('pdf-section pdf-visual');
        visualSection.appendChild(node);
        sections.push(visualSection);
      }
      lastWasHeading = false;
    } else {
      // If the heading just started a section, keep at least the first
      // content node together with it (so heading is never orphaned at
      // the bottom of a page).
      currentSection.appendChild(node);

      // After adding one content node after a heading, flush so the
      // section stays compact and measurable.  Subsequent nodes go into
      // their own section which is allowed to break across pages.
      if (lastWasHeading) {
        lastWasHeading = false;
        // Don't flush yet — keep heading + first block together.
        // The next heading or visual will flush this section.
      } else {
        lastWasHeading = false;
      }
    }
  });

  flushCurrent();

  contentRoot.innerHTML = '';
  sections.forEach((section) => contentRoot.appendChild(section));
};

const applyPageBreakGuards = (root: HTMLElement | null) => {
  if (!root) return;
  const sections = Array.from(root.querySelectorAll('.pdf-section')) as HTMLElement[];
  if (!sections.length) return;

  // Minimum space a heading section needs at the bottom of a page.
  // If there's less room than this, push the section to the next page
  // so the heading + first paragraph aren't orphaned / cut.
  const MIN_HEADING_ROOM = 120; // ~3 lines of text below heading

  let usedHeight = 0;

  sections.forEach((section) => {
    section.classList.remove('page-break-before', 'allow-break');
    const rect = section.getBoundingClientRect();
    const height = rect?.height || 0;

    if (!height) return;

    const isVisual = section.classList.contains('pdf-visual');
    const startsWithHeading = section.firstElementChild?.tagName?.match(/^H[1-6]$/);
    const remainingOnPage = PDF_PAGE_HEIGHT_PX - usedHeight;

    // If a single section is taller than one page
    if (height > PDF_PAGE_HEIGHT_PX) {
      if (isVisual) {
        // Scale down oversized visuals to fit one page
        const scale = (PDF_PAGE_HEIGHT_PX - 40) / height;
        section.style.transform = `scale(${scale.toFixed(3)})`;
        section.style.transformOrigin = 'top center';
        section.style.marginBottom = `-${Math.round(height * (1 - scale))}px`;
        if (usedHeight > 0) {
          section.classList.add('page-break-before');
        }
        usedHeight = Math.round(height * scale);
      } else {
        // Long text: allow it to break across pages
        // But if it starts with a heading and there isn't enough room,
        // push to next page first.
        if (startsWithHeading && remainingOnPage < MIN_HEADING_ROOM) {
          section.classList.add('page-break-before');
        }
        section.classList.add('allow-break');
        usedHeight = height % PDF_PAGE_HEIGHT_PX;
      }
      return;
    }

    // Would this section overflow the current page?
    if (usedHeight + height > PDF_PAGE_HEIGHT_PX) {
      section.classList.add('page-break-before');
      usedHeight = height;
    } else if (startsWithHeading && remainingOnPage < MIN_HEADING_ROOM + height) {
      // Heading section technically fits, but would leave the heading
      // near the very bottom of the page — push it to next page.
      if (remainingOnPage < height + 60) {
        section.classList.add('page-break-before');
        usedHeight = height;
      } else {
        usedHeight += height;
      }
    } else {
      usedHeight += height;
    }
  });
};

interface NoteEditorProps {
  note: Note;
  onNoteUpdate: (note: Note) => void;
  userProfile: UserProfile | null;
  onToggleNotesHistory?: () => void;
  isNotesHistoryOpen?: boolean;
  readOnly?: boolean;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  onNoteUpdate,
  userProfile,
  onToggleNotesHistory,
  isNotesHistoryOpen,
  readOnly = false
}) => {

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content); // Markdown
  const [category, setCategory] = useState<NoteCategory>(note.category);
  const [tags, setTags] = useState(note.tags.join(', '));
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [documentIdForDialog, setDocumentIdForDialog] = useState<string | null>(null);
  const [uploadedDocumentPublicUrl, setUploadedDocumentPublicUrl] = useState<string | null>(null);
  const [documentSections, setDocumentSections] = useState<string[]>([]);
// Removed stray comment
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedContent, setExtractedContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);
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
  const [isAudioOptionsVisible, setIsAudioOptionsVisible] = useState(false);
  const [audioProcessingJobId, setAudioProcessingJobId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingAudioNote, setIsGeneratingAudioNote] = useState(false);
  const [isGeneratingAudioSummary, setIsGeneratingAudioSummary] = useState(false);
  const [isTranslatingAudio, setIsTranslatingAudio] = useState(false);


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

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);

    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
    };
  }, [note, currentAudioRef]);

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
    if (readOnly) {
      toast.info('This is a shared course note — you cannot edit it.');
      return;
    }
    // Use the markdown from the ref (which includes diagrams) or fallback to content state
    const markdownToSave = contentAreaRef.current?.getCurrentMarkdown() || content;

    if (!markdownToSave) {
      toast.error("No content to save");
      return;
    }
    
    setIsloading(true);

    const updatedNote: Note = {
      ...note,
      title: title || 'Untitled Note',
      content: markdownToSave,
      category,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
      ai_summary: note.ai_summary
    };

    // console.log('--- UPDATING NOTE IN DATABASE ---', updatedNote.content);

    // Update local state to ensure synchronization
    if (markdownToSave !== content) {
      setContent(markdownToSave);
    }

    setTimeout(() => {
      onNoteUpdate(updatedNote);
      setIsContentModified(false);
      setIsloading(false);
      toast.success("Note saved successfully");
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    }, 1000);
  }, [content, note, title, category, tags, onNoteUpdate]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setIsContentModified(true);
  }, []);

  const handleSummaryChange = useCallback((newSummary: string) => {
    onNoteUpdate({
      ...note,
      ai_summary: newSummary,
      updated_at: new Date().toISOString()
    });
    toast.success("Summary updated");
  }, [note, onNoteUpdate]);

  const handleRegenerateSummary = useCallback(async () => {
    if (!content) {
      toast.error("No content to summarize");
      return;
    }

    setIsGeneratingSummary(true);
    const toastId = toast.loading("Regenerating summary...");

    try {
      const { data, error } = await supabase.functions.invoke('generate-summary', {
        body: {
          content: content,
          title: title,
          category: category
        }
      });

      if (error) throw error;

      if (data?.summary) {
        onNoteUpdate({
          ...note,
          ai_summary: data.summary,
          updated_at: new Date().toISOString()
        });
        toast.success("Summary regenerated successfully", { id: toastId });
      } else {
        throw new Error("No summary returned from AI");
      }
    } catch (error: any) {
      // console.error("Error regenerating summary:", error);
      toast.error(error.message || "Failed to regenerate summary", { id: toastId });
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [content, title, category, note, onNoteUpdate]);

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
      const requestBody: any = {
        documentId: documentIdForGeneration,
        userProfile: user,
        selectedSection: selectedSection,
      };

      // Pass the note ID if we are updating an existing note
      if (targetNote.id && targetNote.id !== 'new') {
        requestBody.noteId = targetNote.id;
      }

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
        // Ensure properties returned from server are respected if available
        ...(aiGeneratedNote.id ? { id: aiGeneratedNote.id } : {})
      };
      
      // If we got a new ID from server (for new notes), ensure we use it
      if (aiGeneratedNote.id && targetNote.id === 'new') {
          updatedNote.id = aiGeneratedNote.id; 
      }
      
      // Update local state immediately
      onNoteUpdate(updatedNote);
      setContent(updatedNote.content);
      
      // We don't need to manually update Supabase again here because the Edge Function 
      // now handles the database UPSERT (Insert or Update).
      // We only need to ensure the local context is refreshed.
      
      toast.success('Note updated from document!', { id: toastId });
      
    } catch (error: any) {
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
    if (isSpeaking && currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsSpeaking(false);
      toast.info("Speech stopped.");
      return;
    }

    // Always pause and clear any previous audio before starting new
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsSpeaking(false);
    }

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
      // Play audio using a persistent ref
      const cleanedAudio = audioContent
        .trim()
        .replace(/^data:audio\/[a-z]+;base64,/, '')
        .replace(/\s/g, '');
      const audio = new Audio(`data:audio/mp3;base64,${cleanedAudio}`);
      currentAudioRef.current = audio;
      audio.onended = () => {
        setIsSpeaking(false);
        currentAudioRef.current = null;
      };
      audio.onerror = (event) => {
        toast.error('Failed to play audio');
        setIsSpeaking(false);
        currentAudioRef.current = null;
      };
      await audio.play();
      setIsSpeaking(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate speech');
      setIsSpeaking(false);
      currentAudioRef.current = null;
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

  const handleDownloadPdf = async () => {
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
      return;
    }

    // ── Build an off-screen but fully-rendered container ──────────────
    // html2canvas needs the element to:
    //  1. Be in the DOM
    //  2. Have full opacity (opacity < 1 makes the canvas content invisible)
    //  3. NOT be visibility:hidden (html2canvas skips hidden elements)
    //  4. NOT be position:fixed (html2canvas has bugs with fixed elements)
    // We use a wrapper with overflow:hidden + height:0 that clips the
    // visual output, and the inner container has normal flow so
    // html2canvas can measure & render it at full fidelity.
    const clipWrapper = document.createElement('div');
    clipWrapper.style.cssText = 'overflow:hidden;height:0;position:relative;';

    const tempContainer = document.createElement('div');
    tempContainer.style.width = `${PDF_CONTAINER_WIDTH_PX}px`;
    tempContainer.style.maxWidth = `${PDF_CONTAINER_WIDTH_PX}px`;
    tempContainer.style.padding = '0';  // html2pdf margins handle spacing
    tempContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    tempContainer.style.fontSize = '12pt';
    tempContainer.style.lineHeight = '1.6';
    tempContainer.style.color = '#000';
    tempContainer.style.backgroundColor = '#fff';
    tempContainer.style.overflowWrap = 'break-word';
    tempContainer.style.wordBreak = 'break-word';
    tempContainer.style.overflow = 'hidden';

    tempContainer.innerHTML = `
    <style>
      * {
        box-sizing: border-box;
        overflow-wrap: break-word;
        word-wrap: break-word;
        word-break: break-word;
      }
      /* Global text containment — nothing should exceed the page width */
      div, p, span, li, td, th, blockquote, pre, code, h1, h2, h3, h4, h5, h6 {
        max-width: 100%;
      }
      h1, h2, h3, h4, h5, h6 {
        color: #000; margin-top: 1em; margin-bottom: 0.5em;
        font-weight: bold;
        page-break-after: avoid; break-after: avoid;
        page-break-inside: avoid; break-inside: avoid;
      }
      /* Clamp heading sizes — prevent enormous user-styled headings */
      h1 { font-size: min(24pt, 6vw); } h2 { font-size: min(20pt, 5vw); } h3 { font-size: min(16pt, 4.5vw); }
      h4 { font-size: 14pt; } h5 { font-size: 12pt; } h6 { font-size: 11pt; }
      p { margin: 0.5em 0; color: #000; orphans: 3; widows: 3; }
      /* Clamp any inline font-size the user may have set */
      [style*="font-size"] { font-size: clamp(8pt, 1em, 24pt) !important; }
      pre {
        background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px;
        padding: 10px; overflow-x: hidden; white-space: pre-wrap;
        font-family: 'Courier New', monospace;
        font-size: 10pt; margin: 1em 0;
        page-break-inside: avoid; break-inside: avoid;
      }
      code {
        background: #f5f5f5; padding: 2px 6px; border-radius: 3px;
        font-family: 'Courier New', monospace; font-size: 10pt;
        white-space: pre-wrap; word-break: break-all;
      }
      table {
        border-collapse: collapse; width: 100%; margin: 1em 0;
        page-break-inside: avoid; break-inside: avoid;
        table-layout: fixed;
      }
      th, td {
        border: 1px solid #ddd; padding: 8px; text-align: left;
        overflow-wrap: break-word; word-break: break-word;
      }
      tr { page-break-inside: avoid; break-inside: avoid; }
      blockquote {
        border-left: 4px solid #ddd; padding-left: 1em; margin: 1em 0;
        color: #666; page-break-inside: avoid; break-inside: avoid;
      }
      img, svg, canvas {
        max-width: 100%; height: auto; margin: 1em 0;
        page-break-inside: avoid; break-inside: avoid;
      }
      .diagram-container {
        page-break-inside: avoid !important; break-inside: avoid !important;
        display: block; width: 100%; max-width: 100%; margin: 1.5em auto;
        overflow: hidden; position: relative;
      }
      .diagram-container svg,
      .diagram-container canvas,
      .diagram-container img {
        display: block; max-width: 100%; height: auto; margin: 0 auto;
      }
      div[data-mermaid], div[data-chartjs], div[data-dot] {
        page-break-inside: avoid; break-inside: avoid;
        max-width: 100%; overflow: hidden; margin: 1em 0;
      }
      .latex-block {
        margin: 1em 0; padding: 0.5em 0.75em;
        background: #f8fafc; border-radius: 4px;
        page-break-inside: avoid; break-inside: avoid;
        overflow-x: auto;
      }
      .latex-inline { padding: 0 0.25em; }
      .latex-error-block { color: #b91c1c; font-family: 'Courier New', monospace; }
      a { color: #0066cc; text-decoration: underline; word-break: break-all; }
      .pdf-section {
        page-break-inside: avoid; break-inside: avoid;
        margin-bottom: 8px;
      }
      .pdf-section.pdf-visual {
        page-break-inside: avoid; break-inside: avoid;
        text-align: center; margin: 0.75em 0;
        overflow: hidden;
      }
      .pdf-section.allow-break { page-break-inside: auto; break-inside: auto; }
      .page-break-before { page-break-before: always; break-before: always; }
      /* Ensure mermaid wrapper divs don't add extra spacing */
      div[data-mermaid] { margin: 0; padding: 0; background: transparent; border: none; box-shadow: none; }
    </style>
    <div style="margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px;">
      <h1 style="font-size: 24pt; font-weight: bold; margin: 0 0 10px 0; color: #000;">
        ${title || 'Untitled Note'}
      </h1>
      ${category !== 'general' ? `<p style="color: #666; font-size: 10pt; margin: 5px 0;">Category: ${category}</p>` : ''}
      ${tags ? `<p style="color: #666; font-size: 10pt; margin: 5px 0;">Tags: ${tags}</p>` : ''}
    </div>
    <div data-note-body style="color: #000;">
      ${htmlContent}
    </div>
    `;

    clipWrapper.appendChild(tempContainer);
    document.body.appendChild(clipWrapper);

    // Render LaTeX nodes
    renderLatexInContainer(tempContainer);

    // Process Chart.js diagrams
    const chartDivs = tempContainer.querySelectorAll('div[data-chartjs]');
    chartDivs.forEach((div) => {
      const configStr = div.getAttribute('data-config');
      if (configStr) {
        try {
          const config = JSON.parse(configStr);
          const canvas = document.createElement('canvas');
          // Fit chart within the content area
          const chartW = Math.min(PDF_CONTAINER_WIDTH_PX - 10, 700);
          canvas.width = chartW;
          canvas.height = Math.round(chartW * 0.56); // ~16:9
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          div.innerHTML = '';
          const wrapper = document.createElement('div');
          wrapper.className = 'diagram-container';
          wrapper.appendChild(canvas);
          div.appendChild(wrapper);
          new Chart(canvas as any, {
            ...config,
            options: { ...config.options, responsive: false, animation: false },
          });
        } catch {
          div.innerHTML = `<pre>Chart Error</pre>`;
        }
      }
    });

    // Process Mermaid diagrams
    const mermaidDivs = tempContainer.querySelectorAll('div[data-mermaid]');
    if (mermaidDivs.length > 0) {
      try {
        mermaid.initialize({
          startOnLoad: false, theme: 'default', securityLevel: 'loose',
          suppressErrorRendering: true, logLevel: 5,
          flowchart: { useMaxWidth: true, htmlLabels: false },
        } as any);
        await Promise.all(
          Array.from(mermaidDivs).map(async (div, index) => {
            const code = div.getAttribute('data-code');
            if (!code) return;
            try {
              const id = `mermaid-pdf-${Date.now()}-${index}`;
              const { svg } = await mermaid.render(id, code);
              div.innerHTML = `<div class="diagram-container">${svg}</div>`;
              const svgEl = div.querySelector('svg');
              if (svgEl) {
                // Constrain SVG to content width and let aspect ratio determine height
                const vb = svgEl.getAttribute('viewBox');
                if (vb) {
                  const parts = vb.split(/[\s,]+/).filter(Boolean).map(parseFloat);
                  if (parts.length === 4) {
                    const [, , w, h] = parts;
                    // Fit within container, leave 10px breathing room
                    const fitW = Math.min(w, PDF_CONTAINER_WIDTH_PX - 10);
                    const ar = h / w;
                    svgEl.setAttribute('width', String(fitW));
                    svgEl.setAttribute('height', String(fitW * ar));
                    svgEl.style.width = `${fitW}px`;
                    svgEl.style.height = `${fitW * ar}px`;
                  }
                }
                svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                svgEl.style.maxWidth = '100%';
                svgEl.style.display = 'block';
                svgEl.style.margin = '0 auto';
              }
            } catch (mermaidErr: any) {
              // Clean up any error nodes mermaid leaked into the document body
              document.querySelectorAll(
                'body > .mermaid, body > [id^="mermaid-"], body > [id^="d"], body > svg[id*="mermaid"], body > .error-icon, body > [aria-roledescription="error"]'
              ).forEach((el) => { try { el.remove(); } catch { /* */ } });

              const errMsg = (mermaidErr?.message || 'Invalid diagram syntax')
                .replace(/</g, '&lt;').replace(/>/g, '&gt;');
              div.innerHTML = `
                <div style="border:1px solid #ef4444;background:rgba(239,68,68,0.08);color:#b91c1c;padding:0.75rem 1rem;border-radius:0.5rem;font-size:0.85rem;font-family:system-ui,sans-serif;word-break:break-word;">
                  <strong>\u26a0\ufe0f Diagram could not be rendered</strong><br/>${errMsg}
                </div>`;
            }
          })
        );
      } catch {
        // mermaid init failed — continue without diagrams
      }
    }

    // Section wrapping for pagination
    wrapSectionsForPdf(tempContainer);

    // Wait two frames so the browser computes layout for getBoundingClientRect
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    applyPageBreakGuards(tempContainer);

    // ── Generate PDF ─────────────────────────────────────────────────
    try {
      await window.html2pdf()
        .from(tempContainer)
        .set({
          margin: [10, 10, 10, 10],
          filename: `${(title || 'untitled-note').replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            logging: false,
            dpi: 192,
            letterRendering: true,
            backgroundColor: '#ffffff',
            useCORS: true,
          },
          jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
            compress: true,
          },
          pagebreak: {
            mode: ['css', 'legacy'],
            before: '.page-break-before',
            after: '.page-break-after',
            avoid: [
              '.pdf-visual', '.diagram-container', 'pre', 'code',
              'table', 'tr', 'img', 'svg', 'canvas',
              'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
              '.latex-block',
            ],
          },
        })
        .save();

      toast.success('Note downloaded as PDF!', { id: 'pdf-download' });
    } catch {
      toast.error('Failed to generate PDF.', { id: 'pdf-download' });
    } finally {
      if (document.body.contains(clipWrapper)) {
        document.body.removeChild(clipWrapper);
      }
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
        // console.warn('Failed to create class recording entry:', recordingError);
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

  // The component must return JSX here!
  return (
    <div className="flex bg-white flex-col h-full w-full dark:bg-gray-950">
      {/* Read-only banner for shared course notes */}
      {readOnly && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
          <Eye className="w-4 h-4 flex-shrink-0" />
          <span>This is a shared course note — view only</span>
        </div>
      )}

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
              readOnly={readOnly}
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
          {isSummaryVisible && (
            <AISummarySection
              ai_summary={note.ai_summary}
              isSummaryVisible={isSummaryVisible}
              setIsSummaryVisible={setIsSummaryVisible}
              onSummaryChange={readOnly ? undefined : handleSummaryChange}
              onRegenerateSummary={readOnly ? undefined : handleRegenerateSummary}
              isGenerating={isGeneratingSummary}
            />
          )}

          {/* Floating Action Buttons */}
          {!isSummaryVisible && (
            <div className="fixed bottom-16 right-2 lg:bottom-4 lg:right-4 flex flex-col gap-3 z-50">
              {/* Tips Button */}
              {(window as any).__toggleTips && (
                <button
                  onClick={() => (window as any).__toggleTips?.()}
                  className="h-11 w-11 rounded-full shadow-lg text-blue-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300 transition-all duration-300 hover:scale-110 cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 backdrop-blur-sm flex items-center justify-center"
                  style={{
                    filter: 'drop-shadow(0 0 8px rgba(36, 190, 251, 0.6))',
                    animation: 'glow 2s ease-in-out infinite'
                  }}
                  title="Quick Tips"
                >
                  <Lightbulb className="w-6 h-6 fill-current" />
                </button>
              )}
              
              {/* AI Summary Button */}
              <Button
                onClick={() => setIsSummaryVisible(true)}
                size="icon"
                className="h-11 w-11 rounded-full shadow-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:shadow-xl transition-all duration-300 border border-slate-100 dark:border-slate-800 backdrop-blur-sm"
                title="Show AI Summary"
              >
                <Sparkles className="h-5 w-5 text-blue-600" />
              </Button>
            </div>
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
};

