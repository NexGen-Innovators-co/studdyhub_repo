// components/NoteEditorHeader.tsx - MODERN UI DESIGN
import React from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import { NoteCategory, UserProfile } from '../../../types';
import {
  Sparkles, Hash, Save, Brain, RefreshCw, UploadCloud, Volume2, StopCircle,
  Menu, FileText, ChevronDown, ChevronUp, Download, Copy, FileDown, Mic,
  NotebookText, MoreVertical, Settings, FileCode, FileType, FileArchive
} from 'lucide-react';

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
  handleDownloadHTML: () => void;
  handleDownloadTXT: () => void;
  handleDownloadWord: () => void;
  handleCopyNoteContent: () => void;
  handleTextToSpeech: () => void;
  isSpeaking: boolean;
  handleSave: () => void;
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
  handleDownloadHTML,
  handleDownloadTXT,
  handleDownloadWord,
  handleCopyNoteContent,
  handleTextToSpeech,
  isSpeaking,
  handleSave,
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
  const [isDesktopHeaderExpanded, setIsDesktopHeaderExpanded] = React.useState(false);

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="p-12 sm:p-6 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm dark:bg-gray-900/80 dark:border-gray-700/60">
      {/* Main Header Row */}
      <div className="flex items-center justify-between mb-4">
        {/* Left: Title and Basic Controls */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {onToggleNotesHistory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleNotesHistory}
              className="lg:hidden h-9 w-9 p-0 text-slate-600 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"
              title="Toggle Notes History"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          <div className="flex-1 min-w-0">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Note"
              className="text-2xl font-bold border-none p-0 shadow-none focus-visible:ring-0 bg-transparent w-full text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-gray-400"
            />
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Save Button - Always Visible */}
          <Button
            onClick={handleSave}
            size="sm"
            className="bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Save className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Save</span>
          </Button>

          {/* Desktop Header Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDesktopHeaderExpanded(!isDesktopHeaderExpanded)}
            className="hidden lg:flex items-center h-9 px-3 text-slate-600 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Settings className="h-4 w-4 mr-2" />
            {isDesktopHeaderExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {/* Mobile Menu Trigger */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden h-9 w-9 p-0 text-slate-600 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Expanded Desktop Controls */}
      {isDesktopHeaderExpanded && (
        <div className="hidden pb-4 lg:flex space-y-4">
          {/* First Row: Import & Generate Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Import:</span>

              {/* Document Upload */}
              <label
                htmlFor="document-upload-input"
                className={`
                  inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors
                  h-9 px-3 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300
                  dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700
                  ${(isUploading || isGeneratingAI || isProcessingAudio || !userProfile) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {isUploading ? (
                  <Brain className="h-4 w-4 mr-2 animate-pulse" />
                ) : (
                  <UploadCloud className="h-4 w-4 mr-2" />
                )}
                <span>Document</span>
              </label>
              <input type="file" id="document-upload-input" ref={fileInputRef} onChange={handleFileSelect} style={{ position: 'absolute', left: '-9999px' }} accept=".pdf,.txt,.doc,.docx" />

              {/* Audio Upload */}
              <label
                htmlFor="audio-upload-input"
                className={`
                  inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors
                  h-9 px-3 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300
                  dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700
                  ${(isProcessingAudio || isUploading || isGeneratingAI || !userProfile) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {isProcessingAudio ? (
                  <Brain className="h-4 w-4 mr-2 animate-pulse" />
                ) : (
                  <Mic className="h-4 w-4 mr-2" />
                )}
                <span>Audio</span>
              </label>
              <input type="file" id="audio-upload-input" ref={audioInputRef} onChange={handleAudioFileSelect} style={{ position: 'absolute', left: '-9999px' }} accept="audio/*" />
            </div>

            <div className="h-4 w-px bg-slate-300 dark:bg-gray-600" />

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Actions:</span>

              {/* Regenerate Note */}
              <Button
                variant="outline"
                size="sm"
                onClick={regenerateNoteFromDocument}
                disabled={isUploading || isGeneratingAI || isProcessingAudio || !documentId}
                className="h-9"
              >
                {isGeneratingAI ? (
                  <Brain className="h-4 w-4 mr-2 animate-pulse" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Regenerate
              </Button>

              {/* View Original */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewOriginalDocument}
                disabled={!documentId || isProcessingAudio}
                className="h-9"
              >
                <FileText className="h-4 w-4 mr-2" />
                View Original
              </Button>

              {/* Text to Speech */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleTextToSpeech}
                disabled={isUploading || isGeneratingAI || isProcessingAudio}
                className={`h-9 ${isSpeaking ? 'text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20' : ''}`}
              >
                {isSpeaking ? (
                  <StopCircle className="h-4 w-4 mr-2 animate-pulse" />
                ) : (
                  <Volume2 className="h-4 w-4 mr-2" />
                )}
                {isSpeaking ? 'Stop' : 'Read'}
              </Button>
            </div>
          </div>

          {/* Second Row: Metadata & Export */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Category Select */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Category:</span>
              <Select value={category} onValueChange={(value: NoteCategory) => setCategory(value)}>
                <SelectTrigger className="w-32 h-8 dark:bg-gray-800 dark:border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-600">
                  <SelectItem value="general" className="dark:text-gray-100">General</SelectItem>
                  <SelectItem value="math" className="dark:text-gray-100">Mathematics</SelectItem>
                  <SelectItem value="science" className="dark:text-gray-100">Science</SelectItem>
                  <SelectItem value="history" className="dark:text-gray-100">History</SelectItem>
                  <SelectItem value="language" className="dark:text-gray-100">Languages</SelectItem>
                  <SelectItem value="other" className="dark:text-gray-100">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Voice Select */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Voice:</span>
              <Select
                value={selectedVoiceURI || ''}
                onValueChange={(value) => setSelectedVoiceURI(value)}
                disabled={isSpeaking || voices.length === 0}
              >
                <SelectTrigger className="w-48 h-8 dark:bg-gray-800 dark:border-gray-600">
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-600">
                  {voices.map((voice, index) => (
                    <SelectItem key={`${voice.voiceURI}-${index}`} value={voice.voiceURI} className="dark:text-gray-100">
                      {`${voice.name} (${voice.lang})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags Input */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Tags:</span>
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Hash className="h-4 w-4 text-slate-400 dark:text-gray-500" />
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Add tags (comma separated)..."
                  className="h-8 border-slate-200 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleDownloadNote} className="flex items-center gap-2">
                  <NotebookText className="h-4 w-4" />
                  Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadPdf} className="flex items-center gap-2">
                  <FileArchive className="h-4 w-4" />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadHTML} className="flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  HTML
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadTXT} className="flex items-center gap-2">
                  <FileType className="h-4 w-4" />
                  Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadWord} className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Word
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyNoteContent} className="flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Copy Content
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border border-slate-200 rounded-lg shadow-lg p-4 space-y-4 dark:bg-gray-800 dark:border-gray-700">
          {/* Import Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300">Import Content</h3>
            <div className="grid grid-cols-2 gap-2">
              <label
                htmlFor="document-upload-input-mobile"
                className={`
                  flex items-center justify-center p-3 border-2 border-dashed border-slate-200 rounded-lg text-sm font-medium transition-colors
                  dark:border-gray-600 dark:text-gray-300
                  ${(isUploading || isGeneratingAI || isProcessingAudio || !userProfile) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-slate-300 dark:hover:border-gray-500'}
                `}
              >
                {isUploading ? (
                  <Brain className="h-4 w-4 mr-2 animate-pulse" />
                ) : (
                  <UploadCloud className="h-4 w-4 mr-2" />
                )}
                Document
              </label>
              <input type="file" id="document-upload-input-mobile" ref={fileInputRef} onChange={handleFileSelect} style={{ position: 'absolute', left: '-9999px' }} accept=".pdf,.txt,.doc,.docx" />

              <label
                htmlFor="audio-upload-input-mobile"
                className={`
                  flex items-center justify-center p-3 border-2 border-dashed border-slate-200 rounded-lg text-sm font-medium transition-colors
                  dark:border-gray-600 dark:text-gray-300
                  ${(isProcessingAudio || isUploading || isGeneratingAI || !userProfile) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-slate-300 dark:hover:border-gray-500'}
                `}
              >
                {isProcessingAudio ? (
                  <Brain className="h-4 w-4 mr-2 animate-pulse" />
                ) : (
                  <Mic className="h-4 w-4 mr-2" />
                )}
                Audio
              </label>
              <input type="file" id="audio-upload-input-mobile" ref={audioInputRef} onChange={handleAudioFileSelect} style={{ position: 'absolute', left: '-9999px' }} accept="audio/*" />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => { regenerateNoteFromDocument(); handleMobileMenuClose(); }}
                disabled={isUploading || isGeneratingAI || isProcessingAudio || !documentId}
                className="justify-center py-2"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
              <Button
                variant="outline"
                onClick={() => { handleTextToSpeech(); handleMobileMenuClose(); }}
                disabled={isUploading || isGeneratingAI || isProcessingAudio}
                className="justify-center py-2"
              >
                <Volume2 className="h-4 w-4 mr-2" />
                Read Aloud
              </Button>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300">Note Settings</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-600 dark:text-gray-400">Category</label>
                <Select value={category} onValueChange={(value: NoteCategory) => setCategory(value)}>
                  <SelectTrigger className="w-full h-8 text-xs dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectItem value="general" className="text-xs dark:text-gray-100">General</SelectItem>
                    <SelectItem value="math" className="text-xs dark:text-gray-100">Math</SelectItem>
                    <SelectItem value="science" className="text-xs dark:text-gray-100">Science</SelectItem>
                    <SelectItem value="history" className="text-xs dark:text-gray-100">History</SelectItem>
                    <SelectItem value="language" className="text-xs dark:text-gray-100">Languages</SelectItem>
                    <SelectItem value="other" className="text-xs dark:text-gray-100">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-600 dark:text-gray-400">Voice</label>
                <Select
                  value={selectedVoiceURI || ''}
                  onValueChange={(value) => setSelectedVoiceURI(value)}
                  disabled={isSpeaking || voices.length === 0}
                >
                  <SelectTrigger className="w-full h-8 text-xs dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                    {voices.map((voice, index) => (
                      <SelectItem key={`${voice.voiceURI}-${index}`} value={voice.voiceURI} className="text-xs dark:text-gray-100">
                        {`${voice.name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-600 dark:text-gray-400">Tags</label>
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-slate-400 dark:text-gray-500" />
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Add tags..."
                  className="h-8 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};