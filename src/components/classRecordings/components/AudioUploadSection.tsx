// Redesigned AudioUploadSection with modern UI
import React, { useRef } from 'react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Brain, Play, Pause, Download, Copy, XCircle, FileText, Upload, FileAudio, CloudUpload } from 'lucide-react';
import { useAudioProcessing } from '../hooks/useAudioProcessing';
import { ClassRecording } from '../../../types/Class';

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

  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('audio/')) {
      const event = { target: { files } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleAudioFileSelect(event);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm mb-2">
          <FileAudio className="h-3 w-3" />
          Audio Upload
        </div>
        <h3 className="text-xl font-bold">Upload Audio File</h3>
        <p className="text-sm text-muted-foreground">Upload MP3, WAV, or WebM files for AI processing</p>
      </div>

      {/* Drop Zone */}
      {!uploadedAudioDetails && !isProcessingAudio && (
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerAudioUpload}
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${
            isDragging 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
              : 'border-border hover:border-blue-400 hover:bg-muted/50'
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            <div className={`p-4 rounded-full transition-colors ${
              isDragging ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-muted'
            }`}>
              <CloudUpload className={`h-10 w-10 ${isDragging ? 'text-blue-500' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {isDragging ? 'Drop your audio file here' : 'Drag & drop audio file'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or <span className="text-blue-500 hover:underline">browse files</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Supports MP3, WAV, WebM, M4A (max 100MB)
            </p>
          </div>
        </div>
      )}

      <input
        type="file"
        ref={audioInputRef}
        onChange={handleAudioFileSelect}
        style={{ display: 'none' }}
        accept="audio/*"
      />

      {/* Processing State */}
      {isProcessingAudio && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <Brain className="h-8 w-8 text-blue-500 animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-medium text-blue-700 dark:text-blue-300">Processing Audio...</p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                Uploading and preparing for AI analysis
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Audio Options */}
      {uploadedAudioDetails && isAudioOptionsVisible && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
              <FileAudio className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold truncate">{uploadedAudioDetails.name}</h4>
              <p className="text-sm text-muted-foreground">Ready for processing</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAudioProcessing}
              disabled={isGeneratingNote || isProcessingAudio}
              className="text-muted-foreground hover:text-destructive"
            >
              <XCircle className="h-5 w-5" />
            </Button>
          </div>

          {/* Audio Player */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
            <Button
              size="sm"
              className="h-10 w-10 rounded-full bg-emerald-500 hover:bg-emerald-600 p-0"
              onClick={handlePlayAudio}
              disabled={isGeneratingNote || isProcessingAudio}
            >
              {isPlayingAudio ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-emerald-500 rounded-full" />
            </div>
            <audio ref={audioPlayerRef} src={uploadedAudioDetails.url} onEnded={handleAudioEnded} className="hidden" />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAudio}
              disabled={isGeneratingNote || isProcessingAudio}
              className="rounded-xl"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAudioUrl}
              disabled={isGeneratingNote || isProcessingAudio}
              className="rounded-xl"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy URL
            </Button>
          </div>

          {/* Generate Note Button */}
          <Button
            onClick={() => handleGenerateNoteFromAudio({
              ...uploadedAudioDetails,
              audioUrl: uploadedAudioDetails.url,
              title: uploadedAudioDetails.name,
              subject: 'Uploaded Audio',
              transcript: '',
              summary: '',
              duration: 0,
              date: new Date().toISOString(),
              created_at: new Date().toISOString(),
              userId: '',
              id: ''
            })}
            disabled={isGeneratingNote || isProcessingAudio}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg"
          >
            {isGeneratingNote ? (
              <>
                <Brain className="h-5 w-5 mr-2 animate-pulse" />
                Generating Note...
              </>
            ) : (
              <>
                <FileText className="h-5 w-5 mr-2" />
                Generate Note with AI
              </>
            )}
          </Button>
        </div>
      )}

      {/* Translated Content */}
      {translatedContent && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-medium">Translated Content</h4>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTranslatedContent(null)}
              className="h-6 w-6 p-0"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{translatedContent}</p>
        </div>
      )}
    </div>
  );
};
