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
  let text = content;

  // 1. Remove code blocks FIRST (triple backticks with content)
  text = text.replace(/```[\s\S]*?```/g, ' '); // Block code with space replacement
  text = text.replace(/`[^`]+`/g, ' '); // Inline code with space replacement

  // 2. Remove HTML tags
  text = text.replace(/<[^>]*>/g, ' ');

  // 3. Remove ALL # symbols (headers) - more aggressive approach
  text = text.replace(/#/g, ''); // Remove ALL hash symbols

  // 4. Remove bold/italic/strikethrough markers - more aggressive
  text = text.replace(/[*_~]{1,3}/g, ''); // Remove all asterisks, underscores, tildes

  // 5. Convert links to readable format
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // [text](url) → text
  text = text.replace(/<(https?:\/\/[^\s>]+)>/g, ' '); // Remove <url>
  text = text.replace(/https?:\/\/[^\s]+/g, ' '); // Remove bare URLs

  // 6. Remove images
  text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, ''); // ![alt](url)

  // 7. Convert lists to readable format - remove ALL list markers
  text = text.replace(/^\s*[-*+•]\s+/gm, ''); // Unordered lists
  text = text.replace(/^\s*\d+\.\s+/gm, ''); // Ordered lists

  // 8. Remove blockquote markers
  text = text.replace(/^\s*>\s*/gm, '');

  // 9. Remove horizontal rules
  text = text.replace(/^[\s]*[-*_]{3,}[\s]*$/gm, ' ');

  // 10. Remove table formatting
  text = text.replace(/\|/g, ' '); // Remove pipe characters
  text = text.replace(/^[\s]*:?-+:?[\s]*$/gm, ''); // Remove table separators

  // 11. Remove emojis
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{2B55}\u{2934}\u{2935}\u{2B05}\u{2B06}\u{27A1}\u{1F1E6}-\u{1F1FF}]/gu;
  text = text.replace(emojiRegex, ' ');

  // 12. Remove special markdown characters
  text = text.replace(/[`~]/g, ''); // Remove backticks and tildes
  text = text.replace(/\\/g, ''); // Remove escape characters

  // 13. Clean up excessive whitespace and punctuation
  text = text.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
  text = text.replace(/[ \t]{2,}/g, ' '); // Multiple spaces to single space
  text = text.replace(/\s*:\s*/g, ': '); // Clean up colons
  text = text.replace(/\s*\(\s*/g, ' ('); // Clean up parentheses
  text = text.replace(/\s*\)\s*/g, ') ');

  // 14. Final cleanup
  text = text.trim();
  text = text.replace(/\s+/g, ' '); // Collapse all whitespace to single space

  return text;
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

    console.log('🔊 Speaking cleaned text:', cleanedContent.substring(0, 100) + '...');

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
      console.error('Speech synthesis error:', event.error);
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
        console.log('🔊 Auto-speaking cleaned text:', cleanedContent.substring(0, 100) + '...');

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
          console.error('Speech synthesis error:', event.error);
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