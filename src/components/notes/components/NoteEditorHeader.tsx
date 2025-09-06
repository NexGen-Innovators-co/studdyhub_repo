// components/NoteEditorHeader.tsx
import React from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { NoteCategory, UserProfile } from '../../../types';
import { Sparkles, Hash, Save, Brain, RefreshCw, UploadCloud, Volume2, StopCircle, Menu, FileText, ChevronDown, ChevronUp, Download, Copy, FileDown, Mic, Play, Pause, XCircle, Check, AlertTriangle, Loader2, TypeOutline, Edit3, Eye } from 'lucide-react';

interface NoteEditorHeaderProps {
  title: string;
  setTitle: (title: string) => void;
  category: NoteCategory;
  setCategory: (category: NoteCategory) => void;
  tags: string;
  setTags: (tags: string) => void;
  isUploading: boolean;
  isGeneratingAI: boolean;
  isProcessingAudio: boolean;
  userProfile: UserProfile | null;
  regenerateNoteFromDocument: () => void;
  handleViewOriginalDocument: () => void;
  handleDownloadNote: () => void;
  handleDownloadPdf: () => void;
  handleCopyNoteContent: () => void;
  handleTextToSpeech: () => void;
  isSpeaking: boolean;
  handleSave: () => void;
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  selectedVoiceURI: string | null;
  setSelectedVoiceURI: (uri: string) => void;
  voices: SpeechSynthesisVoice[];
  documentId: string | null;
  onToggleNotesHistory?: () => void;
  isNotesHistoryOpen?: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  audioInputRef: React.RefObject<HTMLInputElement>;
  handleAudioFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const NoteEditorHeader: React.FC<NoteEditorHeaderProps> = ({
  title,
  setTitle,
  category,
  setCategory,
  tags,
  setTags,
  isUploading,
  isGeneratingAI,
  isProcessingAudio,
  userProfile,
  regenerateNoteFromDocument,
  handleViewOriginalDocument,
  handleDownloadNote,
  handleDownloadPdf,
  handleCopyNoteContent,
  handleTextToSpeech,
  isSpeaking,
  handleSave,
  isEditing,
  setIsEditing,
  selectedVoiceURI,
  setSelectedVoiceURI,
  voices,
  documentId,
  onToggleNotesHistory,
  isNotesHistoryOpen,
  fileInputRef,
  handleFileSelect,
  audioInputRef,
  handleAudioFileSelect,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="p-3 sm:p-4 border-b border-slate-200 dark:bg-gray-900 dark:border-gray-800">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        {onToggleNotesHistory && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleNotesHistory}
            className="lg:hidden h-8 w-8 p-0 mr-2 text-slate-600 hover:bg-slate-50 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {isNotesHistoryOpen ? <FileText className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        )}
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="text-2xl font-bold border-none p-0 shadow-none focus-visible:ring-0 bg-transparent flex-1 min-w-0 text-slate-800 dark:text-gray-100"
        />
        <div className="hidden lg:flex items-center gap-2 flex-wrap justify-end">
          <label
            htmlFor="document-upload-input"
            className={`
              inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-3
              border border-input bg-background hover:bg-accent hover:text-accent-foreground
              text-slate-600 border-slate-200 hover:bg-slate-50
              dark:text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-100
              ${(isUploading || isGeneratingAI || isProcessingAudio || !userProfile) ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {isUploading ? (
              <Brain className="h-4 w-4 mr-2 animate-pulse" />
            ) : (
              <UploadCloud className="h-4 w-4 mr-2" />
            )}
            {isUploading ? 'Processing...' : 'Upload Doc & Generate'}
          </label>
          <input type="file" id="document-upload-input" ref={fileInputRef} onChange={handleFileSelect} style={{ position: 'absolute', left: '-9999px' }} accept=".pdf,.txt,.doc,.docx,audio/*" />

          <label
            htmlFor="audio-upload-input"
            className={`
              inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-3
              border border-input bg-background hover:bg-accent hover:text-accent-foreground
              text-slate-600 border-slate-200 hover:bg-slate-50
              dark:text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-100
              ${(isProcessingAudio || isUploading || isGeneratingAI || !userProfile) ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {isProcessingAudio ? (
              <Brain className="h-4 w-4 mr-2 animate-pulse" />
            ) : (
              <Mic className="h-4 w-4 mr-2" />
            )}
            {isProcessingAudio ? 'Uploading Audio...' : 'Upload Audio'}
          </label>
          <input type="file" id="audio-upload-input" ref={audioInputRef} onChange={handleAudioFileSelect} style={{ position: 'absolute', left: '-9999px' }} accept="audio/*" />

          <Button
            variant="outline"
            size="sm"
            onClick={regenerateNoteFromDocument}
            disabled={isUploading || isGeneratingAI || isProcessingAudio || !documentId}
            className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-100"
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
            onClick={handleViewOriginalDocument}
            disabled={!documentId || isProcessingAudio}
            className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-100"
          >
            {isProcessingAudio ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            View Original Document
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleTextToSpeech}
            disabled={isUploading || isGeneratingAI || isProcessingAudio}
            className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-100"
          >
            {isSpeaking ? (
              <StopCircle className="h-4 w-4 mr-2 animate-pulse text-red-500" />
            ) : (
              <Volume2 className="h-4 w-4 mr-2" />
            )}
            {isSpeaking ? 'Stop' : 'Read Aloud'}
          </Button>

          {/* Enhanced Edit/Preview Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-100"
          >
            {isEditing ? (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Preview Mode
              </>
            ) : (
              <>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Mode
              </>
            )}
          </Button>

          <Button onClick={handleSave} size="sm" className="bg-blue-500 text-white shadow-md hover:bg-blue-600">
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>

        <div className="relative lg:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-100"
          >
            <Menu className="h-4 w-4" />
            <span className="ml-2">More</span>
          </Button>
          {isMobileMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-md shadow-lg z-10 flex flex-col py-2 dark:bg-gray-800 dark:border-gray-700">
              <label
                htmlFor="document-upload-input-mobile"
                className={`
                  inline-flex items-center justify-start whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2
                  text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-700
                  ${(isUploading || isGeneratingAI || isProcessingAudio || !userProfile) ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {isUploading ? (
                  <Brain className="h-4 w-4 mr-2 animate-pulse" />
                ) : (
                  <UploadCloud className="h-4 w-4 mr-2" />
                )}
                {isUploading ? 'Processing...' : 'Upload Doc & Generate'}
              </label>
              <input type="file" id="document-upload-input-mobile" ref={fileInputRef} onChange={handleFileSelect} style={{ position: 'absolute', left: '-9999px' }} accept=".pdf,.txt,.doc,.docx,audio/*" />

              <label
                htmlFor="audio-upload-input-mobile"
                className={`
                  inline-flex items-center justify-start whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2
                  text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-700
                  ${(isProcessingAudio || isUploading || isGeneratingAI || !userProfile) ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {isProcessingAudio ? (
                  <Brain className="h-4 w-4 mr-2 animate-pulse" />
                ) : (
                  <Mic className="h-4 w-4 mr-2" />
                )}
                {isProcessingAudio ? 'Uploading Audio...' : 'Upload Audio'}
              </label>
              <input type="file" id="audio-upload-input-mobile" ref={audioInputRef} onChange={handleAudioFileSelect} style={{ position: 'absolute', left: '-9999px' }} accept="audio/*" />

              <Button
                variant="ghost"
                className="justify-start px-4 py-2 text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => { regenerateNoteFromDocument(); handleMobileMenuClose(); }}
                disabled={isUploading || isGeneratingAI || isProcessingAudio || !documentId}
              >
                {isGeneratingAI ? (
                  <Brain className="h-4 w-4 mr-2 animate-pulse" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {isGeneratingAI ? 'Generating...' : 'Regenerate Note'}
              </Button>
              <Button
                variant="ghost"
                className="justify-start px-4 py-2 text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => { handleViewOriginalDocument(); handleMobileMenuClose(); }}
                disabled={!documentId || isProcessingAudio}
              >
                {isProcessingAudio ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                View Original Document
              </Button>
              <Button
                variant="ghost"
                className="justify-start px-4 py-2 text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => { handleDownloadNote(); handleMobileMenuClose(); }}
                disabled={!title.trim()}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Markdown
              </Button>
              <Button
                variant="ghost"
                className="justify-start px-4 py-2 text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => { handleDownloadPdf(); handleMobileMenuClose(); }}
                disabled={!title.trim()}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button
                variant="ghost"
                className="justify-start px-4 py-2 text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => { handleCopyNoteContent(); handleMobileMenuClose(); }}
                disabled={!title.trim()}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Content
              </Button>
              <Button
                variant="ghost"
                className="justify-start px-4 py-2 text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => { handleTextToSpeech(); handleMobileMenuClose(); }}
                disabled={isUploading || isGeneratingAI || isProcessingAudio}
              >
                {isSpeaking ? (
                  <StopCircle className="h-4 w-4 mr-2 animate-pulse text-red-500" />
                ) : (
                  <Volume2 className="h-4 w-4 mr-2" />
                )}
                {isSpeaking ? 'Stop' : 'Read Aloud'}
              </Button>

              {/* Enhanced Mobile Edit/Preview Toggle */}
              <Button
                variant="ghost"
                className="justify-start px-4 py-2 text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => { setIsEditing(!isEditing); handleMobileMenuClose(); }}
              >
                {isEditing ? (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview Mode
                  </>
                ) : (
                  <>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit Mode
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                className="justify-start px-4 py-2 bg-blue-500 text-white shadow-md hover:bg-blue-600"
                onClick={() => { handleSave(); handleMobileMenuClose(); }}
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>

              <div className="border-t border-slate-200 my-2 mx-4 dark:border-gray-700" />
              <p className="text-sm font-semibold text-slate-600 px-4 mb-2 dark:text-gray-300">Note Settings</p>

              <div className="px-4 py-2">
                <Select value={category} onValueChange={(value: NoteCategory) => setCategory(value)}>
                  <SelectTrigger className="w-full dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectItem value="general" className="dark:text-gray-100 dark:hover:bg-gray-600">General</SelectItem>
                    <SelectItem value="math" className="dark:text-gray-100 dark:hover:bg-gray-600">Mathematics</SelectItem>
                    <SelectItem value="science" className="dark:text-gray-100 dark:hover:bg-gray-600">Science</SelectItem>
                    <SelectItem value="history" className="dark:text-gray-100 dark:hover:bg-gray-600">History</SelectItem>
                    <SelectItem value="language" className="dark:text-gray-100 dark:hover:bg-gray-600">Languages</SelectItem>
                    <SelectItem value="other" className="dark:text-gray-100 dark:hover:bg-gray-600">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="px-4 py-2">
                <Select
                  value={selectedVoiceURI || ''}
                  onValueChange={(value) => setSelectedVoiceURI(value)}
                  disabled={isSpeaking || voices.length === 0}
                >
                  <SelectTrigger className="w-full dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                    {voices.map((voice, index) => (
                      <SelectItem key={`${voice.voiceURI}-${index.toString()}`} value={voice.voiceURI} className="dark:text-gray-100 dark:hover:bg-gray-600">
                        {`${voice.name} (${voice.lang})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 px-4 py-2">
                <Hash className="h-4 w-4 text-slate-400 dark:text-gray-500" />
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Add tags (comma separated)..."
                  className="border-none shadow-none focus-visible:ring-0 bg-transparent flex-1 text-slate-700 dark:text-gray-200"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-4 flex-wrap">
        <Select value={category} onValueChange={(value: NoteCategory) => setCategory(value)}>
          <SelectTrigger className="w-40 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
            <SelectItem value="general" className="dark:text-gray-100 dark:hover:bg-gray-700">General</SelectItem>
            <SelectItem value="math" className="dark:text-gray-100 dark:hover:bg-gray-700">Mathematics</SelectItem>
            <SelectItem value="science" className="dark:text-gray-100 dark:hover:bg-gray-700">Science</SelectItem>
            <SelectItem value="history" className="dark:text-gray-100 dark:hover:bg-gray-700">History</SelectItem>
            <SelectItem value="language" className="dark:text-gray-100 dark:hover:bg-gray-700">Languages</SelectItem>
            <SelectItem value="other" className="dark:text-gray-100 dark:hover:bg-gray-700">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={selectedVoiceURI || ''}
          onValueChange={(value) => setSelectedVoiceURI(value)}
          disabled={isSpeaking || voices.length === 0}
        >
          <SelectTrigger className="w-full sm:w-[240px] dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
            <SelectValue placeholder="Select a voice" />
          </SelectTrigger>
          <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
            {voices.map((voice, index) => (
              <SelectItem key={`${voice.voiceURI}-${index.toString()}`} value={voice.voiceURI} className="dark:text-gray-100 dark:hover:bg-gray-700">
                {`${voice.name} (${voice.lang})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Hash className="h-4 w-4 text-slate-400 dark:text-gray-500" />
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Add tags (comma separated)..."
            className="border-none shadow-none focus-visible:ring-0 bg-transparent flex-1 text-slate-700 dark:text-gray-200"
          />
        </div>
      </div>
    </div>
  );
};