// components/ClassRecordings.tsx
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Clock, BookOpen, FileText, History, Lightbulb } from 'lucide-react'; // Added Lightbulb for quiz icon
import { ClassRecording, Quiz } from '../types/Class';
import { formatDate } from '../utils/helpers';
import { VoiceRecorder } from './VoiceRecorder';
import { AudioUploadSection } from './AudioUploadSection';
import { RecordingDetailsPanel } from './RecordingDetailsPanel';
import { QuizModal } from './QuizModal';
import { QuizHistory } from './QuizHistory'; // Import the new QuizHistory component
import { useAudioProcessing } from '../hooks/useAudioProcessing';
import { useQuizManagement } from '../hooks/useQuizManagement';

interface ClassRecordingsProps {
  recordings?: ClassRecording[];
  quizzes: Quiz[]; // Pass quizzes from useAppData
  onAddRecording: (recording: ClassRecording) => void;
  onUpdateRecording: (recording: ClassRecording) => void;
  onGenerateQuiz: (recording: ClassRecording, quiz: Quiz) => void; // Keep this for the overall app operations
}

export const ClassRecordings: React.FC<ClassRecordingsProps> = ({
  recordings = [],
  quizzes = [], // Default to empty array for quizzes
  onAddRecording,
  onUpdateRecording,
  onGenerateQuiz
}) => {
  const [selectedRecording, setSelectedRecording] = useState<ClassRecording | null>(null);

  const { handleRecordingComplete } = useAudioProcessing({ onAddRecording, onUpdateRecording });
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
    setQuizMode, // <--- ADDED THIS
    setCurrentQuestionIndex, // <--- ADDED THIS
    setUserAnswers, // <--- ADDED THIS
    setShowResults // <--- ADDED THIS
  } = useQuizManagement({ onGenerateQuiz });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0 min';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins === 0) return `${secs} sec`;
    return `${mins} min ${secs > 0 ? `${secs} sec` : ''}`.trim();
  };

  // Wrapper function to pass to RecordingDetailsPanel
  const handleGenerateQuizFromPanel = (recording: ClassRecording, numQuestions: number, difficulty: string) => {
    handleGenerateQuizFromRecording(recording, numQuestions, difficulty);
  };

  // Handler to view a historical quiz
  const handleViewHistoricalQuiz = (quiz: Quiz) => {
    // Set the quizMode state directly to display the selected historical quiz
    setQuizMode({ recording: recordings.find(rec => rec.id === quiz.classId) || null as any, quiz }); // Find the associated recording, or pass null
    // Reset quiz progress for the historical quiz
    setCurrentQuestionIndex(0);
    setUserAnswers(new Array(quiz.questions.length).fill(null));
    setShowResults(false);
  };

  return (
    <div className="space-y-8 p-4 sm:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen flex flex-col items-center">
      {/* Header for Recordings */}
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-3">
        <FileText className="h-8 w-8 text-blue-600" /> Your Recordings
      </h2>

      {/* Audio Upload and Voice Recorder Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <Lightbulb className="h-5 w-5 text-purple-500" /> Record New Class
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
          </CardContent>
        </Card>
      </div>

      {/* List of Class Recordings */}
      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-8 mb-4 flex items-center gap-2">
        <FileText className="h-6 w-6 text-blue-600" /> All Class Recordings
      </h3>
      <div className="grid gap-4">
        {Array.isArray(recordings) && recordings.length > 0 ? (
          recordings.map((recording) => (
            <Card key={recording.id} className="hover:shadow-md transition-shadow duration-200 border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedRecording(
                      selectedRecording?.id === recording.id ? null : recording
                    )}
                    className="flex items-center gap-2 text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
                  >
                    <FileText className="h-4 w-4" />
                    {selectedRecording?.id === recording.id ? 'Hide Details' : 'View Details'}
                  </Button>
                </div>
              </CardHeader>

              {selectedRecording?.id === recording.id && (
                <RecordingDetailsPanel
                  recording={recording}
                  onUpdateRecording={onUpdateRecording}
                  onGenerateQuiz={handleGenerateQuizFromPanel}
                />
              )}
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

      {/* Quiz History Section */}
      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-10 mb-4 flex items-center gap-2">
        <History className="h-6 w-6 text-green-600" /> Your Quiz History
      </h3>
      <QuizHistory quizzes={quizzes} onSelectQuiz={handleViewHistoricalQuiz} />

      {/* Quiz Modal (conditionally rendered) */}
      <QuizModal
        quizMode={quizMode}
        currentQuestionIndex={currentQuestionIndex}
        userAnswers={userAnswers}
        showResults={showResults}
        onAnswerSelect={handleAnswerSelect}
        onNextQuestion={handleNextQuestion}
        onPreviousQuestion={handlePreviousQuestion}
        onExitQuizMode={handleExitQuizMode}
        onCalculateScore={calculateScore}
      />
    </div>
  );
};
