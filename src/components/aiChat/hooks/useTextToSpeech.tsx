
import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Message } from '../../../types/Class';

interface UseTextToSpeechProps {
  messages: Message[];
  isLoading: boolean;
  isLoadingSessionMessages: boolean;
  isPhone: () => boolean;
  stripCodeBlocks: (content: string) => string;
}
const stripMarkdownForSpeech = (content: string): string => {
  if (!content) return '';

  // 1. SPLIT: Divide content into an array by Code Blocks
  // The capturing group () keeps the delimiter in the array
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map(part => {
    // 2. CHECK: Is this a Code Block?
    if (part.startsWith('```')) {
      return ' code block '; // Replace massive blocks with a simple phrase
    }

    // 3. PROCESS: This is normal text (Safe Zone)
    let text = part;

    // Remove Images
    text = text.replace(/!\[.*?\]\(.*?\)/g, '');

    // Unwrap Inline Code (Safe now because we removed the ``` blocks)
    // `const x` -> const x
    text = text.replace(/`([^`]+)`/g, '$1');

    // Unwrap Links
    // [Google](https://google.com) -> Google
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

    // Remove HTML tags (Safe version)
    // Only removes tags that look like <div... or </span... 
    // Preserves math like "x < 5"
    text = text.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, '');

    // Remove formatting (*, _, #)
    text = text.replace(/[*_~#]+/g, '');

    return text;
  })
    // 4. JOIN: Stitch it all back together
    .join(' ')
    // 5. CLEANUP: Fix whitespace
    .replace(/\s+/g, ' ').trim();
};
const removeEmojis = (text: string): string => {
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{2B55}\u{2934}\u{2935}\u{2B05}\u{2B06}\u{27A1}\u{1F1E6}-\u{1F1FF}]/gu;
  return text.replace(emojiRegex, '');
};

const cleanContentForSpeech = (content: string, stripCodeBlocks: (content: string) => string): string => {
  // Step 1: Strip code blocks using provided function
  let cleanedContent = stripCodeBlocks(content);

  // Step 2: Strip all markdown formatting
  cleanedContent = stripMarkdownForSpeech(cleanedContent);

  // Step 3: Remove emojis
  cleanedContent = removeEmojis(cleanedContent);

  // Step 4: Final cleanup
  cleanedContent = cleanedContent.trim();

  return cleanedContent;
};

export const useTextToSpeech = ({
  messages,
  isLoading,
  isLoadingSessionMessages,
  isPhone,
  stripCodeBlocks,
}: UseTextToSpeechProps) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isAutoSpeakEnabled, setIsAutoSpeakEnabled] = useState(false);
  const speechSynthesisRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const lastSpokenChunkRef = useRef<string>('');
  const blockAutoSpeakRef = useRef<boolean>(false);
  const lastProcessedMessageIdRef = useRef<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);

  const stopSpeech = useCallback(() => {
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.cancel();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      setIsPaused(false);
      currentUtteranceRef.current = null;
      lastSpokenChunkRef.current = '';
      blockAutoSpeakRef.current = true;
    }
  }, []);

  // Stop speech when messages change (session change detection)
  useEffect(() => {
    const currentSessionId = messages.length > 0 ? messages[0]?.session_id : null;

    // If session changed, stop speech
    if (currentSessionIdRef.current && currentSessionId !== currentSessionIdRef.current) {
      //console.log('🔇 Session changed, stopping speech');
      stopSpeech();
    }

    currentSessionIdRef.current = currentSessionId;
  }, [messages, stopSpeech]);

  // Cleanup speech on unmount (when leaving chat interface)
  useEffect(() => {
    return () => {
      //console.log('🔇 Component unmounting, stopping speech');
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, []);

  const pauseSpeech = useCallback(() => {
    if (speechSynthesisRef.current && isSpeaking && !isPaused) {
      speechSynthesisRef.current.pause();
      setIsPaused(true);
    }
  }, [isSpeaking, isPaused]);

  const resumeSpeech = useCallback(() => {
    if (speechSynthesisRef.current && isSpeaking && isPaused) {
      speechSynthesisRef.current.resume();
      setIsPaused(false);
    }
  }, [isSpeaking, isPaused]);

  const speakMessage = useCallback((messageId: string, content: string) => {
    if (!speechSynthesisRef.current) {
      toast.error('Text-to-speech is not supported in this browser.');
      return;
    }

    stopSpeech();

    // Clean content using enhanced markdown stripper
    const cleanedContent = cleanContentForSpeech(content, stripCodeBlocks);

    if (!cleanedContent || cleanedContent.length < 3) {
      toast.info('No readable text found in this message.');
      return;
    }

    //console.log('🔊 Speaking cleaned text:', cleanedContent.substring(0, 100) + '...');

    const utterance = new SpeechSynthesisUtterance(cleanedContent);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      setIsPaused(false);
      currentUtteranceRef.current = null;
      lastSpokenChunkRef.current = '';
      lastProcessedMessageIdRef.current = messageId;
      blockAutoSpeakRef.current = true;
    };

    utterance.onerror = (event) => {
      if (event.error === 'interrupted') return;
      //console.error('Speech synthesis error:', event.error);
      toast.error(`Speech synthesis failed: ${event.error}`);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      setIsPaused(false);
      currentUtteranceRef.current = null;
      lastSpokenChunkRef.current = '';
      lastProcessedMessageIdRef.current = messageId;
      blockAutoSpeakRef.current = true;
    };

    speechSynthesisRef.current.cancel();
    currentUtteranceRef.current = utterance;
    speechSynthesisRef.current.speak(utterance);
    setIsSpeaking(true);
    setSpeakingMessageId(messageId);
    setIsPaused(false);
    lastSpokenChunkRef.current = cleanedContent;
    lastProcessedMessageIdRef.current = messageId;
  }, [stopSpeech, stripCodeBlocks]);

  const toggleAutoSpeak = useCallback(() => {
    setIsAutoSpeakEnabled(prev => {
      const newValue = !prev;
      toast.success(newValue ? '🔊 Auto-speak enabled' : '🔇 Auto-speak disabled');
      return newValue;
    });
  }, []);

  // Auto-speak effect for new messages
  useEffect(() => {
    if (
      !isPhone() ||
      isLoading ||
      isLoadingSessionMessages ||
      !speechSynthesisRef.current ||
      blockAutoSpeakRef.current ||
      !isAutoSpeakEnabled
    ) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage?.role === 'assistant' &&
      !lastMessage.isError &&
      lastMessage.id !== lastProcessedMessageIdRef.current &&
      !isSpeaking &&
      !isPaused
    ) {
      // Clean content using enhanced markdown stripper
      const cleanedContent = cleanContentForSpeech(lastMessage.content, stripCodeBlocks);

      if (cleanedContent && cleanedContent.length >= 3) {
        //console.log('🔊 Auto-speaking cleaned text:', cleanedContent.substring(0, 100) + '...');

        const utterance = new SpeechSynthesisUtterance(cleanedContent);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onend = () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
          setIsPaused(false);
          currentUtteranceRef.current = null;
          lastSpokenChunkRef.current = '';
          lastProcessedMessageIdRef.current = lastMessage.id;
          blockAutoSpeakRef.current = true;
        };

        utterance.onerror = (event) => {
          if (event.error === 'interrupted') return;
          //console.error('Speech synthesis error:', event.error);
          toast.error(`Speech synthesis failed: ${event.error}`);
          setIsSpeaking(false);
          setSpeakingMessageId(null);
          setIsPaused(false);
          currentUtteranceRef.current = null;
          lastSpokenChunkRef.current = '';
          lastProcessedMessageIdRef.current = lastMessage.id;
          blockAutoSpeakRef.current = true;
        };

        speechSynthesisRef.current.cancel();
        currentUtteranceRef.current = utterance;
        speechSynthesisRef.current.speak(utterance);
        setIsSpeaking(true);
        setSpeakingMessageId(lastMessage.id);
        lastSpokenChunkRef.current = cleanedContent;
        lastProcessedMessageIdRef.current = lastMessage.id;
      }
    }
  }, [messages, isLoading, isLoadingSessionMessages, isPhone, isSpeaking, isPaused, stripCodeBlocks, isAutoSpeakEnabled]);

  return {
    isSpeaking,
    speakingMessageId,
    isPaused,
    speakMessage,
    pauseSpeech,
    resumeSpeech,
    stopSpeech,
    toggleAutoSpeak,
    isAutoSpeakEnabled
  };
};