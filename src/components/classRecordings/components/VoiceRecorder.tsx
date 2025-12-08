// Redesigned VoiceRecorder with modern UI
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../../ui/button';
import { Mic, Square, Play, Pause, Download, Trash2, Loader2, Radio } from 'lucide-react';
import { toast } from 'sonner';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, title: string, subject: string) => Promise<void>;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTitle, setRecordingTitle] = useState('');
  const [recordingSubject, setRecordingSubject] = useState('');
  const [timer, setTimer] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [micPermissionStatus, setMicPermissionStatus] = useState<string | null>(null);
  const [browserSupport, setBrowserSupport] = useState<{
    isSupported: boolean;
    browserName: string;
    issues: string[];
  }>({ isSupported: true, browserName: '', issues: [] });

  const detectBrowser = useCallback(() => {
    const userAgent = navigator.userAgent;
    const issues: string[] = [];
    let browserName = 'Unknown';
    let isSupported = true;

    if (/Edg\//.test(userAgent)) {
      browserName = 'Microsoft Edge';
      const edgeVersion = userAgent.match(/Edg\/(\d+)/);
      const version = edgeVersion ? parseInt(edgeVersion[1]) : 0;
      if (version < 79) {
        isSupported = false;
        issues.push('Edge version is too old. Please update to Edge 79 or later.');
      }
    } else if (/Chrome\//.test(userAgent) && !/Edg\//.test(userAgent)) {
      browserName = 'Chrome';
    } else if (/Firefox\//.test(userAgent)) {
      browserName = 'Firefox';
    } else if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) {
      browserName = 'Safari';
      if (!window.MediaRecorder) {
        isSupported = false;
        issues.push('Safari does not support MediaRecorder API.');
      }
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      isSupported = false;
      issues.push('getUserMedia API is not supported.');
    }
    if (!window.MediaRecorder) {
      isSupported = false;
      issues.push('MediaRecorder API is not supported.');
    }
    if (!window.isSecureContext) {
      isSupported = false;
      issues.push('Secure context (HTTPS) is required.');
    }

    return { isSupported, browserName, issues };
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      if (browserSupport.browserName === 'Microsoft Edge') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          return true;
        } catch (err: any) {
          if (err.name === 'NotAllowedError') {
            toast.error('Microphone access denied. Please allow access and reload.');
            return false;
          }
          throw err;
        }
      }
      if (navigator.permissions && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (permissionStatus.state === 'denied') {
          toast.error('Microphone access is blocked. Please enable it in your browser settings.');
          return false;
        }
        return permissionStatus.state === 'granted' || permissionStatus.state === 'prompt';
      }
      return true;
    } catch (err) {
      return false;
    }
  };

  const checkMicrophoneAvailability = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some(device => device.kind === 'audioinput');
      if (!hasMic) {
        toast.error('No microphone detected. Please connect a microphone.');
        return false;
      }
      return true;
    } catch (err) {
      return false;
    }
  };

  const getSupportedMimeType = () => {
    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/wav'];
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    return undefined;
  };

  const startTimer = useCallback(() => {
    timerIntervalRef.current = setInterval(() => {
      setTimer((prevTimer) => prevTimer + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    let stream: MediaStream | null = null;
    try {
      if (!browserSupport.isSupported) {
        toast.error(`Recording not supported: ${browserSupport.issues.join(' ')}`);
        return;
      }
      const hasMic = await checkMicrophoneAvailability();
      if (!hasMic) return;
      const canAccessMic = await checkMicrophonePermission();
      if (!canAccessMic) return;

      const constraints = {
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 44100 }
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const mimeTypeUsed = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeTypeUsed });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stopTimer();
      };

      mediaRecorderRef.current.onerror = () => {
        toast.error('Recording error occurred. Please try again.');
        setIsRecording(false);
        stopTimer();
      };

      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setAudioBlob(null);
      setAudioUrl(null);
      setTimer(0);
      startTimer();
      toast.info('Recording started...');
    } catch (err: any) {
      let errorMessage = 'Failed to start recording. ';
      if (err.name === 'NotAllowedError') errorMessage = 'Microphone access denied.';
      else if (err.name === 'NotFoundError') errorMessage = 'No microphone found.';
      else if (err.name === 'NotReadableError') errorMessage = 'Microphone is in use by another app.';
      toast.error(errorMessage);
      if (stream) stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      stopTimer();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      toast.success('Recording stopped.');
    }
  };

  const playRecording = () => {
    if (audioUrl && audioPlayerRef.current) {
      audioPlayerRef.current.play().catch(() => toast.error('Could not play recording.'));
      setIsPlaying(true);
    }
  };

  const pauseRecording = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    }
  };

  const downloadRecording = () => {
    if (audioUrl && audioBlob) {
      const a = document.createElement('a');
      a.href = audioUrl;
      const extension = audioBlob.type.includes('webm') ? 'webm' : audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
      a.download = `${recordingTitle || 'recording'}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Recording downloaded!');
    }
  };

  const clearRecording = () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setIsRecording(false);
    setIsPlaying(false);
    setTimer(0);
    stopTimer();
    setRecordingTitle('');
    setRecordingSubject('');
    toast.info('Recording cleared.');
  };

  const saveRecording = async () => {
    if (audioBlob && recordingTitle && recordingSubject) {
      setIsSaving(true);
      try {
        await onRecordingComplete(audioBlob, recordingTitle, recordingSubject);
        clearRecording();
        toast.success('Recording saved and sent for processing!');
      } catch (error) {
        toast.error('Failed to save recording.');
      } finally {
        setIsSaving(false);
      }
    } else {
      toast.error('Please provide a title and subject before saving.');
    }
  };

  useEffect(() => {
    const support = detectBrowser();
    setBrowserSupport(support);
    if (support.isSupported) {
      checkMicrophonePermission().then((canAccess) => {
        setMicPermissionStatus(canAccess ? 'granted' : 'denied');
      });
    } else {
      setMicPermissionStatus('unsupported');
    }

    return () => {
      stopTimer();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [detectBrowser, stopTimer]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm mb-2">
          <Radio className="h-3 w-3" />
          {browserSupport.browserName}
        </div>
        <h3 className="text-xl font-bold">Voice Recorder</h3>
        <p className="text-sm text-muted-foreground">Record lectures and let AI transcribe them</p>
      </div>

      {/* Recording Visualization */}
      <div className="flex flex-col items-center justify-center py-8">
        <div className={`relative ${isRecording ? 'animate-pulse' : ''}`}>
          <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
            isRecording 
              ? 'bg-red-100 dark:bg-red-900/30' 
              : audioUrl 
                ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                : 'bg-muted'
          }`}>
            {isRecording && (
              <>
                <div className="absolute inset-0 rounded-full bg-red-400/20 animate-ping" />
                <div className="absolute inset-2 rounded-full bg-red-400/20 animate-ping" style={{ animationDelay: '0.2s' }} />
              </>
            )}
            <Mic className={`h-12 w-12 ${
              isRecording 
                ? 'text-red-500' 
                : audioUrl 
                  ? 'text-emerald-500' 
                  : 'text-muted-foreground'
            }`} />
          </div>
        </div>

        {/* Timer */}
        <div className="mt-4 text-4xl font-mono font-bold text-foreground">
          {formatTime(timer)}
        </div>

        {/* Recording Controls */}
        <div className="flex items-center gap-3 mt-6">
          {!isRecording && !audioUrl && (
            <Button
              onClick={startRecording}
              size="lg"
              className="rounded-full h-14 px-8 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg"
              disabled={isSaving || !browserSupport.isSupported || micPermissionStatus === 'denied'}
            >
              <Mic className="h-5 w-5 mr-2" /> Start Recording
            </Button>
          )}
          
          {isRecording && (
            <Button
              onClick={stopRecording}
              size="lg"
              className="rounded-full h-14 px-8 bg-red-500 hover:bg-red-600 text-white shadow-lg"
            >
              <Square className="h-5 w-5 mr-2" /> Stop
            </Button>
          )}
          
          {audioUrl && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={isPlaying ? pauseRecording : playRecording}
                className="rounded-full h-12 w-12 p-0"
                disabled={isSaving}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={downloadRecording}
                className="rounded-full h-12 w-12 p-0"
                disabled={isSaving}
              >
                <Download className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={clearRecording}
                className="rounded-full h-12 w-12 p-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                disabled={isSaving}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Save Form */}
      {audioUrl && (
        <div className="space-y-4 pt-4 border-t">
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <input
                type="text"
                placeholder="e.g., Lecture on Machine Learning"
                value={recordingTitle}
                onChange={(e) => setRecordingTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                disabled={isSaving}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Subject</label>
              <input
                type="text"
                placeholder="e.g., Computer Science"
                value={recordingSubject}
                onChange={(e) => setRecordingSubject(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                disabled={isSaving}
              />
            </div>
          </div>
          <Button
            onClick={saveRecording}
            className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg"
            disabled={isSaving || !recordingTitle || !recordingSubject}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Processing...
              </>
            ) : (
              'Save & Process Recording'
            )}
          </Button>
        </div>
      )}

      {/* Warnings */}
      {!browserSupport.isSupported && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">Recording not supported:</p>
          {browserSupport.issues.map((issue, index) => (
            <p key={index} className="text-sm text-red-500 dark:text-red-300">• {issue}</p>
          ))}
        </div>
      )}

      {micPermissionStatus === 'denied' && browserSupport.isSupported && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Microphone access is blocked. Please enable it in your browser settings and reload the page.
          </p>
        </div>
      )}

      <audio ref={audioPlayerRef} onEnded={() => setIsPlaying(false)} />
    </div>
  );
};
