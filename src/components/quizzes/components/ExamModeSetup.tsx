// src/components/quizzes/components/ExamModeSetup.tsx
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { Quiz } from '../../../types/Class';
import { ExamModeSettings, DEFAULT_EXAM_SETTINGS } from '../hooks/useExamMode';
import {
  Clock,
  Shuffle,
  Lock,
  Eye,
  Shield,
  Zap,
  AlertTriangle,
  GraduationCap,
  Timer,
} from 'lucide-react';

interface ExamModeSetupProps {
  quiz: Quiz;
  open: boolean;
  onClose: () => void;
  onStartExam: (settings: ExamModeSettings) => void;
}

const TIME_OPTIONS = [
  { value: 0, label: 'No Limit' },
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
];

export const ExamModeSetup: React.FC<ExamModeSetupProps> = ({
  quiz,
  open,
  onClose,
  onStartExam,
}) => {
  const [settings, setSettings] = useState<ExamModeSettings>({ ...DEFAULT_EXAM_SETTINGS });

  const questionCount = quiz.questions?.length || 0;

  const handleStart = () => {
    onStartExam(settings);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3 text-white">
              <GraduationCap className="h-7 w-7" />
              Exam Mode
            </DialogTitle>
            <DialogDescription className="text-red-100 mt-1">
              Configure your exam environment for &quot;{quiz.title}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full">
              <Zap className="h-3.5 w-3.5" />
              <span>{questionCount} Questions</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full">
              <Timer className="h-3.5 w-3.5" />
              <span>{settings.timeLimitMinutes > 0 ? `${settings.timeLimitMinutes} min` : 'Untimed'}</span>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Time Limit */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              Time Limit
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {TIME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSettings(s => ({ ...s, timeLimitMinutes: opt.value }))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border
                    ${settings.timeLimitMinutes === opt.value
                      ? 'bg-red-600 text-white border-red-600 shadow-md'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-600'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {settings.timeLimitMinutes > 0 && questionCount > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ~{Math.round((settings.timeLimitMinutes * 60) / questionCount)}s per question
              </p>
            )}
          </div>

          {/* Toggle Settings */}
          <div className="space-y-4">
            <Card className="border border-gray-200 dark:border-gray-700">
              <CardContent className="p-4 space-y-4">
                {/* Shuffle Questions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Shuffle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Shuffle Questions</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Randomize question order</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.shuffleQuestions}
                    onCheckedChange={(checked) => setSettings(s => ({ ...s, shuffleQuestions: checked }))}
                  />
                </div>

                {/* Lock Answers */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                      <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Lock Answers</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Can&apos;t change once confirmed</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.lockAnswers}
                    onCheckedChange={(checked) => setSettings(s => ({ ...s, lockAnswers: checked }))}
                  />
                </div>

                {/* Show Timer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <Eye className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Show Timer</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Display countdown during exam</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.showTimer}
                    onCheckedChange={(checked) => setSettings(s => ({ ...s, showTimer: checked }))}
                  />
                </div>

                {/* Tab Detection */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Tab Switch Detection</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Track when you leave the exam tab</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.enableTabDetection}
                    onCheckedChange={(checked) => setSettings(s => ({ ...s, enableTabDetection: checked }))}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">Exam Mode Info</p>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-700 dark:text-amber-300">
                <li>• The exam will open in fullscreen mode</li>
                {settings.timeLimitMinutes > 0 && (
                  <li>• Quiz auto-submits when time expires</li>
                )}
                {settings.lockAnswers && (
                  <li>• Answers are locked after confirmation</li>
                )}
                {settings.enableTabDetection && (
                  <li>• Tab switches are tracked and recorded</li>
                )}
                <li>• Exam mode earns 1.5x XP bonus!</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t dark:border-gray-700 flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-700 hover:to-orange-700"
          >
            <GraduationCap className="h-4 w-4 mr-2" />
            Start Exam
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
