import React from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { ClassRecording } from '../types/Class';
import { RecordingDetailsPanel } from './RecordingDetailsPanel';

interface RecordingSidePanelProps {
  recording: ClassRecording;
  onClose: () => void;
  onUpdateRecording: (recording: ClassRecording) => void;
  onGenerateQuiz: (recording: ClassRecording, numQuestions: number, difficulty: string) => void;
  onReprocessAudio: (recording: ClassRecording) => Promise<void>;
  onDeleteRecording: (recording: ClassRecording) => Promise<void>;
  onGenerateNote: (recording: ClassRecording) => Promise<void>;
  audioUrl: string | null | undefined;
  audioPlayerRef: React.RefObject<HTMLAudioElement>; // Add audioPlayerRef prop
  isPlayingAudio: boolean;
  onPlayAudio: () => void;
  onPauseAudio: () => void;
  onAudioEnded: () => void;
}

export const RecordingSidePanel: React.FC<RecordingSidePanelProps> = ({
  recording,
  onClose,
  onUpdateRecording,
  onGenerateQuiz,
  onReprocessAudio,
  onDeleteRecording,
  onGenerateNote,
  audioUrl,
  audioPlayerRef, // Receive audioPlayerRef
  isPlayingAudio,
  onPlayAudio,
  onPauseAudio,
  onAudioEnded,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-30 transition-opacity lg:hidden ${
          isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className={`fixed inset-y-0 right-0 bg-white dark:bg-gray-900 border-l border-slate-200/50 dark:border-gray-700/50 shadow-2xl flex flex-col z-40 transition-all duration-300 ease-out ${
        isExpanded 
          ? 'w-full max-w-2xl' 
          : 'w-full max-w-sm lg:max-w-md'
      } lg:relative lg:shadow-xl`}>
        
        {/* Header with expand/collapse */}
        <div className="p-4 border-b border-slate-200/50 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-700 dark:border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-full" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100">Recording</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 truncate max-w-48">
                  {recording.title}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="rounded-full hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors lg:hidden"
                title={isExpanded ? "Collapse panel" : "Expand panel"}
              >
                {isExpanded ? (
                  <Minimize2 className="h-4 w-4 text-slate-600 dark:text-gray-400" />
                ) : (
                  <Maximize2 className="h-4 w-4 text-slate-600 dark:text-gray-400" />
                )}
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="rounded-full hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors"
                title="Close panel"
              >
                <X className="h-4 w-4 text-slate-600 dark:text-gray-400" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <RecordingDetailsPanel
            recording={recording}
            onUpdateRecording={onUpdateRecording}
            onGenerateQuiz={onGenerateQuiz}
            onReprocessAudio={onReprocessAudio}
            onDeleteRecording={onDeleteRecording}
            onGenerateNote={onGenerateNote}
            onClose={onClose}
            audioUrl={audioUrl}
            audioPlayerRef={audioPlayerRef} // Pass audioPlayerRef to RecordingDetailsPanel
            isPlayingAudio={isPlayingAudio}
            onPlayAudio={onPlayAudio}
            onPauseAudio={onPauseAudio}
            onAudioEnded={onAudioEnded}
            onDownloadAudio={() => {
              if (audioUrl) {
                const link = document.createElement('a');
                link.href = audioUrl;
                link.download = `${recording.title || 'recording'}.webm`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success('Recording downloaded!');
              } else {
                toast.error('No audio file available to download.');
              }
            }}
            onCopyAudioUrl={() => {
              if (audioUrl) {
                navigator.clipboard.writeText(audioUrl).then(() => {
                  toast.success('Audio URL copied to clipboard!');
                }).catch(() => {
                  toast.error('Failed to copy URL');
                });
              } else {
                toast.error('No audio URL available.');
              }
            }}
          />
        </div>
      </div>
    </>
  );
};