import { useState, useRef, useEffect, useCallback, type MutableRefObject } from 'react';
import { toast } from 'sonner';
import { throttle } from 'lodash';

interface UseSpeechRecognitionProps {
    setInputMessage: (message: string) => void;
    resizeTextarea: () => void;
    inputMessageRef: MutableRefObject<string>;
    requestNotificationPermission: () => Promise<boolean>;
    requestMicrophonePermission: () => Promise<boolean>;
    checkMicrophonePermission: () => Promise<'granted' | 'denied' | 'prompt' | 'unknown'>;
}
interface SpeechRecognition extends EventTarget { continuous: boolean; interimResults: boolean; lang: string; start: () => void; stop: () => void; onresult: (event: SpeechRecognitionResultEvent) => void; onerror: (event: SpeechRecognitionErrorEvent) => void; onend: () => void; }
interface SpeechRecognitionResultEvent {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent {
    error: string;
    message?: string;
}
interface SpeechRecognitionResultList {
    [index: number]: SpeechRecognitionResult;
    length: number;
}
interface SpeechRecognitionResult {
    [index: number]: SpeechRecognitionAlternative;
    isFinal: boolean;
}
interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}
declare global {
    interface Window {
        SpeechRecognition: { new(): SpeechRecognition };
        webkitSpeechRecognition: { new(): SpeechRecognition };
    }
}

export const useSpeechRecognition = ({
    setInputMessage,
    resizeTextarea,
    inputMessageRef,
    requestNotificationPermission,
    requestMicrophonePermission,
    checkMicrophonePermission,
}: UseSpeechRecognitionProps) => {
    const [isRecognizing, setIsRecognizing] = useState(false);
    const [micPermissionStatus, setMicPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'checking'>('unknown');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const lastInterimTranscriptRef = useRef<string>('');
    const isRecognizingRef = useRef(false);

    useEffect(() => {
        checkMicrophonePermission().then(status => {
            setMicPermissionStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown');
        });
    }, [checkMicrophonePermission]);

    const resizeTextareaThrottled = useCallback(
        throttle(() => {
            resizeTextarea();
        }, 200),
        [resizeTextarea]
    );

    useEffect(() => {
        const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionConstructor) {
            return;
        }

        const recognition = new SpeechRecognitionConstructor() as SpeechRecognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        (recognition as any).maxAlternatives = 1;

        recognition.onresult = (event: SpeechRecognitionResultEvent) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript = transcript;
                }
            }

            const currentInput = inputMessageRef.current;
            let baseMessage = currentInput;
            const lastInterim = lastInterimTranscriptRef.current;
            
            // Robust stripping: Check endsWith with and without trimming to handle whitespace edge cases
            if (lastInterim) {
                 if (baseMessage.endsWith(lastInterim)) {
                     baseMessage = baseMessage.slice(0, -lastInterim.length);
                 } else if (baseMessage.trimEnd().endsWith(lastInterim.trimEnd())) {
                     // Fallback: try ignoring trailing spaces mismatch
                     const lastInterimTrimmed = lastInterim.trimEnd();
                     const baseTrimmed = baseMessage.trimEnd();
                     // We need to keep the part BEFORE the match
                     // Calculate the index of the match
                     const matchIndex = baseMessage.lastIndexOf(lastInterimTrimmed);
                      if (matchIndex !== -1 && matchIndex + lastInterimTrimmed.length === baseTrimmed.length) {
                           baseMessage = baseMessage.substring(0, matchIndex);
                      }
                 }
            }
            
            baseMessage = baseMessage.trimEnd();
            
            if (finalTranscript) {
                const newMessage = baseMessage + (baseMessage ? ' ' : '') + finalTranscript.trim();
                lastInterimTranscriptRef.current = '';
                // Immediate update for final results to ensure consistency
                setInputMessage(newMessage);
                resizeTextareaThrottled();
            } else if (interimTranscript) {
                const newMessage = baseMessage + (baseMessage ? ' ' : '') + interimTranscript;
                lastInterimTranscriptRef.current = interimTranscript;
                // Immediate update for interim too, to prevent ref staleness causing duplication
                // We only throttle the resize which is the expensive DOM operation
                setInputMessage(newMessage);
                resizeTextareaThrottled();
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error === 'no-speech') {
                return;
            }
            
            // console.error('Speech recognition error:', event.error);
            // Only stop and show error for non-aborted errors
            if (event.error !== 'aborted') {
                setIsRecognizing(false);
                isRecognizingRef.current = false;
                toast.error(`Speech recognition failed: ${event.error}`);
            }
        };

        recognition.onend = () => {
            // Auto-restart if we're supposed to be recognizing
            if (isRecognizingRef.current) {
                try {
                    recognition.start();
                } catch (err) {
                    // console.error('Failed to restart speech recognition:', err);
                    setIsRecognizing(false);
                    isRecognizingRef.current = false;
                }
            } else {
                setIsRecognizing(false);
                lastInterimTranscriptRef.current = '';
            }
        };

        recognitionRef.current = recognition;

        return () => {
            isRecognizingRef.current = false;
            recognition.stop();
        };
    }, [resizeTextareaThrottled, resizeTextarea, setInputMessage]);

    const startRecognition = useCallback(async () => {
        if (!recognitionRef.current) {
            toast.error('Speech recognition is not supported in this browser.');
            return;
        }

        if (isRecognizing) return;

        if (micPermissionStatus !== 'granted') {
            const hasNotificationPermission = await requestNotificationPermission();
            if (!hasNotificationPermission) {
                // Not critical for speech, but good to have
            }

            const hasMicrophonePermission = await requestMicrophonePermission();
            if (!hasMicrophonePermission) {
                setIsRecognizing(false);
                return;
            }
        }

        try {
            lastInterimTranscriptRef.current = '';
            isRecognizingRef.current = true;
            recognitionRef.current.start();
            setIsRecognizing(true);
            toast.info('Listening... Click the mic button again to stop.');
        } catch (error: any) {
            // console.error('Start recognition error:', error);
            toast.error(`Failed to start speech recognition: ${error.message || 'Unknown error'}`);
            setIsRecognizing(false);
            isRecognizingRef.current = false;
        }
    }, [isRecognizing, micPermissionStatus, requestNotificationPermission, requestMicrophonePermission]);

    const stopRecognition = useCallback(() => {
        if (!recognitionRef.current) return;
        if (isRecognizingRef.current) {
            isRecognizingRef.current = false;
            recognitionRef.current.stop();
            setIsRecognizing(false);
            lastInterimTranscriptRef.current = '';
            toast.success('Speech recognition stopped.');
        }
    }, []);

    return { isRecognizing, startRecognition, stopRecognition, micPermissionStatus };
};
