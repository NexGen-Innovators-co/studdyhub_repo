// components/VoiceRecorder.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../../ui/button';
import { Mic, StopCircle, Play, Pause, Download, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
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

  // Enhanced browser detection
  const detectBrowser = useCallback(() => {
    const userAgent = navigator.userAgent;
    const issues: string[] = [];
    let browserName = 'Unknown';
    let isSupported = true;

    if (/Edg\//.test(userAgent)) {
      browserName = 'Microsoft Edge';
      // Check Edge version
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
      // Safari has some MediaRecorder limitations
      if (!window.MediaRecorder) {
        isSupported = false;
        issues.push('Safari does not support MediaRecorder API. Please use Chrome, Firefox, or Edge.');
      }
    }

    // Check for required APIs
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
      issues.push('Secure context (HTTPS) is required for audio recording.');
    }

    return { isSupported, browserName, issues };
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      // For Edge and other browsers, try to get permission first
      if (browserSupport.browserName === 'Microsoft Edge') {
        try {
          // Try to get user media first to trigger permission prompt
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          return true;
        } catch (err: any) {
          if (err.name === 'NotAllowedError') {
            toast.error('Microphone access denied. Please click the microphone icon in your address bar and allow access, then reload the page.');
            return false;
          }
          throw err;
        }
      }

      // For other browsers, use permissions API if available
      if (navigator.permissions && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (permissionStatus.state === 'denied') {
          toast.error(
            browserSupport.browserName === 'Microsoft Edge'
              ? 'Microphone access is blocked. Please click the microphone icon in your address bar, allow access, and reload the page.'
              : 'Microphone access is blocked. Please enable it in your browser settings and reload the page.'
          );
          return false;
        }
        return permissionStatus.state === 'granted' || permissionStatus.state === 'prompt';
      }

      return true; // If permissions API not available, assume we can try
    } catch (err) {
      //console.error('Error checking microphone permission:', err);
      return false;
    }
  };

  const checkMicrophoneAvailability = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some(device => device.kind === 'audioinput');
      if (!hasMic) {
        toast.error('No microphone detected. Please connect a microphone and try again.');
        return false;
      }
      return true;
    } catch (err) {
      //console.error('Error checking devices:', err);
      return false;
    }
  };

  const getSupportedMimeType = () => {
    // Check supported MIME types in order of preference
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    // Fallback - let MediaRecorder choose
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
    return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const startRecording = async () => {
    let stream: MediaStream | null = null;
    try {
      if (!browserSupport.isSupported) {
        toast.error(`Recording not supported: ${browserSupport.issues.join(' ')}`);
        return;
      }

      const hasMic = await checkMicrophoneAvailability();
      if (!hasMic) {
        return;
      }

      const canAccessMic = await checkMicrophonePermission();
      if (!canAccessMic) {
        return;
      }

      // Get audio stream with constraints optimized for speech
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      };

      stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Get the best supported MIME type
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;

      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const mimeTypeUsed = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeTypeUsed });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stopTimer();
      };

      mediaRecorderRef.current.onerror = (event) => {
        //console.error('MediaRecorder error:', event);
        toast.error('Recording error occurred. Please try again.');
        setIsRecording(false);
        stopTimer();
      };

      // Start recording with timeslice for Edge compatibility
      mediaRecorderRef.current.start(1000); // 1 second timeslice
      setIsRecording(true);
      setAudioBlob(null);
      setAudioUrl(null);
      setTimer(0);
      startTimer();
      toast.info('Recording started...');
    } catch (err: any) {

      let errorMessage = 'Failed to start recording. ';

      if (err.name === 'NotAllowedError') {
        errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Microphone is being used by another application. Please close other applications and try again.';
      } else if (browserSupport.browserName === 'Microsoft Edge') {
        errorMessage += 'If you\'re using Edge, please ensure you\'re using the latest version and have allowed microphone access.';
      }

      toast.error(errorMessage);

      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
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
      audioPlayerRef.current.play().catch(err => {
        //console.error('Error playing audio:', err);
        toast.error('Could not play recording. Try downloading it instead.');
      });
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

      // Get file extension based on blob type
      const extension = audioBlob.type.includes('webm') ? 'webm' :
        audioBlob.type.includes('mp4') ? 'mp4' :
          audioBlob.type.includes('ogg') ? 'ogg' : 'webm';

      a.download = `${recordingTitle || 'recorded_audio'}.${extension}`;
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
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
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
        //console.error('Error saving recording:', error);
        toast.error('Failed to save recording.');
      } finally {
        setIsSaving(false);
      }
    } else {
      toast.error('Please record audio and provide a title and subject before saving.');
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
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [detectBrowser, stopTimer]);

  return (
    <Card className="shadow-sm dark:bg-gray-800 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Mic className="h-6 w-6 text-green-600" /> Voice Recorder
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Browser: {browserSupport.browserName}
        </p>
        {!browserSupport.isSupported && (
          <div className="text-red-500 text-sm space-y-1">
            <p className="font-medium">Recording not supported:</p>
            {browserSupport.issues.map((issue, index) => (
              <p key={index}>• {issue}</p>
            ))}
          </div>
        )}
        {micPermissionStatus === 'denied' && browserSupport.isSupported && (
          <p className="text-red-500 text-sm">
            Microphone access is blocked.
            {browserSupport.browserName === 'Microsoft Edge' ? (
              <> Please click the microphone icon in your address bar, allow access, and reload the page.</>
            ) : (
              <> Please enable it in your browser settings and reload the page.</>
            )}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center gap-4">
          {!isRecording && !audioUrl && (
            <Button
              onClick={startRecording}
              className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
              disabled={isSaving || !browserSupport.isSupported || micPermissionStatus === 'denied'}
            >
              <Mic className="h-5 w-5 mr-2" /> Start Recording
            </Button>
          )}
          {isRecording && (
            <Button
              onClick={stopRecording}
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
            >
              <StopCircle className="h-5 w-5 mr-2" /> Stop Recording
            </Button>
          )}
          {audioUrl && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={isPlaying ? pauseRecording : playRecording}
                className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
                disabled={isSaving}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button
                variant="outline"
                onClick={downloadRecording}
                className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
                disabled={isSaving}
              >
                <Download className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                onClick={clearRecording}
                className="text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900"
                disabled={isSaving}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>

        <div className="text-center text-2xl font-mono text-gray-700 dark:text-gray-300">
          {formatTime(timer)}
        </div>

        {audioUrl && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Recording Title (e.g., 'Lecture on AI')"
              value={recordingTitle}
              onChange={(e) => setRecordingTitle(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 placeholder:dark:text-gray-400"
              disabled={isSaving}
            />
            <input
              type="text"
              placeholder="Subject (e.g., 'Computer Science')"
              value={recordingSubject}
              onChange={(e) => setRecordingSubject(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 placeholder:dark:text-gray-400"
              disabled={isSaving}
            />
            <Button
              onClick={saveRecording}
              className="w-full bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
              disabled={isSaving || !recordingTitle || !recordingSubject}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Saving & Processing...
                </>
              ) : (
                'Save Recording'
              )}
            </Button>
          </div>
        )}
        <audio ref={audioPlayerRef} onEnded={() => setIsPlaying(false)} />
      </CardContent>
    </Card>
  );
};