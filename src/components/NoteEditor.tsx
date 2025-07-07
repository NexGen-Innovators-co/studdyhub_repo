import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Hash, Save, Brain, RefreshCw, UploadCloud, Volume2, StopCircle } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Note, NoteCategory, UserProfile } from '../types'; // Assuming central index.ts
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import Mermaid from './Mermaid'; // Import the Mermaid component
import { SectionSelectionDialog } from './SectionSelectionDialog'; // Import the new dialog

interface NoteEditorProps {
  note: Note;
  onNoteUpdate: (note: Note) => void;
  userProfile: UserProfile | null;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ note, onNoteUpdate, userProfile }) => {
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

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category);
    setTags(note.tags.join(', '));

    if ('speechSynthesis' in window && speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    setIsSpeaking(false);

    return () => {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
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
    setSelectedFile(file); // Store the file for later use
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
      setExtractedContent(extractedContent); // Store extracted content

      // Analyze document structure
      toast.loading('Analyzing document structure...', { id: toastId });
      const { data: structureData, error: structureError } = await supabase.functions.invoke('analyze-document-structure', {
        body: { documentContent: extractedContent }
      });

      if (structureError) throw structureError;

      if (structureData && structureData.sections && structureData.sections.length > 0) {
        setDocumentSections(structureData.sections);
        setIsSectionDialogOpen(true); // Open dialog for section selection
        toast.dismiss(toastId); // Dismiss loading toast
      } else {
        // No sections found, proceed with full document note generation
        await generateNoteFromExtractedContent(extractedContent, file.name, urlData.publicUrl, file.type, toastId.toString());
      }

    } catch (error) {
      let errorMessage = 'An unknown error occurred.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `Function error (${error.context.status}): ${error.context.statusText}. Check function logs.`;
        console.error('Function HTTP Error Details:', error.context);
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
    if (!userProfile || !selectedFile) {
      toast.error("User profile or selected file is missing.");
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
          file_type: fileType,
          content_extracted: contentToUse,
        })
        .select('id')
        .single();

      if (docError || !newDocument) throw new Error(docError?.message || 'Failed to create document record.');

      const { data: newNote, error: generationError } = await supabase.functions.invoke('generate-note-from-document', {
        body: {
          documentId: newDocument.id,
          userProfile,
          selectedSection, // Pass the selected section to the AI function
        },
      });

      if (generationError) throw new Error(generationError.message || 'Failed to generate note.');

      onNoteUpdate(newNote);
      toast.success('New note generated from document!', { id: toastId });

    } catch (error) {
      let errorMessage = 'An unknown error occurred.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `Function error (${error.context.status}): ${error.context.statusText}. Check function logs.`;
        console.error('Function HTTP Error Details:', error.context);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: toastId });
      console.error('Error during note generation:', error);
    } finally {
      setIsGeneratingAI(false);
      setIsSectionDialogOpen(false); // Close dialog
      setDocumentSections([]); // Clear sections
      setSelectedFile(null); // Clear selected file
      setExtractedContent(null); // Clear extracted content
    }
  };

  const handleSectionSelect = async (section: string | null) => {
    if (!selectedFile || !extractedContent || !userProfile) {
      toast.error("Missing file or extracted content to generate note.");
      return; // Early exit if prerequisites are not met
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
      .replace(/```mermaid[\s\S]*?```/g, '(A diagram is present here.)') // Replace mermaid blocks
      .replace(/###\s?.*?\s/g, '') // Remove headings like ### 1. Summary
      .replace(/\*\*|\*|_|`|~/g, '') // Remove bold, italic, code, strikethrough markers
      .replace(/(\r\n|\n|\r)/gm, " "); // Normalize line breaks

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

  // Custom renderer for code blocks to handle Mermaid diagrams
  const CodeRenderer = ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const lang = match && match[1];

    if (lang === 'mermaid' && !inline) {
      const chart = String(children).replace(/\n$/, '');
      return <Mermaid chart={chart} />;
    }

    // Handle other languages or inline code
    if (!inline) {
      return (
        <pre className="bg-slate-100 p-3 rounded-md my-2 overflow-x-auto">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      );
    }

    return (
      <code className="bg-slate-100 text-purple-600 px-1 py-0.5 rounded" {...props}>
        {children}
      </code>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Editor Header */}
      <div className="p-6 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="text-2xl font-bold border-none p-0 shadow-none focus-visible:ring-0 bg-transparent"
          />
          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept=".pdf,.txt,.doc,.docx" />
            <Button
              variant="outline"
              size="sm"
              onClick={triggerFileUpload}
              disabled={isUploading || isGeneratingAI || !userProfile}
            >
              {isUploading ? (
                <Brain className="h-4 w-4 mr-2 animate-pulse" />
              ) : (
                <UploadCloud className="h-4 w-4 mr-2" />
              )}
              {isUploading ? 'Processing...' : 'Upload & Generate'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={regenerateNoteFromDocument}
              disabled={isUploading || isGeneratingAI || !note.document_id}
              className="text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              {isGeneratingAI ? (
                <Brain className="h-4 w-4 mr-2 animate-pulse" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isGeneratingAI ? 'Generating...' : 'Regenerate Note'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTextToSpeech}
              disabled={isUploading || isGeneratingAI}
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
              {isEditing ? 'Preview' : 'Edit'}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
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
            <SelectTrigger className="w-[240px]">
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

          <div className="flex items-center gap-2 flex-1">
            <Hash className="h-4 w-4 text-slate-400" />
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Add tags (comma separated)..."
              className="border-none shadow-none focus-visible:ring-0 bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 p-6 flex flex-col overflow-y-auto">
        {isEditing ? (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start writing your note here..."
            className="flex-1 resize-none border-none shadow-none focus-visible:ring-0 text-base leading-relaxed bg-transparent min-h-0"
          />
        ) : (
          <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed flex-1 overflow-y-auto min-h-0">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: CodeRenderer,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* AI Summary Section */}
      {note.aiSummary && (
        <div className="p-6 border-t border-slate-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <h4 className="font-medium text-purple-800">AI Summary</h4>
          </div>
          <div className="prose prose-sm max-w-none text-purple-700 leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: CodeRenderer,
              }}
            >
              {note.aiSummary}
            </ReactMarkdown>
          </div>
        </div>
      )}

      <SectionSelectionDialog
        isOpen={isSectionDialogOpen}
        sections={documentSections}
        onSectionSelect={handleSectionSelect}
        onCancel={() => {
          setIsSectionDialogOpen(false);
          setIsUploading(false); // Allow re-upload if cancelled
          setSelectedFile(null);
          setExtractedContent(null);
        }}
      />
    </div>
  );
};
