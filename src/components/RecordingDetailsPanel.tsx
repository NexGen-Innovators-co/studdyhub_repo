// components/RecordingDetailsPanel.tsx
import React, { useState } from 'react'; // Import useState
import { Button } from './ui/button';
import { CardContent } from './ui/card';
import { Brain, FileText } from 'lucide-react';
import { ClassRecording, Quiz } from '../types/Class';
import { useAudioProcessing } from '../hooks/useAudioProcessing';
// No longer importing useQuizManagement directly here, as its handler is passed as a prop

interface RecordingDetailsPanelProps {
  recording: ClassRecording;
  onUpdateRecording: (recording: ClassRecording) => void;
  // This prop will now be the handler from ClassRecordings.tsx, which wraps useQuizManagement's handler
  onGenerateQuiz: (recording: ClassRecording, numQuestions: number, difficulty: string) => void;
}

export const RecordingDetailsPanel: React.FC<RecordingDetailsPanelProps> = ({ recording, onUpdateRecording, onGenerateQuiz }) => {
  const { isGeneratingNote, isProcessingAudio, handleGenerateNoteFromAudio } = useAudioProcessing({ onAddRecording: () => {}, onUpdateRecording });

  // State for quiz generation options
  const [numQuestions, setNumQuestions] = useState<number>(5); // Default to 5 questions
  const [difficulty, setDifficulty] = useState<string>('medium'); // Default to medium difficulty

  const handleQuizButtonClick = () => {
    // Call the passed onGenerateQuiz handler with the new parameters
    onGenerateQuiz(recording, numQuestions, difficulty);
  };

  return (
    <CardContent className="pt-0">
      <div className="space-y-4">
        {recording.audioUrl && (
          <audio controls className="w-full">
            <source src={recording.audioUrl} type="audio/wav" />
          </audio>
        )}

        <div>
          <h4 className="font-semibold mb-2">AI Summary</h4>
          <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded dark:bg-gray-700 dark:text-gray-200">
            {recording.summary || 'No summary available.'}
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Transcript</h4>
          <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded max-h-32 overflow-y-auto dark:bg-gray-800 dark:text-gray-200">
            {recording.transcript || 'No transcript available.'}
          </p>
        </div>

        <Button
          onClick={() => handleGenerateNoteFromAudio(recording)}
          disabled={isGeneratingNote || isProcessingAudio}
          className="w-full mb-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700"
        >
          {isGeneratingNote ? (
            <Brain className="h-4 w-4 mr-2 animate-pulse" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          {isGeneratingNote ? 'Generating Note...' : 'Generate Note'}
        </Button>

        {/* New Quiz Options Section */}
        <div className="border-t border-slate-200 pt-4 mt-4 dark:border-gray-700">
          <h4 className="font-semibold mb-3 text-slate-800 dark:text-gray-100">Quiz Options</h4>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <label htmlFor="numQuestions" className="block text-sm font-medium text-slate-700 mb-1 dark:text-gray-300">
                Number of Questions
              </label>
              <input
                type="number"
                id="numQuestions"
                min="1"
                max="10" // Limit to a reasonable number
                value={numQuestions}
                onChange={(e) => setNumQuestions(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="difficulty" className="block text-sm font-medium text-slate-700 mb-1 dark:text-gray-300">
                Difficulty
              </label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
          <Button
            onClick={handleQuizButtonClick} // Use the new handler
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700"
          >
            <Brain className="h-4 w-4 mr-2" />
            Generate Quiz
          </Button>
        </div>
      </div>
    </CardContent>
  );
};
