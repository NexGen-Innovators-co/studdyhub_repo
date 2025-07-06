
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Hash, Save, Brain, RefreshCw, UploadCloud, Volume2, StopCircle } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Note, NoteCategory, UserProfile } from '../types'; // Assuming central index.ts
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface NoteEditorProps {
  note: Note;
  onNoteUpdate: (note: Note) => void;
  // The user profile is needed for the new AI function
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category);
    setTags(note.tags.join(', '));

    // When note changes, stop any active speech from the previous note.
    if ('speechSynthesis' in window && speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    setIsSpeaking(false);

    // Cleanup function for when the component unmounts
    return () => {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    };
  }, [note]);

  // Load available text-to-speech voices from the browser
  useEffect(() => {
    const populateVoiceList = () => {
      if (typeof speechSynthesis === 'undefined') {
        return;
      }
      const availableVoices = speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        // Set a default voice only if one isn't already selected.
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
  }, []); // Run only once on mount

  const handleSave = () => {
    const updatedNote: Note = {
      ...note,
      title: title || 'Untitled Note',
      content,
      category,
      tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag !== ''),
      // Align with database schema (snake_case and string format)
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

      // The parent component will receive the completely new note object
      // and should handle swapping it in the UI.
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

    // Validate file type before proceeding
    const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/msword'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported file type. Please upload a PDF ,TXT file or a Word document.');
      if (event.target) event.target.value = ''; // Reset file input to allow re-selection
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Uploading document...');

    try {
      // Step 1: Upload file to Supabase Storage
      const filePath = `${userProfile.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents') // Assumes a bucket named 'documents'
        .upload(filePath, file);
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
      
      toast.loading('Extracting text from document...', { id: toastId });

      // Step 2: Get the public URL for the uploaded file to pass to our function.
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        console.error('Failed to get public URL for uploaded file:', urlData);
        throw new Error("Could not get public URL for the uploaded file.");
      }

      // Step 3: Call your 'gemini-document-extractor' Edge Function to get the content.
      const { data: extractionData, error: extractionError } = await supabase.functions.invoke('gemini-document-extractor', {
        body: {
          file_url: urlData.publicUrl,
          file_type: file.type
        }
      });

      if (extractionError) throw extractionError;
      const extractedContent = extractionData.content_extracted;

      // Step 4: Create a document record in the database with the extracted content.
      const { data: newDocument, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: userProfile.id,
          title: file.name,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          content_extracted: extractedContent, // Storing the content from our function
        })
        .select('id')
        .single();
 
      if (docError || !newDocument) throw new Error(docError?.message || 'Failed to create document record.');
 
      toast.loading('Generating AI note...', { id: toastId });

      // Step 5: Call the function to generate the note from the new document
      const { data: newNote, error: generationError } = await supabase.functions.invoke('generate-note-from-document', {
        body: { documentId: newDocument.id, userProfile },
      });
 
      if (generationError) throw new Error(generationError.message || 'Failed to generate note.');

      // Step 6: Update the parent component with the new note
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
      console.error('Error during upload and generate process:', error);
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = ''; // Allow re-uploading the same file
    }
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

    // Simple markdown cleanup for better reading flow
    const textToRead = content
      .replace(/#+\s/g, '') // Remove markdown headers
      .replace(/(\*|_|`|~|>)/g, '') // Remove other markdown characters
      .replace(/(\r\n|\n|\r)/gm, " "); // Replace newlines with spaces

    const utterance = new SpeechSynthesisUtterance(textToRead);
    
    // Find and set the selected voice
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
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept=".pdf,.txt" />
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
              {voices.map((voice) => (
                <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
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
      <div className="flex-1 p-6">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing your note here..."
          className="h-full resize-none border-none shadow-none focus-visible:ring-0 text-base leading-relaxed bg-transparent"
        />
      </div>

      {/* AI Summary Section */}
      {note.aiSummary && (
        <div className="p-6 border-t border-slate-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <h4 className="font-medium text-purple-800">AI Summary</h4>
          </div>
          <p className="text-sm text-purple-700 leading-relaxed">{note.aiSummary}</p>
        </div>
      )}
    </div>
  );
};
