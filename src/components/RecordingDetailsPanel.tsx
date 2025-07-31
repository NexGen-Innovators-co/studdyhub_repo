import React, { useState, useRef, useEffect } from 'react';
import { CardContent } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ClassRecording } from '../types/Class';
import { 
  Clipboard, 
  Check, 
  Lightbulb, 
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
  Settings,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

interface RecordingDetailsPanelProps {
  recording: ClassRecording;
  onUpdateRecording: (recording: ClassRecording) => void;
  onGenerateQuiz: (recording: ClassRecording, numQuestions: number, difficulty: string) => void;
  onGenerateNote: (recording: ClassRecording) => Promise<void>;
  onReprocessAudio: (recording: ClassRecording) => Promise<void>;
  onDeleteRecording: (recording: ClassRecording) => Promise<void>;
  onClose: () => void;
  audioUrl: string | null | undefined;
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
  onGenerateQuiz,
  onGenerateNote,
  onReprocessAudio,
  onDeleteRecording,
  onClose,
  audioUrl,
  isPlayingAudio,
  onPlayAudio,
  onPauseAudio,
  onAudioEnded,
  onDownloadAudio,
  onCopyAudioUrl,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [numQuestions, setNumQuestions] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<string>('medium');
  const [activeSection, setActiveSection] = useState<string>('transcript');

  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = audioUrl || '';
      if (isPlayingAudio) {
        audioPlayerRef.current.play().catch(e => console.error("Error playing audio:", e));
      } else {
        audioPlayerRef.current.pause();
      }
    }
  }, [audioUrl, isPlayingAudio]);

  const handleCopyTranscript = () => {
    if (recording.transcript) {
      navigator.clipboard.writeText(recording.transcript).then(() => {
        setCopySuccess(true);
        toast.success('Transcript copied to clipboard!');
        setTimeout(() => setCopySuccess(false), 2000);
      }).catch(err => {
        console.error('Failed to copy transcript:', err);
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

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="p-6 border-b border-slate-200/50 bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 dark:border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <AudioWaveform className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-gray-100">Recording Details</h3>
              <p className="text-sm text-slate-500 dark:text-gray-400">Manage and analyze your recording</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose} 
            className="rounded-full hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5 text-slate-500 dark:text-gray-400" />
          </Button>
        </div>

        {/* Recording Info Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Date</span>
            </div>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              {new Date(recording.date).toLocaleDateString()}
            </p>
          </div>
          
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Duration</span>
            </div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              {formatDuration(recording.duration)}
            </p>
          </div>
        </div>

        {/* Title and Subject */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <Book className="h-4 w-4 text-slate-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Subject:</span>
            <span className="text-sm text-slate-900 dark:text-gray-100 font-semibold">{recording.subject}</span>
          </div>
          <h4 className="text-lg font-bold text-slate-900 dark:text-gray-100 leading-tight">
            {recording.title}
          </h4>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 modern-scrollbar">
        <div className="space-y-6">
          {/* Audio Player */}
          {recording.audioUrl && (
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/50 dark:border-gray-700/50 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <Volume2 className="h-4 w-4 text-white" />
                </div>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Audio Playback</h4>
              </div>
              
              <audio ref={audioPlayerRef} src={recording.audioUrl} onEnded={onAudioEnded} className="hidden" />
              
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
                  className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800 dark:hover:bg-purple-900/50 transition-colors"
                  disabled={!recording.audioUrl}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy URL
                </Button>
              </div>
            </div>
          )}

          {/* Content Tabs */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-gray-700/50 shadow-sm overflow-hidden">
            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200/50 dark:border-gray-700/50 bg-slate-50/50 dark:bg-gray-900/50">
              <button
                onClick={() => setActiveSection('transcript')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeSection === 'transcript'
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
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeSection === 'summary'
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
            <div className="p-5">
              {activeSection === 'transcript' && (
                <div className="relative">
                  {recording.transcript ? (
                    <>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto modern-scrollbar">
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
                      <Clipboard className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">No transcript available</p>
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'summary' && (
                <div>
                  {recording.summary ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {recording.summary}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Sparkles className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">No AI summary available</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quiz Generation */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-5 rounded-2xl border border-blue-200/50 dark:border-blue-800/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Lightbulb className="h-4 w-4 text-white" />
              </div>
              <h4 className="text-lg font-semibold text-blue-800 dark:text-blue-200">Generate Quiz</h4>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="space-y-2">
                <Label htmlFor="num-questions" className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Questions
                </Label>
                <Select value={String(numQuestions)} onValueChange={(value) => setNumQuestions(Number(value))}>
                  <SelectTrigger className="bg-white/80 dark:bg-gray-800/80 border-blue-200 dark:border-blue-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[3, 5, 10, 15].map(num => (
                      <SelectItem key={num} value={String(num)}>{num} questions</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="difficulty" className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Difficulty
                </Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="bg-white/80 dark:bg-gray-800/80 border-blue-200 dark:border-blue-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['easy', 'medium', 'hard'].map(level => (
                      <SelectItem key={level} value={level}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button
              onClick={() => onGenerateQuiz(recording, numQuestions, difficulty)}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
              disabled={!recording.transcript || getWordCount(recording.transcript) < 50}
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              Generate Quiz
            </Button>
            
            {(!recording.transcript || getWordCount(recording.transcript) < 50) && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 text-center">
                {!recording.transcript ? 'Transcript required' : 'Need more content for quiz generation'}
              </p>
            )}
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
                className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800 transition-colors py-2.5"
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
