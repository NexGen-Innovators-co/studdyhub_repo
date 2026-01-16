import React, { useState, useEffect } from 'react';
import { CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { ClassRecording } from '../../../types/Class';
import {
  Clipboard,
  Check,
  X,
  RefreshCw,
  Trash2,
  FileText,
  Play,
  Pause,
  Download,
  Copy,
  Calendar,
  Clock,
  Book,
  AudioWaveform,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface RecordingDetailsPanelProps {
  recording: ClassRecording;
  onUpdateRecording: (recording: ClassRecording) => void;
  onGenerateNote: (recording: ClassRecording) => Promise<void>;
  onReprocessAudio: (recording: ClassRecording) => Promise<void>;
  onDeleteRecording: (recording: ClassRecording) => Promise<void>;
  onClose: () => void;
  audioUrl: string | null | undefined;
  audioPlayerRef: React.RefObject<HTMLAudioElement>;
  isPlayingAudio: boolean;
  onPlayAudio: () => void;
  onPauseAudio: () => void;
  onAudioEnded: () => void;
  onDownloadAudio: () => void;
  onCopyAudioUrl: () => void;
}

export const RecordingDetailsPanel: React.FC<RecordingDetailsPanelProps> = ({
  recording,
  onUpdateRecording,
  onGenerateNote,
  onReprocessAudio,
  onDeleteRecording,
  onClose,
  audioUrl,
  audioPlayerRef,
  isPlayingAudio,
  onPlayAudio,
  onPauseAudio,
  onAudioEnded,
  onDownloadAudio,
  onCopyAudioUrl,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('transcript');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Manage audio playback state
  useEffect(() => {
    const audio = audioPlayerRef.current;
    if (!audio || !audioUrl) return;

    // Set audio source if it's different
    if (audio.src !== audioUrl) {
      audio.src = audioUrl;
    }

    // Event handlers
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleError = (e: Event) => {

      toast.error('Failed to load audio. Please try again.');
      onPauseAudio();
    };

    const handleEnded = () => {
      onAudioEnded();
      setCurrentTime(0);
    };

    // Add event listeners
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    // Cleanup
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl, audioPlayerRef, onPauseAudio, onAudioEnded]);

  // Reset audio when the panel is closed
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current && isPlayingAudio) {
        audioPlayerRef.current.pause();
        setCurrentTime(0);
      }
    };
  }, [audioPlayerRef, isPlayingAudio]);

  const handleCopyTranscript = () => {
    if (recording.transcript) {
      navigator.clipboard.writeText(recording.transcript).then(() => {
        setCopySuccess(true);
        toast.success('Transcript copied to clipboard!');
        setTimeout(() => setCopySuccess(false), 2000);
      }).catch(err => {

        toast.error('Failed to copy transcript.');
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const getWordCount = (text: string) => {
    return text ? text.split(/\s+/).filter(word => word.length > 0).length : 0;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioPlayerRef.current;
    if (audio) {
      const newTime = Number(e.target.value);
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 modern-scrollbar">
        <div className="space-y-6">
          {/* Audio Player */}
          {recording.audioUrl && (
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-slate-200/50 dark:border-gray-700/50 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <Volume2 className="h-4 w-4 text-white" />
                </div>
                <h4 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100">Audio Playback</h4>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={isPlayingAudio ? onPauseAudio : onPlayAudio}
                    className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-900/50 transition-colors"
                    disabled={!recording.audioUrl}
                  >
                    {isPlayingAudio ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {isPlayingAudio ? 'Pause' : 'Play'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDownloadAudio}
                    className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/50 transition-colors"
                    disabled={!recording.audioUrl}
                  >
                    <Download className="h-4 w-4 mr-2" /> Download
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCopyAudioUrl}
                    className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/50 transition-colors"
                    disabled={!recording.audioUrl}
                  >
                    <Copy className="h-4 w-4 mr-2" /> Copy URL
                  </Button>
                </div>

                {/* Playback Progress */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDuration(currentTime)}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDuration(duration)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Content Tabs */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-gray-700/50 shadow-sm overflow-hidden">
            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200/50 dark:border-gray-700/50 bg-slate-50/50 dark:bg-gray-900/50">
              <button
                onClick={() => setActiveSection('transcript')}
                className={`flex-1 px-4 py-3 text-xs sm:text-sm font-medium transition-colors ${activeSection === 'transcript'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'
                  }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Clipboard className="h-4 w-4" />
                  Transcript
                  {recording.transcript && (
                    <span className="text-xs bg-slate-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">
                      {getWordCount(recording.transcript)} words
                    </span>
                  )}
                </div>
              </button>

              <button
                onClick={() => setActiveSection('summary')}
                className={`flex-1 px-4 py-3 text-xs sm:text-sm font-medium transition-colors ${activeSection === 'summary'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'
                  }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Summary
                </div>
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4 sm:p-5">
              {/* === CHECK PROCESSING STATE === */}
              {recording.processing_status === 'processing' || recording.processing_status === 'pending' ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="relative">
                    <RefreshCw className="h-10 w-10 text-blue-500 animate-spin" />
                    <Sparkles className="h-4 w-4 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">Processing Audio</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                       AI is currently transcribing and summarizing your audio. This may take a few moments.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                {activeSection === 'transcript' && (
                <div className="relative">
                  {recording.transcript ? (
                    <>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto modern-scrollbar">
                          {recording.transcript}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyTranscript}
                        className="absolute top-0 right-0 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                        title="Copy Transcript"
                      >
                        {copySuccess ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Clipboard className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-8">
                       <Button onClick={() => onReprocessAudio(recording)} variant="outline" size="sm" className="mb-2">
                          <RefreshCw className="h-4 w-4 mr-2"/> Generage Transcript
                       </Button>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">No transcript available</p>
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'summary' && (
                <div>
                  {recording.summary ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-h-64 overflow-y-auto modern-scrollbar">
                        {recording.summary}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Sparkles className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">No summary available</p>
                    </div>
                  )}
                </div>
              )}
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={() => onGenerateNote(recording)}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg transition-all duration-200 transform hover:scale-[1.02] py-3"
              disabled={!recording.transcript || getWordCount(recording.transcript) < 50}
            >
              <FileText className="h-4 w-4 mr-2" />
              Generate Study Notes
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => onReprocessAudio(recording)}
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 transition-colors py-2.5"
                disabled={!recording.audioUrl}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reprocess
              </Button>

              <Button
                onClick={() => onDeleteRecording(recording)}
                variant="outline"
                className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800 transition-colors py-2.5"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};