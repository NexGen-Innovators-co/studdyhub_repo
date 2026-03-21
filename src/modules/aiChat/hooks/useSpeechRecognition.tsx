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
    // Finals from the current active recognition session
    const currentSessionFinalsRef = useRef<string>('');
    // What onresult last wrote to the textarea, so we can detect manual user edits
    const lastSetValueRef = useRef<string>('');
    const finalResultsByIndexRef = useRef<Map<number, string>>(new Map());
    // FIX: The Web Speech API sends CUMULATIVE results — every onresult event
    // replays ALL results from index 0 of the current session. When the user
    // manually edits and we clear finalResultsByIndexRef, the very next onresult
    // re-adds all the old finals back from the browser's cumulative payload,
    // causing old speech to reappear and double up with typed text.
    //
    // Solution: track a "floor" index. After a manual edit we record the highest
    // result index seen so far. Any result at or below that floor is from before
    // the edit and must be ignored in all future onresult events this session.
    const resultIndexFloorRef = useRef<number>(-1);

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
            // Detect manual user edits and restart tracking from current text.
            const currentInput = inputMessageRef.current;
            if (currentInput !== lastSetValueRef.current) {
                preExistingTextRef.current = currentInput.trimEnd();
                previousSessionsTextRef.current = '';
                currentSessionFinalsRef.current = '';
                // Record the highest result index seen so far as the new floor.
                // The browser will keep replaying results from index 0, so we
                // must ignore everything at or below this point going forward.
                const currentMaxIndex = finalResultsByIndexRef.current.size > 0
                    ? Math.max(...finalResultsByIndexRef.current.keys())
                    : event.results.length - 1;
                resultIndexFloorRef.current = currentMaxIndex;
                finalResultsByIndexRef.current.clear();
            }

            let interimTranscript = '';

            for (let i = 0; i < event.results.length; i++) {
                // Skip any result that was finalised before the last manual edit
                if (i <= resultIndexFloorRef.current) continue;

                const transcript = event.results[i][0].transcript.trim();
                if (event.results[i].isFinal) {
                    if (transcript) {
                        finalResultsByIndexRef.current.set(i, transcript);
                    }
                } else if (transcript) {
                    interimTranscript = transcript;
                }
            }

            // Build all current final text in order, robust to browsers sending deltas or cumulative sets.
            const sessionFinals = Array.from(finalResultsByIndexRef.current.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([, text]) => text)
                .join(' ')
                .trim();

            currentSessionFinalsRef.current = sessionFinals;

            const combinedFinals = [previousSessionsTextRef.current, currentSessionFinalsRef.current]
                .filter(Boolean)
                .join(' ')
                .trim();

            const base = preExistingTextRef.current;
            const parts = [base, combinedFinals, interimTranscript].filter(Boolean);
            const newMessage = parts.join(' ').replace(/\s+/g, ' ').trim();

            lastSetValueRef.current = newMessage;
            setInputMessage(newMessage);
            resizeTextareaThrottled();
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error === 'no-speech') {
                return;
            }

            // Only stop and show error for non-aborted errors
            if (event.error !== 'aborted') {
                setIsRecognizing(false);
                isRecognizingRef.current = false;
                toast.error(`Speech recognition failed: ${event.error}`);
            }
        };

        recognition.onend = () => {
            // onresult's edit detection only fires while speech is actively coming in.
            // Any manual edit made during a silence gap (before onend fires) is invisible
            // to onresult. Repeating the same check here ensures edits made during a
            // pause always win over stale finals.
            const currentInput = inputMessageRef.current;
            if (currentInput !== lastSetValueRef.current) {
                // User edited manually — trust their version, discard stale finals entirely
                const currentMaxIndex = finalResultsByIndexRef.current.size > 0
                    ? Math.max(...finalResultsByIndexRef.current.keys())
                    : -1;
                resultIndexFloorRef.current = currentMaxIndex;
                preExistingTextRef.current = currentInput.trimEnd();
                previousSessionsTextRef.current = '';
                currentSessionFinalsRef.current = '';
                finalResultsByIndexRef.current.clear();
                lastSetValueRef.current = currentInput;
            } else {
                const existingFinal = [previousSessionsTextRef.current, currentSessionFinalsRef.current]
                    .filter(Boolean)
                    .join(' ')
                    .trim();

                if (existingFinal) {
                    const finalMessage = [preExistingTextRef.current, existingFinal]
                        .filter(Boolean)
                        .join(' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    setInputMessage(finalMessage);
                    // Bake everything into preExistingTextRef and reset
                    // previousSessionsTextRef to '' (not finalMessage) so the next
                    // auto-restarted session doesn't re-include already-committed
                    // text and cause the looping/duplication bug.
                    preExistingTextRef.current = finalMessage;
                    previousSessionsTextRef.current = '';
                    currentSessionFinalsRef.current = '';
                    finalResultsByIndexRef.current.clear();
                    // Reset the floor too — new session starts from scratch
                    resultIndexFloorRef.current = -1;
                }
            }

            if (isRecognizingRef.current) {
                try {
                    recognition.start();
                } catch (err) {
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
            resultIndexFloorRef.current = -1;
            isRecognizingRef.current = true;
            recognitionRef.current.start();
            setIsRecognizing(true);
            toast.info('Listening... Click the mic button again to stop.');
        } catch (error: any) {
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
            // Keep recognized text in place so users don't lose it
            preExistingTextRef.current = inputMessageRef.current.trimEnd();
            toast.success('Speech recognition stopped.');
        }
    }, [inputMessageRef]);

    return { isRecognizing, startRecognition, stopRecognition, micPermissionStatus };
};