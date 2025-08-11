import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Clock, BookOpen, FileText, History, Lightbulb, Mic, Download, Trash2, RefreshCw } from 'lucide-react';
import { ClassRecording, Quiz } from '../types/Class';
import { formatDate } from '../utils/helpers';
import { VoiceRecorder } from './VoiceRecorder';
import { AudioUploadSection } from './AudioUploadSection';
import { QuizModal } from './QuizModal';
import { QuizHistory } from './QuizHistory';
import { useAudioProcessing } from '../hooks/useAudioProcessing';
import { useQuizManagement } from '../hooks/useQuizManagement';
import { RecordingSidePanel } from './RecordingSidePanel';
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

  // Audio processing hook
  const {
    handleRecordingComplete,
    audioPlayerRef,
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
        if (isPlayingAudio) {
          handlePauseAudio();
        }
      }
    }
  }, [onDeleteRecording, selectedRecording, isPlayingAudio, handlePauseAudio]);

  // Ensure audio is paused when switching recordings
  useEffect(() => {
    if (selectedRecording && audioPlayerRef.current && selectedRecording.audioUrl !== audioPlayerRef.current.src) {
      handlePauseAudio();
    }
  }, [selectedRecording, audioPlayerRef, handlePauseAudio]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <audio ref={audioPlayerRef} className="hidden" />
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Centered container for recordings list when side panel is closed */}
        <div
          className={`
            flex-1 p-4 sm:p-6 overflow-y-auto modern-scrollbar dark:bg-gray-900
            transition-all duration-300 ease-in-out
            ${selectedRecording ? 'lg:w-3xl' : 'lg:w-full lg:max-w-4xl mx-auto'}
          `}
        >
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6 flex items-center gap-3">
            <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" /> Your Recordings
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 dark:bg-gray-800 dark:border-gray-700">
              <CardHeader className="p-4 sm:pb-4">
                <CardTitle className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" /> Upload Audio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AudioUploadSection onAddRecording={onAddRecording} onUpdateRecording={onUpdateRecording} />
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 dark:bg-gray-800 dark:border-gray-700">
              <CardHeader className="p-4 sm:pb-4">
                <CardTitle className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Mic className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" /> Record New Class
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
              </CardContent>
            </Card>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-6 sm:mt-10 mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" /> All Class Recordings
          </h3>
          <div className="grid gap-4">
            {Array.isArray(recordings) && recordings.length > 0 ? (
              recordings.map((recording) => (
                <Card
                  key={recording.id}
                  className={`hover:shadow-md transition-shadow duration-200 border border-gray-200 dark:bg-gray-800 dark:border-gray-700
                    ${selectedRecording?.id === recording.id ? 'border-2 border-blue-500 shadow-lg' : ''}`}
                >
                  <CardHeader className="p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <CardTitle className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100">{recording.title}</CardTitle>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
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
                          onClick={() => {
                            if (selectedRecording?.id !== recording.id && isPlayingAudio) {
                              handlePauseAudio();
                            }
                            setSelectedRecording(selectedRecording?.id === recording.id ? null : recording);
                          }}
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
                  <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-base sm:text-lg font-medium text-gray-500 mb-2 dark:text-gray-300">No recordings yet</h3>
                  <p className="text-xs sm:text-sm text-gray-400">Start recording or uploading audio to get AI-powered summaries and transcripts</p>
                </CardContent>
              </Card>
            )}
          </div>

          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-6 sm:mt-10 mb-4 flex items-center gap-2">
            <History className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" /> Your Quiz History
          </h3>
          <div className="overflow-y-auto max-h-[40vh] sm:max-h-[50vh]">
            <QuizHistory quizzes={quizzes} onSelectQuiz={handleViewHistoricalQuiz} />
          </div>
        </div>

        {selectedRecording && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-30 lg:hidden"
              onClick={() => {
                setSelectedRecording(null);
                if (isPlayingAudio) {
                  handlePauseAudio();
                }
              }}
            />
            <RecordingSidePanel
              recording={selectedRecording}
              onClose={() => {
                setSelectedRecording(null);
                if (isPlayingAudio) {
                  handlePauseAudio();
                }
              }}
              onUpdateRecording={onUpdateRecording}
              onGenerateQuiz={handleGenerateQuizFromPanel}
              onReprocessAudio={handleReprocessAudioClick}
              onDeleteRecording={handleDeleteRecordingClick}
              onGenerateNote={onGenerateNote}
              audioUrl={selectedRecording.audioUrl}
              audioPlayerRef={audioPlayerRef}
              isPlayingAudio={isPlayingAudio}
              onPlayAudio={() => {
                if (audioPlayerRef.current && selectedRecording.audioUrl) {
                  if (audioPlayerRef.current.src !== selectedRecording.audioUrl) {
                    audioPlayerRef.current.src = selectedRecording.audioUrl;
                  }
                  handlePlayAudio();
                } else {
                  toast.error('No audio available to play.');
                }
              }}
              onPauseAudio={handlePauseAudio}
              onAudioEnded={handleAudioEnded}
            />
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
    </div>
  );
};