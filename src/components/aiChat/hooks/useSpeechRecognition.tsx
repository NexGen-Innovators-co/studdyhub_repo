import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { throttle } from 'lodash';

interface UseSpeechRecognitionProps {
    setInputMessage: (message: string) => void;
    resizeTextarea: () => void;
    inputMessage: string;
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
    inputMessage,
    requestNotificationPermission,
    requestMicrophonePermission,
    checkMicrophonePermission,
}: UseSpeechRecognitionProps) => {
    const [isRecognizing, setIsRecognizing] = useState(false);
    const [micPermissionStatus, setMicPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'checking'>('unknown');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const lastInterimTranscriptRef = useRef<string>('');

    useEffect(() => {
        checkMicrophonePermission().then(status => {
            setMicPermissionStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown');
        });
    }, [checkMicrophonePermission]);

    const throttledSetSpeechInput = useCallback(
        throttle((newMessage: string) => {
            setInputMessage(newMessage);
            resizeTextarea();
        }, 200),
        [setInputMessage, resizeTextarea]
    );

    useEffect(() => {
        const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionConstructor) {
            ////console.warn('SpeechRecognition API not supported in this browser.');
            return;
        }

        recognitionRef.current = new SpeechRecognitionConstructor() as SpeechRecognition;
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';
        (recognitionRef.current as any).maxAlternatives = 1;

        recognitionRef.current.onresult = (event: SpeechRecognitionResultEvent) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript.trim();
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript = transcript;
                }
            }

            const baseMessage = inputMessage.replace(lastInterimTranscriptRef.current, '').trim();
            if (finalTranscript) {
                const newMessage = baseMessage + (baseMessage ? ' ' : '') + finalTranscript.trim();
                lastInterimTranscriptRef.current = '';
                setInputMessage(newMessage);
                resizeTextarea();
            } else if (interimTranscript) {
                const newMessage = baseMessage + (baseMessage ? ' ' : '') + interimTranscript;
                lastInterimTranscriptRef.current = interimTranscript;
                throttledSetSpeechInput(newMessage);
            }
        };

        recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
            ////console.error('Speech recognition error:', event.error, event.message);
            setIsRecognizing(false);
            toast.error(`Speech recognition failed: ${event.error}`);
        };

        recognitionRef.current.onend = () => {
            setIsRecognizing(false);
            lastInterimTranscriptRef.current = '';
        };

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [inputMessage, throttledSetSpeechInput, resizeTextarea, setInputMessage]);

    const startRecognition = useCallback(async () => {
        if (!recognitionRef.current) {
            toast.error('Speech recognition is not supported in this browser.');
            return;
        }

        if (isRecognizing) return;

        if (micPermissionStatus !== 'granted') {
            const hasNotificationPermission = await requestNotificationPermission();
            if (!hasNotificationPermission) {
                ////console.warn("Notification permission not granted, proceeding without notifications.");
            }

            const hasMicrophonePermission = await requestMicrophonePermission();
            if (!hasMicrophonePermission) {
                setIsRecognizing(false);
                return;
            }
        }

        try {
            lastInterimTranscriptRef.current = '';
            recognitionRef.current.start();
            setIsRecognizing(true);
            toast.info('Listening... Click the mic button again to stop.');
        } catch (error: any) {
            ////console.error('Error starting speech recognition:', error);
            toast.error(`Failed to start speech recognition: ${error.message || 'Unknown error'}`);
            setIsRecognizing(false);
        }
    }, [isRecognizing, micPermissionStatus, requestNotificationPermission, requestMicrophonePermission]);

    const stopRecognition = useCallback(() => {
        if (!recognitionRef.current) return;
        if (isRecognizing) {
            recognitionRef.current.stop();
            setIsRecognizing(false);
            lastInterimTranscriptRef.current = '';
            toast.success('Speech recognition stopped.');
        }
    }, [isRecognizing]);

    return { isRecognizing, startRecognition, stopRecognition, micPermissionStatus };
};