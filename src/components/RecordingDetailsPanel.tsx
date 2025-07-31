// components/RecordingDetailsPanel.tsx
import React, { useState } from 'react';
import { CardContent } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ClassRecording } from '../types/Class';
import { Clipboard, Check, Lightbulb, X } from 'lucide-react';
import { toast } from 'sonner';

interface RecordingDetailsPanelProps {
  recording: ClassRecording;
  onUpdateRecording: (recording: ClassRecording) => void;
  onGenerateQuiz: (recording: ClassRecording, numQuestions: number, difficulty: string) => void;
}

export const RecordingDetailsPanel: React.FC<RecordingDetailsPanelProps> = ({
  recording,
  onUpdateRecording,
  onGenerateQuiz,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [numQuestions, setNumQuestions] = useState<number>(5); // Default to 5 questions
  const [difficulty, setDifficulty] = useState<string>('medium'); // Default to medium difficulty

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

  const handleGenerateQuizClick = () => {
    onGenerateQuiz(recording, numQuestions, difficulty);
  };

  return (
    <CardContent className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="space-y-6">
        {/* Transcript Section */}
        <div>
          <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
            <Clipboard className="h-5 w-5 text-blue-500" /> Transcript
          </h4>
          <div className="relative bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 shadow-inner">
            <p className="text-sm text-gray-700 dark:text-gray-300 max-h-40 overflow-y-auto modern-scrollbar">
              {recording.transcript || 'No transcript available.'}
            </p>
            {recording.transcript && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyTranscript}
                className="absolute top-2 right-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-600"
                title="Copy Transcript"
              >
                {copySuccess ? <Check className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        {/* Summary Section */}
        <div>
          <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" /> AI Summary
          </h4>
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 shadow-inner">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {recording.summary || 'No AI summary available.'}
            </p>
          </div>
        </div>

        {/* Quiz Generation Section */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 shadow-md">
          <h4 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-600" /> Generate Quiz
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="num-questions" className="text-sm font-medium text-gray-700 dark:text-gray-300">Number of Questions</Label>
              <Select value={String(numQuestions)} onValueChange={(value) => setNumQuestions(Number(value))}>
                <SelectTrigger id="num-questions" className="w-full bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                  <SelectValue placeholder="Select number of questions" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                  {[3, 5, 10, 15].map(num => (
                    <SelectItem key={num} value={String(num)} className="dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600">{num}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="difficulty" className="text-sm font-medium text-gray-700 dark:text-gray-300">Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger id="difficulty" className="w-full bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                  {['easy', 'medium', 'hard'].map(level => (
                    <SelectItem key={level} value={level} className="dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600">{level.charAt(0).toUpperCase() + level.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleGenerateQuizClick}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-md transition-all duration-200"
            disabled={!recording.transcript || recording.transcript.split(' ').length < 50}
          >
            Generate Quiz from Recording
          </Button>
          {!recording.transcript && (
            <p className="text-xs text-red-500 mt-2 text-center">Transcript required to generate quiz.</p>
          )}
          {recording.transcript && recording.transcript.split(' ').length < 50 && (
            <p className="text-xs text-red-500 mt-2 text-center">Transcript content too short for meaningful quiz generation.</p>
          )}
        </div>
      </div>
    </CardContent>
  );
};
