// components/ClassRecordings.tsx
import React, { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Clock, BookOpen, FileText, History, Lightbulb, Mic, X, Download, Trash2, RefreshCw } from 'lucide-react';
import { ClassRecording, Quiz } from '../types/Class';
import { formatDate } from '../utils/helpers';
import { VoiceRecorder } from './VoiceRecorder';
import { AudioUploadSection } from './AudioUploadSection';
import { QuizModal } from './QuizModal';
import { QuizHistory } from './QuizHistory';
import { useAudioProcessing } from '../hooks/useAudioProcessing';
import { useQuizManagement } from '../hooks/useQuizManagement';
import { RecordingDetailsPanel } from './RecordingDetailsPanel';
import { toast } from 'sonner';

interface ClassRecordingsProps {
  recordings?: ClassRecording[];
  quizzes: Quiz[];
  onAddRecording: (recording: ClassRecording) => void;
  onUpdateRecording: (recording: ClassRecording) => void;
  onGenerateQuiz: (recording: ClassRecording, quiz: Quiz) => void;
  onGenerateNote: (recording: ClassRecording) => Promise<void>;
  onDeleteRecording: (recordingId: string, documentId: string | null, audioUrl: string | null) => Promise<void>;
  onReprocessAudio: (fileUrl: string, documentId: string, targetLang?: string) => Promise<void>;
}

