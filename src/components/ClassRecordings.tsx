// components/ClassRecordings.tsx
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Clock, BookOpen, FileText } from 'lucide-react';
import { ClassRecording, Quiz } from '../types/Class';
import { formatDate } from '../utils/helpers';
import { VoiceRecorder } from './VoiceRecorder'; // Assuming VoiceRecorder is a separate component
import { AudioUploadSection } from './AudioUploadSection';
import { RecordingDetailsPanel } from './RecordingDetailsPanel';
import { QuizModal } from './QuizModal';
import { useAudioProcessing } from '../hooks/useAudioProcessing';
import { useQuizManagement } from '../hooks/useQuizManagement';

interface ClassRecordingsProps {
  recordings?: ClassRecording[];
  onAddRecording: (recording: ClassRecording) => void;
  onUpdateRecording: (recording: ClassRecording) => void;
  // This prop's signature needs to change to match the new parameters from RecordingDetailsPanel
  onGenerateQuiz: (recording: ClassRecording, quiz: Quiz) => void; // Keep this for the overall app operations
}

export const ClassRecordings: React.FC<ClassRecordingsProps> = ({
  recordings = [],
  onAddRecording,
  onUpdateRecording,
  onGenerateQuiz // This is the prop from useAppOperations
}) => {
  const [selectedRecording, setSelectedRecording] = useState<ClassRecording | null>(null);

  // Use the hooks
  const { handleRecordingComplete } = useAudioProcessing({ onAddRecording, onUpdateRecording });
  const {
    quizMode,
    currentQuestionIndex,
    userAnswers,
    showResults,
    handleGenerateQuizFromRecording, // This is the actual handler that takes numQuestions and difficulty
    handleAnswerSelect,
    handleNextQuestion,
    handlePreviousQuestion,
    handleExitQuizMode,
    calculateScore,
  } = useQuizManagement({ onGenerateQuiz }); // Pass the original onGenerateQuiz to the hook

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0 min';
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  // Wrapper function to pass to RecordingDetailsPanel
  const handleGenerateQuizFromPanel = (recording: ClassRecording, numQuestions: number, difficulty: string) => {
    handleGenerateQuizFromRecording(recording, numQuestions, difficulty);
  };

  return (
    <div className="space-y-6">
      <AudioUploadSection onAddRecording={onAddRecording} onUpdateRecording={onUpdateRecording} />
      <VoiceRecorder onRecordingComplete={handleRecordingComplete} />

      <div className="grid gap-4">
        {Array.isArray(recordings) && recordings.length > 0 ? (
          recordings.map((recording) => (
            <Card key={recording.id} className="hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg dark:text-gray-100">{recording.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="dark:bg-gray-700 dark:text-gray-200">{recording.subject}</Badge>
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                        <Clock className="h-3 w-3" />
                        {formatDuration(recording.duration)}
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
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
                    className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {selectedRecording?.id === recording.id ? 'Hide' : 'View'} Details
                  </Button>
                </div>
              </CardHeader>

              {selectedRecording?.id === recording.id && (
                <RecordingDetailsPanel
                  recording={recording}
                  onUpdateRecording={onUpdateRecording}
                  onGenerateQuiz={handleGenerateQuizFromPanel} // Pass the wrapper handler
                />
              )}
            </Card>
          ))
        ) : (
          <Card className="text-center py-8 dark:bg-gray-800 dark:border-gray-700">
            <CardContent>
              <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-500 mb-2 dark:text-gray-300">No recordings yet</h3>
              <p className="text-gray-400">Start recording or uploading audio to get AI-powered summaries and transcripts</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pass all necessary quiz state and handlers to QuizModal */}
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
