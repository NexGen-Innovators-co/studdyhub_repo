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

// ─── ANDROID / SAMSUNG BEHAVIOUR NOTES ────────────────────────────────────────
//
// Android Chrome Web Speech API behaves very differently from desktop:
//
//  1. KEYBOARD INTERFERENCE — Samsung keyboard silently modifies the textarea
//     between recognition events (trailing spaces from autocomplete, first-letter
//     capitalisation, etc.).  This fires onChange → updates inputMessageRef
//     without touching lastSetValueRef → the edit-detection check sees a
//     mismatch → preExistingTextRef keeps growing → words repeat on every cycle.
//     FIX: normalise both strings before comparing (trim + collapse whitespace).
//
//  2. MIC-DROP WITHOUT FINAL — Android fires onend between every few words,
//     often without ever sending isFinal=true.  The current session finals are
//     empty so preExistingTextRef never advances; when the mic restarts from
//     silence the new interim starts appending onto "" instead of the spoken text.
//     FIX: commit the current interim as preExistingTextRef in onend when there
//     are no finals.
//
//  3. REPLAY IN NEW SESSION — When recognition restarts, Android re-sends the
//     full transcript from the beginning of its audio buffer as the first interim
//     of the new session.  Combined with fix #2 this would double the text:
//     preExisting="so it's getting" + replayed interim="so it's getting and" =
//     "so it's getting so it's getting and".
//     FIX: track lastSessionInterimRef.  If the new session's growing interim
//     starts with (or equals) that value, strip the known-prefix so only
//     genuinely NEW speech is appended to preExistingTextRef.
//
// ──────────────────────────────────────────────────────────────────────────────

