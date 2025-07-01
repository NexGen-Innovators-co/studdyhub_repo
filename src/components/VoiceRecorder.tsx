
import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square, Play, Pause, Upload } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { toast } from 'sonner';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, title: string, subject: string) => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      toast.success('Recording started');
    } catch (error) {
      toast.error('Failed to access microphone');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setDuration(prev => prev + 1);
        }, 1000);
        setIsPaused(false);
        toast.success('Recording resumed');
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        setIsPaused(true);
        toast.success('Recording paused');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      toast.success('Recording stopped');
    }
  };

  const handleSaveRecording = () => {
    if (!audioUrl || !title.trim() || !subject.trim()) {
      toast.error('Please provide title and subject for the recording');
      return;
    }

    fetch(audioUrl)
      .then(res => res.blob())
      .then(blob => {
        onRecordingComplete(blob, title, subject);
        // Reset form
        setAudioUrl('');
        setTitle('');
        setSubject('');
        setDuration(0);
        toast.success('Recording saved successfully!');
      });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Voice Recorder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-3xl font-mono mb-4">
            {formatDuration(duration)}
          </div>
          
          <div className="flex justify-center gap-2 mb-4">
            {!isRecording ? (
              <Button 
                onClick={startRecording}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                <Mic className="h-4 w-4 mr-2" />
                Start Recording
              </Button>
            ) : (
              <>
                <Button 
                  onClick={pauseRecording}
                  variant="outline"
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </Button>
                <Button 
                  onClick={stopRecording}
                  variant="destructive"
                >
                  <Square className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {audioUrl && (
          <div className="space-y-3">
            <audio controls className="w-full">
              <source src={audioUrl} type="audio/wav" />
            </audio>
            
            <Input
              placeholder="Recording title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            
            <Input
              placeholder="Subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            
            <Button 
              onClick={handleSaveRecording}
              className="w-full"
              disabled={!title.trim() || !subject.trim()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Save & Process
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
