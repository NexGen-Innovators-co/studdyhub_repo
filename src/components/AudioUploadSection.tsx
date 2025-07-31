// components/AudioUploadSection.tsx
import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Brain, Mic, Play, Pause, Download, Copy, XCircle, FileText } from 'lucide-react';
import { useAudioProcessing } from '../hooks/useAudioProcessing';
import { ClassRecording } from '../types/Class';

interface AudioUploadSectionProps {
  onAddRecording: (recording: ClassRecording) => void;
  onUpdateRecording: (recording: ClassRecording) => void;
}

export const AudioUploadSection: React.FC<AudioUploadSectionProps> = ({ onAddRecording, onUpdateRecording }) => {
  const {
    isProcessingAudio,
    uploadedAudioDetails,
    isAudioOptionsVisible,
    audioInputRef,
    audioPlayerRef,
    isPlayingAudio,
    isGeneratingNote,
    translatedContent,
    triggerAudioUpload,
    handleAudioFileSelect,
    handlePlayAudio,
    handleAudioEnded,
    handleDownloadAudio,
    handleCopyAudioUrl,
    handleClearAudioProcessing,
    handleGenerateNoteFromAudio,
    setTranslatedContent,
  } = useAudioProcessing({ onAddRecording, onUpdateRecording });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Class Recordings</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={triggerAudioUpload}
          disabled={isProcessingAudio || isGeneratingNote}
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

      {isProcessingAudio && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 text-blue-600 dark:text-blue-300">
              <Brain className="h-5 w-5 animate-pulse" />
              <span>Processing audio with AI...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadedAudioDetails && isAudioOptionsVisible && (
        <Card className="border-slate-200 bg-slate-50 dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-100 mb-3">Audio Options: {uploadedAudioDetails.name}</h3>
            <audio ref={audioPlayerRef} src={uploadedAudioDetails.url} onEnded={handleAudioEnded} className="w-full hidden" />
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePlayAudio}
                disabled={isGeneratingNote || isProcessingAudio}
                className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                {isPlayingAudio ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {isPlayingAudio ? 'Pause Audio' : 'Play Audio'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAudio}
                disabled={isGeneratingNote || isProcessingAudio}
                className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Audio
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAudioUrl}
                disabled={isGeneratingNote || isProcessingAudio}
                className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Audio URL
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAudioProcessing}
                disabled={isGeneratingNote || isProcessingAudio}
                className="text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Clear Audio
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => handleGenerateNoteFromAudio({ ...uploadedAudioDetails, audioUrl: uploadedAudioDetails.url, title: uploadedAudioDetails.name, subject: 'Uploaded Audio', transcript: '', summary: '', duration: 0, date: new Date().toISOString(), createdAt: new Date().toISOString(), userId: '', id: '' })} // Pass a dummy recording for type compatibility
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
        <Card className="border-slate-200 bg-slate-50 dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-slate-600 dark:text-gray-300">
                <FileText className="h-4 w-4" />
                <h4 className="font-medium text-slate-800 dark:text-gray-100">Translated Content</h4>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTranslatedContent(null)}
                className="h-6 w-6 p-0 text-slate-600 hover:bg-slate-50 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-slate-700 dark:text-gray-200">{translatedContent}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