/** Trim + collapse all whitespace.  Used for edit-detection comparison only. */
function normalise(s: string): string {
    return s.trim().replace(/\s+/g, ' ');
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

    const preExistingTextRef = useRef<string>('');
    const previousSessionsTextRef = useRef<string>('');
    const currentSessionFinalsRef = useRef<string>('');
    const lastSetValueRef = useRef<string>('');
    const finalResultsByIndexRef = useRef<Map<number, string>>(new Map());
    const resultIndexFloorRef = useRef<number>(-1);

    // ANDROID FIX #3 — the interim text that was showing when the last
    // no-final onend fired.  Used to strip Android's session-replay prefix.
    const lastSessionInterimRef = useRef<string>('');

    useEffect(() => {
        checkMicrophonePermission().then(status => {
            setMicPermissionStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown');
        });
    }, [checkMicrophonePermission]);

    const resizeTextareaThrottled = useCallback(
        throttle(() => { resizeTextarea(); }, 200),
        [resizeTextarea]
    );

    useEffect(() => {
        const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionConstructor) return;

        const recognition = new SpeechRecognitionConstructor() as SpeechRecognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        (recognition as any).maxAlternatives = 1;

        recognition.onresult = (event: SpeechRecognitionResultEvent) => {
            const currentInput = inputMessageRef.current;

            // ── EDIT DETECTION ───────────────────────────────────────────────
            // ANDROID FIX #1: Samsung keyboard injects whitespace / capitalisation
            // changes into the textarea between events.  A strict equality check
            // would falsely flag these as manual edits, causing preExistingTextRef
            // to accumulate stale text and words to repeat.  Use normalised
            // comparison so only genuine content changes are treated as edits.
            if (normalise(currentInput) !== normalise(lastSetValueRef.current)) {
                preExistingTextRef.current = currentInput.trimEnd();
                previousSessionsTextRef.current = '';
                currentSessionFinalsRef.current = '';
                const currentMaxIndex = finalResultsByIndexRef.current.size > 0
                    ? Math.max(...finalResultsByIndexRef.current.keys())
                    : event.results.length - 1;
                resultIndexFloorRef.current = currentMaxIndex;
                finalResultsByIndexRef.current.clear();
                // A real user edit invalidates any saved Android replay prefix
                lastSessionInterimRef.current = '';
            }

            let interimTranscript = '';

            for (let i = 0; i < event.results.length; i++) {
                if (i <= resultIndexFloorRef.current) continue;

                const transcript = event.results[i][0].transcript.trim();
                if (event.results[i].isFinal) {
                    if (transcript) {
                        finalResultsByIndexRef.current.set(i, transcript);
                    }
                    // A genuine final result means no Android replay in this session
                    lastSessionInterimRef.current = '';
                } else if (transcript) {
                    interimTranscript = transcript;
                }
            }

            // ── ANDROID FIX #3: strip replay prefix ─────────────────────────
            // Android re-sends the full transcript from the start of its audio
            // buffer when a new session begins.  If the growing interim is just
            // the replayed prefix (or extends it), strip the known part so only
            // genuinely new speech is shown.
            if (lastSessionInterimRef.current && interimTranscript) {
                const phantom = lastSessionInterimRef.current;
                if (interimTranscript === phantom || phantom.startsWith(interimTranscript)) {
                    // Still replaying — suppress until we see something genuinely new
                    interimTranscript = '';
                } else if (interimTranscript.startsWith(phantom)) {
                    // Past the replay point — keep only the new portion
                    interimTranscript = interimTranscript.slice(phantom.length).trim();
                    // Once we've consumed past the phantom, clear it
                    if (!interimTranscript) {
                        interimTranscript = '';
                    } else {
                        lastSessionInterimRef.current = '';
                    }
                } else {
                    // Genuinely different speech — clear the phantom
                    lastSessionInterimRef.current = '';
                }
            }

            const sessionFinals = Array.from(finalResultsByIndexRef.current.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([, text]) => text)
                .join(' ')
                .trim();

            currentSessionFinalsRef.current = sessionFinals;

            const combinedFinals = [previousSessionsTextRef.current, currentSessionFinalsRef.current]
                .filter(Boolean).join(' ').trim();

            const base = preExistingTextRef.current;
            const parts = [base, combinedFinals, interimTranscript].filter(Boolean);
            const newMessage = parts.join(' ').replace(/\s+/g, ' ').trim();

            lastSetValueRef.current = newMessage;
            setInputMessage(newMessage);
            resizeTextareaThrottled();
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error === 'no-speech') return;
            if (event.error !== 'aborted') {
                setIsRecognizing(false);
                isRecognizingRef.current = false;
                toast.error(`Speech recognition failed: ${event.error}`);
            }
        };

        recognition.onend = () => {
            const currentInput = inputMessageRef.current;

            // ── EDIT DETECTION (gap version) ─────────────────────────────────
            // Same normalised comparison as in onresult, for edits made while
            // the mic was paused (before onend fires).
            if (normalise(currentInput) !== normalise(lastSetValueRef.current)) {
                const currentMaxIndex = finalResultsByIndexRef.current.size > 0
                    ? Math.max(...finalResultsByIndexRef.current.keys())
                    : -1;
                resultIndexFloorRef.current = currentMaxIndex;
                preExistingTextRef.current = currentInput.trimEnd();
                previousSessionsTextRef.current = '';
                currentSessionFinalsRef.current = '';
                finalResultsByIndexRef.current.clear();
                lastSetValueRef.current = currentInput;
                lastSessionInterimRef.current = '';
            } else {
                const existingFinal = [previousSessionsTextRef.current, currentSessionFinalsRef.current]
                    .filter(Boolean).join(' ').trim();

                if (existingFinal) {
                    // Normal desktop path — finals were committed
                    const finalMessage = [preExistingTextRef.current, existingFinal]
                        .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
                    setInputMessage(finalMessage);
                    preExistingTextRef.current = finalMessage;
                    previousSessionsTextRef.current = '';
                    currentSessionFinalsRef.current = '';
                    finalResultsByIndexRef.current.clear();
                    resultIndexFloorRef.current = -1;
                    lastSessionInterimRef.current = ''; // clean finals → no replay expected

                } else if (currentInput.trim()) {
                    // ── ANDROID FIX #2 + #3 ──────────────────────────────────
                    // Android fired onend without any isFinal result (mic-drop).
                    // The textarea contains interim text the user expects to keep.
                    //
                    // Fix #2: commit that interim as preExistingTextRef so the
                    // next session appends to it correctly instead of to "".
                    //
                    // Fix #3: save the interim as lastSessionInterimRef so the
                    // next session can detect and strip Android's replay of it.
                    preExistingTextRef.current = currentInput.trimEnd();
                    lastSessionInterimRef.current = currentInput.trimEnd();
                    previousSessionsTextRef.current = '';
                    currentSessionFinalsRef.current = '';
                    finalResultsByIndexRef.current.clear();
                    resultIndexFloorRef.current = -1;
                    // Keep lastSetValueRef as-is (it already equals currentInput)
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
            lastSessionInterimRef.current = ''; // fresh start — no phantom prefix
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
            preExistingTextRef.current = inputMessageRef.current.trimEnd();
            lastSessionInterimRef.current = ''; // user stopped — no replay expected
            toast.success('Speech recognition stopped.');
        }
    }, [inputMessageRef]);

    return { isRecognizing, startRecognition, stopRecognition, micPermissionStatus };
};