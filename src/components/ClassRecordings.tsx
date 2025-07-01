
import React, { useState } from 'react';
import { Play, FileText, Brain, Clock, BookOpen } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ClassRecording, Quiz } from '../types/Class';
import { VoiceRecorder } from './VoiceRecorder';
import { formatDate } from '../utils/helpers';
import { toast } from 'sonner';

interface ClassRecordingsProps {
  recordings: ClassRecording[];
  onAddRecording: (recording: ClassRecording) => void;
  onGenerateQuiz: (classId: string) => void;
}

export const ClassRecordings: React.FC<ClassRecordingsProps> = ({
  recordings,
  onAddRecording,
  onGenerateQuiz
}) => {
  const [selectedRecording, setSelectedRecording] = useState<ClassRecording | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRecordingComplete = async (audioBlob: Blob, title: string, subject: string) => {
    setIsProcessing(true);
    
    try {
      // Mock AI processing - in real app, you'd send to Supabase Edge Function
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const newRecording: ClassRecording = {
        id: `rec_${Date.now()}`,
        title,
        subject,
        audioUrl: URL.createObjectURL(audioBlob),
        transcript: `This is a mock transcript of the ${subject} class about ${title}. The lecture covered key concepts including theoretical foundations, practical applications, and real-world examples. Students should review the main points discussed and prepare for upcoming assessments.`,
        summary: `Summary: This ${subject} class focused on ${title}. Key topics included fundamental principles, methodology, and practical implementations. Important takeaways for students to remember for exams.`,
        duration: 45 * 60, // 45 minutes
        date: new Date(),
        createdAt: new Date()
      };
      
      onAddRecording(newRecording);
      toast.success('Recording processed and saved!');
    } catch (error) {
      toast.error('Failed to process recording');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Class Recordings</h2>
      </div>

      {isProcessing && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Brain className="h-5 w-5 text-blue-600 animate-pulse" />
              <span>Processing recording with AI...</span>
            </div>
          </CardContent>
        </Card>
      )}

      <VoiceRecorder onRecordingComplete={handleRecordingComplete} />

      <div className="grid gap-4">
        {recordings.map((recording) => (
          <Card key={recording.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{recording.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">{recording.subject}</Badge>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Clock className="h-3 w-3" />
                      {formatDuration(recording.duration)}
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatDate(recording.date)}
                    </span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedRecording(
                    selectedRecording?.id === recording.id ? null : recording
                  )}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {selectedRecording?.id === recording.id ? 'Hide' : 'View'} Details
                </Button>
              </div>
            </CardHeader>
            
            {selectedRecording?.id === recording.id && (
              <CardContent className="pt-0">
                <div className="space-y-4">
                  <audio controls className="w-full">
                    <source src={recording.audioUrl} type="audio/wav" />
                  </audio>
                  
                  <div>
                    <h4 className="font-semibold mb-2">AI Summary</h4>
                    <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded">
                      {recording.summary}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Transcript</h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                      {recording.transcript}
                    </p>
                  </div>
                  
                  <Button 
                    onClick={() => onGenerateQuiz(recording.id)}
                    className="w-full"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Generate Quiz from this Class
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {recordings.length === 0 && (
        <Card className="text-center py-8">
          <CardContent>
            <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-500 mb-2">No recordings yet</h3>
            <p className="text-gray-400">Start recording your first class to get AI-powered summaries and transcripts</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
