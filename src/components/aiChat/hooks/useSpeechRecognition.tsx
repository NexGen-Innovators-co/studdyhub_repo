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
    const isRecognizingRef = useRef(false);
    // Accumulator approach: track text components separately to avoid fragile stripping
    const preExistingTextRef = useRef<string>('');
    const accumulatedFinalRef = useRef<string>('');

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
            let newFinals = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    newFinals += transcript + ' ';
                } else {
                    interimTranscript = transcript;
                }
            }

            if (newFinals) {
                accumulatedFinalRef.current += newFinals;
            }

            // Reconstruct the full message from known components
            const base = preExistingTextRef.current;
            const finals = accumulatedFinalRef.current.trimEnd();
            const parts = [base, finals, interimTranscript].filter(Boolean);
            const newMessage = parts.join(' ');

            setInputMessage(newMessage);
            resizeTextareaThrottled();
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
            preExistingTextRef.current = inputMessageRef.current.trimEnd();
            accumulatedFinalRef.current = '';
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
            preExistingTextRef.current = '';
            accumulatedFinalRef.current = '';
            toast.success('Speech recognition stopped.');
        }
    }, []);

    return { isRecognizing, startRecognition, stopRecognition, micPermissionStatus };
};