export const ClassRecordings: React.FC<ClassRecordingsProps> = ({
  recordings = [],
  quizzes = [],
  onAddRecording,
  onUpdateRecording,
  onGenerateQuiz,
  onGenerateNote,
  onDeleteRecording,
  onReprocessAudio,
}) => {
  const [selectedRecording, setSelectedRecording] = useState<ClassRecording | null>(null);

  // Destructure all necessary audio processing functions and states
  const {
    handleRecordingComplete,
    audioPlayerRef, // The ref for the audio player
    isPlayingAudio,
    handlePlayAudio,
    handlePauseAudio,
    handleAudioEnded,
    handleDownloadAudio,
    handleCopyAudioUrl,
  } = useAudioProcessing({ onAddRecording, onUpdateRecording });

  const {
    quizMode,
    currentQuestionIndex,
    userAnswers,
    showResults,
    handleGenerateQuizFromRecording,
    handleAnswerSelect,
    handleNextQuestion,
    handlePreviousQuestion,
    handleExitQuizMode,
    calculateScore,
    setQuizMode,

  } = useQuizManagement({ onGenerateQuiz });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0 min';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const handleGenerateQuizFromPanel = (recording: ClassRecording, numQuestions: number, difficulty: string) => {
    handleGenerateQuizFromRecording(recording, numQuestions, difficulty);
  };

  const handleViewHistoricalQuiz = (quiz: Quiz) => {
    const associatedRecording = recordings.find(rec => rec.id === quiz.classId);
    if (associatedRecording) {
      setQuizMode({ recording: associatedRecording, quiz: quiz });
    } else {
      setQuizMode({ recording: {} as ClassRecording, quiz: quiz });
      toast.info("Associated recording not found, but quiz details are displayed.");
    }

  };

  const handleReprocessAudioClick = useCallback(async (recording: ClassRecording) => {
    if (!recording.audioUrl || !recording.document_id) {
      toast.error('Audio URL or document ID missing for reprocessing.');
      return;
    }
    toast.info('Reprocessing audio...');
    await onReprocessAudio(recording.audioUrl, recording.document_id);
  }, [onReprocessAudio]);

  const handleDownloadRecording = useCallback((recording: ClassRecording) => {
    if (!recording.audioUrl) {
      toast.info('No audio file to download for this recording.');
      return;
    }
    const link = document.createElement('a');
    link.href = recording.audioUrl;
    link.download = `${recording.title || 'recording'}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Recording downloaded!');
  }, []);

  const handleDeleteRecordingClick = useCallback(async (recording: ClassRecording) => {
    if (window.confirm(`Are you sure you want to delete "${recording.title}"? This action cannot be undone.`)) {
      await onDeleteRecording(recording.id, recording.document_id || null, recording.audioUrl || null);
      if (selectedRecording?.id === recording.id) {
        setSelectedRecording(null);
      }
    }
  }, [onDeleteRecording, selectedRecording]);


  return (
    <div className="flex flex-col lg:flex-row flex-1 min-h-0">

      <div className={`
        flex-1 p-3 sm:p-6 overflow-y-auto modern-scrollbar dark:bg-gray-900
        ${selectedRecording ? 'lg:w-2/3' : 'lg:w-full'}
        transition-all duration-300 ease-in-out
      `}>
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-3">
          <FileText className="h-8 w-8 text-blue-600" /> Your Recordings
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-purple-500" /> Upload Audio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AudioUploadSection onAddRecording={onAddRecording} onUpdateRecording={onUpdateRecording} />
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Mic className="h-5 w-5 text-purple-500" /> Record New Class
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
            </CardContent>
          </Card>
        </div>

        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-10 mb-4 flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-purple-600" /> All Class Recordings
        </h3>
        <div className="grid gap-4">
          {Array.isArray(recordings) && recordings.length > 0 ? (
            recordings.map((recording) => (
              <Card
                key={recording.id}
                className={`hover:shadow-md transition-shadow duration-200 border border-gray-200 dark:bg-gray-800 dark:border-gray-700
                  ${selectedRecording?.id === recording.id ? 'border-2 border-blue-500 shadow-lg' : ''}`}
              >
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-100">{recording.title}</CardTitle>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">{recording.subject}</Badge>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(recording.duration)}
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {recording.date ? formatDate(new Date(recording.date)) : 'No date'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 sm:mt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadRecording(recording)}
                        className="flex items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-700"
                        title="Download Audio"
                        disabled={!recording.audioUrl}
                      >
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Download</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedRecording(
                          selectedRecording?.id === recording.id ? null : recording
                        )}
                        className="flex items-center gap-1 text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
                        title="View Details"
                      >
                        <FileText className="h-4 w-4" />
                        <span className="hidden sm:inline">{selectedRecording?.id === recording.id ? 'Hide' : 'View'}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRecordingClick(recording)}
                        className="flex items-center gap-1 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900"
                        title="Delete Recording"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Delete</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          ) : (
            <Card className="text-center py-8 bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700">
              <CardContent>
                <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-500 mb-2 dark:text-gray-300">No recordings yet</h3>
                <p className="text-gray-400">Start recording or uploading audio to get AI-powered summaries and transcripts</p>
              </CardContent>
            </Card>
          )}
        </div>

        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-10 mb-4 flex items-center gap-2">
          <History className="h-6 w-6 text-green-600" /> Your Quiz History
        </h3>
        <QuizHistory quizzes={quizzes} onSelectQuiz={handleViewHistoricalQuiz} />

      </div>

      {selectedRecording && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSelectedRecording(null)}
          />
          <div className={`
            ${selectedRecording ? 'translate-x-0' : 'translate-x-full'}
            fixed inset-y-0 right-0 w-full max-w-sm bg-slate-50 border-l border-slate-200 shadow-xl flex flex-col z-40
            lg:relative lg:translate-x-0 lg:w-1/3 lg:max-w-none lg:shadow-none lg:border-l
            transition-transform duration-300 ease-in-out
            dark:bg-gray-900 dark:border-gray-800
          `}>
            <RecordingDetailsPanel
              recording={selectedRecording}
              onClose={() => setSelectedRecording(null)}
              onUpdateRecording={onUpdateRecording}
              onGenerateQuiz={handleGenerateQuizFromPanel}
              onGenerateNote={onGenerateNote}
              onReprocessAudio={handleReprocessAudioClick}
              onDeleteRecording={handleDeleteRecordingClick}
              // Pass audio playback props to RecordingDetailsPanel
              audioUrl={selectedRecording.audioUrl}
              isPlayingAudio={isPlayingAudio && selectedRecording.audioUrl === audioPlayerRef.current?.src} // Only true if this recording is playing
              onPlayAudio={() => {
                // Only play if the current selected recording's audio URL matches the audio player's source
                // This prevents playing the wrong audio if multiple recordings are in the list
                if (audioPlayerRef.current && selectedRecording.audioUrl) {
                  audioPlayerRef.current.src = selectedRecording.audioUrl;
                  handlePlayAudio();
                }
              }}
              onPauseAudio={handlePauseAudio} // Assuming handlePauseAudio exists in useAudioProcessing
              onAudioEnded={handleAudioEnded}
              onDownloadAudio={() => handleDownloadRecording(selectedRecording)} // Use the local download handler
              onCopyAudioUrl={() => {
                if (selectedRecording.audioUrl) {
                  // Use document.execCommand('copy') as navigator.clipboard.writeText() might not work in iframes
                  const textArea = document.createElement("textarea");
                  textArea.value = selectedRecording.audioUrl;
                  document.body.appendChild(textArea);
                  textArea.focus();
                  textArea.select();
                  document.execCommand('copy');
                  textArea.remove();
                  toast.success('Audio URL copied to clipboard!');
                }
              }}
            />
          </div>
        </>
      )}

      <QuizModal
        quizMode={quizMode}
        currentQuestionIndex={currentQuestionIndex}
        userAnswers={userAnswers}
        showResults={showResults}
        onAnswerSelect={handleAnswerSelect}
        onNextQuestion={handleNextQuestion}
        onPreviousQuestion={handlePreviousQuestion}
        onExitQuizMode={handleExitQuizMode}
        calculateScore={calculateScore}
      />
    </div>
  );
};
