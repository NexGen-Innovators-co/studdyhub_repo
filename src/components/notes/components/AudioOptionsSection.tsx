// components/AudioOptionsSection.tsx
import React from 'react';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Brain, Download, Copy, Play, Pause, XCircle, Sparkles, FileText } from 'lucide-react';
import { UserProfile } from '../../../types';

interface AudioOptionsSectionProps {
  uploadedAudioDetails: { url: string; type: string; name: string; } | null;
  isAudioOptionsVisible: boolean;
  audioPlayerRef: React.RefObject<HTMLAudioElement>;
  isPlayingAudio: boolean;
  handlePlayAudio: () => void;
  handleAudioEnded: () => void;
  handleDownloadAudio: () => void;
  handleCopyAudioUrl: () => void;
  handleClearAudioProcessing: () => void;
  handleGenerateNoteFromAudio: () => void;
  handleGenerateSummaryFromAudio: () => void;
  targetLanguage: string;
  setTargetLanguage: (lang: string) => void;
  handleTranslateAudio: () => void;
  isGeneratingAudioNote: boolean;
  isGeneratingAudioSummary: boolean;
  isTranslatingAudio: boolean;
  isProcessingAudio: boolean;
  userProfile: UserProfile | null;
}

export const AudioOptionsSection: React.FC<AudioOptionsSectionProps> = ({
  uploadedAudioDetails,
  isAudioOptionsVisible,
  audioPlayerRef,
  isPlayingAudio,
  handlePlayAudio,
  handleAudioEnded,
  handleDownloadAudio,
  handleCopyAudioUrl,
  handleClearAudioProcessing,
  handleGenerateNoteFromAudio,
  handleGenerateSummaryFromAudio,
  targetLanguage,
  setTargetLanguage,
  handleTranslateAudio,
  isGeneratingAudioNote,
  isGeneratingAudioSummary,
  isTranslatingAudio,
  isProcessingAudio,
  userProfile,
}) => {
  if (!uploadedAudioDetails || !isAudioOptionsVisible) {
    return null;
  }

  return (
    <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50 dark:bg-gray-900 dark:border-gray-800 flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-100">Audio Options: {uploadedAudioDetails.name}</h3>
      <audio ref={audioPlayerRef} src={uploadedAudioDetails.url} onEnded={handleAudioEnded} className="w-full hidden" />
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePlayAudio}
          disabled={isGeneratingAudioNote || isGeneratingAudioSummary || isTranslatingAudio || isProcessingAudio}
          className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-100"
        >
          {isPlayingAudio ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
          {isPlayingAudio ? 'Pause Audio' : 'Play Audio'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadAudio}
          disabled={isGeneratingAudioNote || isGeneratingAudioSummary || isTranslatingAudio || isProcessingAudio}
          className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-100"
        >
          <Download className="h-4 w-4 mr-2" />
          Download Audio
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyAudioUrl}
          disabled={isGeneratingAudioNote || isGeneratingAudioSummary || isTranslatingAudio || isProcessingAudio}
          className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-100"
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy Audio URL
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAudioProcessing}
          disabled={isGeneratingAudioNote || isGeneratingAudioSummary || isTranslatingAudio || isProcessingAudio}
          className="text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-700"
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
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700"
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
          className="bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          {isGeneratingAudioSummary ? (
            <Brain className="h-4 w-4 mr-2 animate-pulse" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {isGeneratingAudioSummary ? 'Generating Summary...' : 'Generate Only Summary'}
        </Button>
        <Select value={targetLanguage} onValueChange={setTargetLanguage} disabled={isGeneratingAudioNote || isGeneratingAudioSummary || isTranslatingAudio || isProcessingAudio}>
          <SelectTrigger className="w-[180px] dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">
            <SelectValue placeholder="Translate to..." />
          </SelectTrigger>
          <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
            <SelectItem value="en" className="dark:text-gray-100 dark:hover:bg-gray-600">English</SelectItem>
            <SelectItem value="es" className="dark:text-gray-100 dark:hover:bg-gray-600">Spanish</SelectItem>
            <SelectItem value="fr" className="dark:text-gray-100 dark:hover:bg-gray-600">French</SelectItem>
            <SelectItem value="de" className="dark:text-gray-100 dark:hover:bg-gray-600">German</SelectItem>
            <SelectItem value="zh" className="dark:text-gray-100 dark:hover:bg-gray-600">Chinese</SelectItem>
            <SelectItem value="ja" className="dark:text-gray-100 dark:hover:bg-gray-600">Japanese</SelectItem>
            <SelectItem value="ko" className="dark:text-gray-100 dark:hover:bg-gray-600">Korean</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTranslateAudio}
          disabled={isGeneratingAudioNote || isGeneratingAudioSummary || isTranslatingAudio || isProcessingAudio || targetLanguage === 'en' || !userProfile}
          className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-100"
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
  );
};
