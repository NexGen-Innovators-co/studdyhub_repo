// components/EnhancedVoiceRecorder.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Mic, 
  StopCircle, 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  Loader2,
  Save,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { useChunkedRecording } from '../hooks/useChunkedRecording';
import { useStreamingUpload, formatBytes, formatDuration } from '../hooks/useStreamingUpload';

interface EnhancedVoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, title: string, subject: string) => Promise<void>;
  userId: string;
}

export const EnhancedVoiceRecorder: React.FC<EnhancedVoiceRecorderProps> = ({
  onRecordingComplete,
  userId
}) => {
  const [recordingTitle, setRecordingTitle] = useState('');
  const [recordingSubject, setRecordingSubject] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const {
    isRecording,
    isPaused,
    chunks,
    totalDuration,
    error: recordingError,
    hasBackup,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    clearBackup
  } = useChunkedRecording({
    chunkDurationMs: 5 * 60 * 1000, // 5 minutes
    enableLocalBackup: true,
    onChunkComplete: (chunk) => {
      toast.info(`Chunk ${chunk.index + 1} saved (${formatDuration(chunk.duration / 1000)})`);
    },
    onError: (error) => {
      toast.error(`Recording error: ${error.message}`);
    }
  });

  const {
    isUploading,
    progress: uploadProgress,
    error: uploadError
  } = useStreamingUpload({
    bucket: 'recordings',
    onProgress: (progress) => {
      // Progress updates handled by state
    },
    onComplete: (url) => {
      toast.success('Upload complete!');
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    }
  });

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    try {
      await startRecording();
      toast.info('Recording started...');
    } catch (err) {
      toast.error('Failed to start recording');
    }
  };

  const handleStopRecording = async () => {
    try {
      const blob = await stopRecording();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      toast.success('Recording stopped');
    } catch (err) {
      toast.error('Failed to stop recording');
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      resumeRecording();
      toast.info('Recording resumed');
    } else {
      pauseRecording();
      toast.info('Recording paused');
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `${recordingTitle || 'recording'}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Recording downloaded!');
  };

  const handleClear = () => {
    cancelRecording();
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setRecordingTitle('');
    setRecordingSubject('');
    setIsPlaying(false);
    clearBackup();
    toast.info('Recording cleared');
  };

  const handleSave = async () => {
    if (!audioUrl || !recordingTitle || !recordingSubject) {
      toast.error('Please provide a title and subject');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      await onRecordingComplete(blob, recordingTitle, recordingSubject);
      handleClear();
      toast.success('Recording saved and processing started!');
    } catch (err) {
      toast.error('Failed to save recording');
    } finally {
      setIsSaving(false);
    }
  };

  // Restore backup notification
  useEffect(() => {
    if (hasBackup && chunks.length > 0) {
      toast.info(
        `Found ${chunks.length} saved chunk(s) from interrupted recording`,
        {
          action: {
            label: 'Restore',
            onClick: () => {
              // Chunks are already loaded, just show them
              toast.success('Recording restored');
            }
          }
        }
      );
    }
  }, [hasBackup, chunks.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <Card className="shadow-sm dark:bg-gray-800 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Mic className="h-6 w-6 text-green-600" />
          Voice Recorder
          {isRecording && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          )}
        </CardTitle>
        {chunks.length > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {chunks.length} chunk(s) recorded • Auto-saves every 5 minutes
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Recording Controls */}
        <div className="flex items-center justify-center gap-4">
          {!isRecording && !audioUrl && (
            <Button
              onClick={handleStartRecording}
              className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
              disabled={isSaving}
            >
              <Mic className="h-5 w-5 mr-2" />
              Start Recording
            </Button>
          )}
          
          {isRecording && (
            <>
              <Button
                onClick={handlePauseResume}
                variant="outline"
                className="border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
              >
                {isPaused ? (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-5 w-5 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              <Button
                onClick={handleStopRecording}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                <StopCircle className="h-5 w-5 mr-2" />
                Stop
              </Button>
            </>
          )}
          
          {audioUrl && !isRecording && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handlePlayPause}
                disabled={isSaving}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={isSaving}
              >
                <Download className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                onClick={handleClear}
                className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                disabled={isSaving}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>

        {/* Timer */}
        <div className="text-center">
          <span className={`text-4xl font-mono ${isPaused ? 'text-yellow-500' : 'text-gray-700 dark:text-gray-300'}`}>
            {formatTime(totalDuration)}
          </span>
          {isPaused && (
            <p className="text-sm text-yellow-500 mt-1">Paused</p>
          )}
        </div>

        {/* Error Display */}
        {recordingError && (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            {recordingError}
          </div>
        )}

        {/* Audio Player */}
        {audioUrl && (
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        )}

        {/* Save Form */}
        {audioUrl && !isRecording && (
          <div className="space-y-3 border-t dark:border-gray-700 pt-4">
            <input
              type="text"
              placeholder="Recording Title (e.g., 'Lecture on AI')"
              value={recordingTitle}
              onChange={(e) => setRecordingTitle(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              disabled={isSaving}
            />
            <input
              type="text"
              placeholder="Subject (e.g., 'Computer Science')"
              value={recordingSubject}
              onChange={(e) => setRecordingSubject(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              disabled={isSaving}
            />
            
            {/* Upload Progress */}
            {isUploading && uploadProgress && (
              <div className="space-y-2">
                <Progress value={uploadProgress.percentage} className="h-2" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{formatBytes(uploadProgress.loaded)} / {formatBytes(uploadProgress.total)}</span>
                  <span>ETA: {formatDuration(uploadProgress.estimatedTimeRemaining)}</span>
                </div>
              </div>
            )}
            
            <Button
              onClick={handleSave}
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
              disabled={isSaving || !recordingTitle || !recordingSubject || isUploading}
            >
              {isSaving || isUploading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {isUploading ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Save & Process Recording
                </>
              )}
            </Button>
          </div>
        )}

        {/* Advanced Options */}
        <div className="border-t dark:border-gray-700 pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-gray-500 w-full justify-between"
          >
            <span>Advanced Options</span>
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          
          {showAdvanced && (
            <div className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>• Recording is auto-saved every 5 minutes</p>
              <p>• Pause/resume supported during recording</p>
              <p>• Local backup saves interrupted recordings</p>
              <p>• Progress tracking during upload</p>
              {hasBackup && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearBackup}
                  className="mt-2"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear Backup
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
