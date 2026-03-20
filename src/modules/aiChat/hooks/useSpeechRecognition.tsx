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
    // Track text components separately to avoid fragile stripping
    const preExistingTextRef = useRef<string>('');
    // Finals from previous (auto-restarted) recognition sessions
    const previousSessionsTextRef = useRef<string>('');
    // Finals from the current active recognition session (rebuilt from event.results each onresult)
    const currentSessionFinalsRef = useRef<string>('');
    // What onresult last wrote to the textarea, so we can detect manual user edits
    const lastSetValueRef = useRef<string>('');

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
            // Detect if the user manually edited the textarea (e.g. select-all + delete)
            // by comparing the current value with what we last set.
            const currentInput = inputMessageRef.current;
            if (currentInput !== lastSetValueRef.current) {
                // User changed the text — re-sync: treat current input as new base
                preExistingTextRef.current = currentInput.trimEnd();
                previousSessionsTextRef.current = '';
                currentSessionFinalsRef.current = '';
            }

            // Rebuild *this session's* finals from all results (idempotent)
            // to avoid double-counting when the browser re-reports indices.
            let sessionFinals = '';
            let interimTranscript = '';

            for (let i = 0; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    sessionFinals += transcript + ' ';
                } else {
                    interimTranscript = transcript;
                }
            }

            // Overwrite (not append) so repeated events can't duplicate text
            currentSessionFinalsRef.current = sessionFinals;

            // Reconstruct the full message from known components
            const base = preExistingTextRef.current;
            const allFinals = (previousSessionsTextRef.current + currentSessionFinalsRef.current).trimEnd();
            const parts = [base, allFinals, interimTranscript].filter(Boolean);
            const newMessage = parts.join(' ');

            lastSetValueRef.current = newMessage;
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
                // Carry over this session's finals before restarting
                previousSessionsTextRef.current += currentSessionFinalsRef.current;
                currentSessionFinalsRef.current = '';
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
            previousSessionsTextRef.current = '';
            currentSessionFinalsRef.current = '';
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
            previousSessionsTextRef.current = '';
            currentSessionFinalsRef.current = '';
            toast.success('Speech recognition stopped.');
        }
    }, []);

    return { isRecognizing, startRecognition, stopRecognition, micPermissionStatus };
};
