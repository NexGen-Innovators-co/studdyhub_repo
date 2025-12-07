// ============================================
// 2. UNIVERSAL TUTORIAL COMPONENT
// ============================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Play,
  Square,
  Sparkles,
  Brain,
  Download,
  Volume2,
  VolumeX,
  UploadCloud,
  Mic,
  BookOpen,
  Zap,
  HelpCircle,
  Target,
  Check,
  SkipForward,
  Pause,
  Info,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  Rocket,
} from 'lucide-react';
import { Button } from '../../ui/button';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  elementSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  highlightPadding?: number;
  videoUrl?: string;
  imageUrl?: string;
  tips?: string[];
  keyboardShortcuts?: Array<{ keys: string; action: string }>;
  actions?: Array<{ label: string; onClick: () => void }>;
  customContent?: React.ReactNode;
}

export interface TutorialConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  steps: TutorialStep[];
  completionMessage?: string;
  autoStart?: boolean;
  showProgress?: boolean;
}

interface UniversalTutorialProps {
  config: TutorialConfig;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface TooltipPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Mobile detection hook
const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

interface TTSState {
  isSpeaking: boolean;
  isEnabled: boolean;
  isAvailable: boolean;
  currentUtterance: SpeechSynthesisUtterance | null;
  isPaused: boolean;
}

export const UniversalTutorial: React.FC<UniversalTutorialProps> = ({
  config,
  isOpen,
  onClose,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [hasCompleted, setHasCompleted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isMobile = useMobileDetection();
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef(false);

  // TTS State with availability check
  const [tts, setTts] = useState<TTSState>({
    isSpeaking: false,
    isEnabled: true,
    isAvailable: false,
    currentUtterance: null,
    isPaused: false
  });

  // Check TTS availability on component mount
  useEffect(() => {
    const checkTTSAvailability = () => {
      const isAvailable = 'speechSynthesis' in window;
      //console.log('TTS Available:', isAvailable);
      setTts(prev => ({ ...prev, isAvailable }));

      if (isAvailable) {
        // Preload voices
        const voices = window.speechSynthesis.getVoices();
        //console.log('Available voices:', voices);

        // If voices aren't loaded yet, wait for them
        if (voices.length === 0) {
          window.speechSynthesis.onvoiceschanged = () => {
            const loadedVoices = window.speechSynthesis.getVoices();
            //console.log('Voices loaded:', loadedVoices);
            setTts(prev => ({ ...prev, isAvailable: loadedVoices.length > 0 }));
          };
        }
      }
    };

    checkTTSAvailability();
  }, []);

  const currentStepData = config.steps[currentStep];
  const isLastStep = currentStep === config.steps.length - 1;

  // Improved TTS function with queue system
  const speakText = useCallback((text: string) => {
    if (!tts.isEnabled || !tts.isAvailable || !window.speechSynthesis) {
      //console.log('TTS not available or disabled');
      return;
    }

    // Add to queue
    speechQueueRef.current.push(text);

    // If already speaking, just add to queue and return
    if (isSpeakingRef.current) {
      //console.log('Added to speech queue:', text.substring(0, 50) + '...');
      return;
    }

    // Process the queue
    processSpeechQueue();
  }, [tts.isEnabled, tts.isAvailable]);

  const processSpeechQueue = () => {
    if (speechQueueRef.current.length === 0 || !window.speechSynthesis) {
      isSpeakingRef.current = false;
      setTts(prev => ({ ...prev, isSpeaking: false, currentUtterance: null }));
      return;
    }

    const text = speechQueueRef.current[0];
    isSpeakingRef.current = true;

    try {
      const utterance = new SpeechSynthesisUtterance(text);

      // Configure voice settings
      utterance.rate = 0.9; // Slightly slower for better comprehension
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Get available voices
      const voices = window.speechSynthesis.getVoices();

      // Voice selection logic
      const preferredVoice = voices.find(voice =>
        voice.lang.includes('en') &&
        (voice.name.includes('Google') ||
          voice.name.includes('Samantha') ||
          voice.name.includes('Microsoft') ||
          voice.name.includes('Karen') ||
          voice.name.includes('Daniel'))
      );

      if (preferredVoice) {
        utterance.voice = preferredVoice;
        //console.log('Using voice:', preferredVoice.name);
      } else if (voices.length > 0) {
        // Use first available English voice
        const englishVoice = voices.find(voice => voice.lang.includes('en'));
        if (englishVoice) {
          utterance.voice = englishVoice;
          //console.log('Using English voice:', englishVoice.name);
        } else {
          utterance.voice = voices[0];
          //console.log('Using default voice:', voices[0].name);
        }
      }

      utterance.onstart = () => {
        //console.log('Speech started successfully');
        setTts(prev => ({ ...prev, isSpeaking: true, currentUtterance: utterance, isPaused: false }));
      };

      utterance.onend = () => {
        //console.log('Speech ended normally');
        // Remove the completed speech from queue
        speechQueueRef.current.shift();
        // Process next in queue
        setTimeout(() => processSpeechQueue(), 100);
      };

      utterance.onerror = (event) => {
        //console.error('Speech error:', event.error, event.type);
        // Remove the failed speech from queue
        speechQueueRef.current.shift();
        // Process next in queue after a delay
        setTimeout(() => processSpeechQueue(), 100);
      };

      utterance.onpause = () => {
        setTts(prev => ({ ...prev, isPaused: true }));
      };

      utterance.onresume = () => {
        setTts(prev => ({ ...prev, isPaused: false }));
      };

      //console.log('Attempting to speak text:', text.substring(0, 50) + '...');
      window.speechSynthesis.speak(utterance);

    } catch (error) {
      //console.error('Error with speech synthesis:', error);
      speechQueueRef.current.shift();
      setTimeout(() => processSpeechQueue(), 100);
    }
  };

  // Manual speak function for current step
  const speakCurrentStep = () => {
    if (currentStepData) {
      const textToSpeak = `${currentStepData.title}. ${currentStepData.description}`;
      speakText(textToSpeak);
    }
  };

  // Improved stop speaking function
  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    speechQueueRef.current = [];
    isSpeakingRef.current = false;
    setTts(prev => ({ ...prev, isSpeaking: false, currentUtterance: null, isPaused: false }));
  };

  // Pause/resume speech
  const toggleSpeechPause = () => {
    if (!window.speechSynthesis) return;

    if (tts.isPaused) {
      window.speechSynthesis.resume();
      setTts(prev => ({ ...prev, isPaused: false }));
    } else if (tts.isSpeaking) {
      window.speechSynthesis.pause();
      setTts(prev => ({ ...prev, isPaused: true }));
    }
  };

  const toggleTTS = () => {
    if (tts.isSpeaking) {
      stopSpeaking();
    }
    setTts(prev => ({ ...prev, isEnabled: !prev.isEnabled }));
  };

  // Test TTS function
  const testTTS = () => {
    const testText = "This is a test of the text to speech functionality. The queue system should prevent interruptions.";
    speakText(testText);
  };

  // Reset everything when tutorial opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setHasCompleted(false);
      setIsPlaying(true);
      // Clear any existing queue
      speechQueueRef.current = [];
      isSpeakingRef.current = false;
    } else {
      setHasCompleted(false);
      stopSpeaking();
    }
  }, [isOpen]);

  // Stop speaking when tutorial closes
  useEffect(() => {
    if (!isOpen) {
      stopSpeaking();
    }
  }, [isOpen]);

  // Auto-speak when step changes and TTS is enabled
  useEffect(() => {
    if (isOpen && isPlaying && currentStepData && tts.isEnabled) {
      // Clear any existing speech
      stopSpeaking();

      // Small delay to ensure DOM is updated
      setTimeout(() => {
        const textToSpeak = `${currentStepData.title}. ${currentStepData.description}`;
        speakText(textToSpeak);
      }, 500);
    }
  }, [currentStep, isPlaying, tts.isEnabled, currentStepData, isOpen]);

  // Calculate position with mobile adjustments
  const calculatePosition = useCallback(() => {
    if (!currentStepData.elementSelector) {
      setHighlightRect(null);
      setTooltipPosition(null);
      return;
    }

    const element = document.querySelector(currentStepData.elementSelector);
    if (!element) {
      setHighlightRect(null);
      setTooltipPosition(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = currentStepData.highlightPadding || 8;

    setHighlightRect(new DOMRect(
      rect.x - padding,
      rect.y - padding,
      rect.width + padding * 2,
      rect.height + padding * 2
    ));

    // Mobile-specific adjustments
    const tooltipWidth = isMobile ? Math.min(350, window.innerWidth - 40) : 380;
    const tooltipHeight = isMobile ? 280 : 300;
    const margin = isMobile ? 10 : 20;
    const arrowSize = 12;

    let top = 0;
    let left = 0;
    let position = currentStepData.position || 'bottom';

    // Auto-adjust position for mobile
    if (isMobile) {
      if (position === 'top' || position === 'left' || position === 'right') {
        position = 'bottom';
      }
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    switch (position) {
      case 'top':
        top = rect.top - tooltipHeight - margin - arrowSize;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        if (top < 0) position = 'bottom';
        break;
      case 'bottom':
        top = rect.bottom + margin + arrowSize;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        if (top + tooltipHeight > viewportHeight) position = 'top';
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - margin - arrowSize;
        if (left < 0) position = 'right';
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + margin + arrowSize;
        if (left + tooltipWidth > viewportWidth) position = 'left';
        break;
      case 'center':
        top = viewportHeight / 2 - tooltipHeight / 2;
        left = viewportWidth / 2 - tooltipWidth / 2;
        break;
    }

    // Clamp to viewport with mobile-safe margins
    const safeMargin = isMobile ? 5 : margin;
    top = Math.max(safeMargin, Math.min(top, viewportHeight - tooltipHeight - safeMargin));
    left = Math.max(safeMargin, Math.min(left, viewportWidth - tooltipWidth - safeMargin));

    setTooltipPosition({ top, left, width: tooltipWidth, height: tooltipHeight });

    // Scroll element into view with mobile consideration
    element.scrollIntoView({
      behavior: 'smooth',
      block: isMobile ? 'center' : 'center',
      inline: 'center'
    });
  }, [currentStepData, isMobile]);

  // Recalculate position when step changes or window resizes
  useEffect(() => {
    calculatePosition();

    const handleResize = () => {
      calculatePosition();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculatePosition]);

  const nextStep = () => {
    stopSpeaking(); // Clear any ongoing speech
    if (isLastStep) {
      setHasCompleted(true);
      onComplete?.();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    stopSpeaking(); // Clear any ongoing speech
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const skipTutorial = () => {
    stopSpeaking();
    setHasCompleted(false);
    onClose();
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      stopSpeaking();
    }
    setIsPlaying(prev => !prev);
  };

  // Speak additional content functions
  const speakTips = () => {
    if (currentStepData.tips && currentStepData.tips.length > 0) {
      const tipsText = `Pro tips: ${currentStepData.tips.join('. ')}`;
      speakText(tipsText);
    }
  };

  const speakShortcuts = () => {
    if (currentStepData.keyboardShortcuts && currentStepData.keyboardShortcuts.length > 0) {
      const shortcutsText = `Keyboard shortcuts: ${currentStepData.keyboardShortcuts.map(s => `${s.action}: ${s.keys}`).join('. ')}`;
      speakText(shortcutsText);
    }
  };

  const handleCompletionClose = () => {
    stopSpeaking();
    setHasCompleted(false);
    onClose();
  };

  if (!isOpen) return null;

  // Completion celebration
  if (hasCompleted) {
    return createPortal(
      <div
        className="fixed inset-0 bg-transparent z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={handleCompletionClose}
      >
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl shadow-2xl p-12 text-center max-w-md animate-in zoom-in duration-500">
          <div className="mb-6">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto animate-bounce">
              <Check className="w-12 h-12 text-green-600" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">
            🎉 Tutorial Complete!
          </h2>
          <p className="text-white/90 text-lg mb-6">
            {config.completionMessage || "You're now a note-taking pro! Start creating amazing notes."}
          </p>
          <Button
            onClick={handleCompletionClose}
            className="bg-white text-green-600 hover:bg-gray-100 font-semibold py-3 px-6 rounded-xl"
          >
            Got it!
          </Button>
          <p className="text-white/70 text-sm mt-3">
            Click anywhere to close
          </p>
        </div>
      </div>,
      document.body
    );
  }

  // Tooltip class with mobile adjustments
  const tooltipClass = `absolute bg-white dark:bg-gray-800 rounded-2xl shadow-2xl transition-all duration-500 animate-in slide-in-from-bottom-4 fade-in ${currentStepData.position === 'center' ? 'max-w-3xl' : 'max-w-md'
    } ${isMobile ? 'mx-4' : ''}`;

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      {/* Clear backdrop - only for click handling */}
      <div
        className="absolute inset-0 bg-transparent transition-opacity duration-500"
        onClick={isPlaying ? undefined : skipTutorial}
      />

      {/* Highlight spotlight */}
      {highlightRect && isPlaying && (
        <>
          {/* Animated ring */}
          <div
            className="absolute border-4 border-blue-500 rounded-lg animate-pulse pointer-events-none transition-all duration-300"
            style={{
              top: highlightRect.y,
              left: highlightRect.x,
              width: highlightRect.width,
              height: highlightRect.height,
              boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3), 0 0 30px rgba(59, 130, 246, 0.5)',
            }}
          />

          {/* Pulsing glow effect */}
          <div
            className="absolute rounded-lg pointer-events-none animate-ping"
            style={{
              top: highlightRect.y - 4,
              left: highlightRect.x - 4,
              width: highlightRect.width + 8,
              height: highlightRect.height + 8,
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)',
            }}
          />
        </>
      )}

      {/* Tooltip/Modal */}
      {isPlaying && (
        <div
          ref={tooltipRef}
          className={tooltipClass}
          style={{
            top: tooltipPosition?.top || '50%',
            left: tooltipPosition?.left || '50%',
            transform: !tooltipPosition ? 'translate(-50%, -50%)' : undefined,
            width: isMobile ? 'auto' : (currentStepData.position === 'center' ? '90%' : '380px'),
            maxWidth: isMobile ? 'calc(100vw - 32px)' : undefined,
            maxHeight: '85vh',
            zIndex: 10000,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center animate-pulse">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                  {config.name}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Step {currentStep + 1} of {config.steps.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* TTS Status Indicator */}
              {!tts.isAvailable && (
                <div className="text-xs text-red-500 mr-2" title="Text-to-speech not available in this browser">
                  No TTS
                </div>
              )}

              {/* TTS Controls */}
              {tts.isAvailable && tts.isEnabled && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSpeechPause}
                    className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900"
                    title={tts.isPaused ? 'Resume speech' : 'Pause speech'}
                  >
                    {tts.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </Button>

                </>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTTS}
                className={`h-8 w-8 p-0 ${tts.isEnabled && tts.isAvailable
                  ? 'text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900'
                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                title={tts.isAvailable
                  ? (tts.isEnabled ? 'Disable Voice' : 'Enable Voice')
                  : 'Text-to-speech not available'
                }
                disabled={!tts.isAvailable}
              >
                {tts.isEnabled && tts.isAvailable ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>

              {/* Test TTS Button - remove in production */}
              {process.env.NODE_ENV === 'development' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={testTTS}
                  className="h-8 w-8 p-0 text-green-600"
                  title="Test TTS"
                >
                  <Zap className="w-4 h-4" />
                </Button>
              )}


              <Button
                variant="ghost"
                size="sm"
                onClick={skipTutorial}
                className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900"
                title="Skip Tutorial"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto modern-scrollbar">
            {/* TTS Status Information */}
            {!tts.isAvailable && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3">
                <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                  <Info className="w-4 h-4" />
                  <span>
                    Text-to-speech is not available in your browser.
                    {!window.speechSynthesis && ' Your browser does not support speech synthesis.'}
                  </span>
                </div>
              </div>
            )}


            {/* Step Title */}
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {currentStepData.title}
                </h4>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {currentStepData.description}
                </p>
              </div>
            </div>

            {/* Custom Content */}
            {currentStepData.customContent && (
              <div className="mt-4">
                {currentStepData.customContent}
              </div>
            )}

            {/* Tips */}
            {currentStepData.tips && currentStepData.tips.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <h5 className="font-semibold text-amber-900 dark:text-amber-100 text-sm">
                      Pro Tips
                    </h5>
                  </div>
                </div>
                <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
                  {currentStepData.tips.map((tip, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Keyboard Shortcuts */}
            {currentStepData.keyboardShortcuts && currentStepData.keyboardShortcuts.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-semibold text-gray-900 dark:text-white text-sm">
                    Keyboard Shortcuts
                  </h5>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={speakShortcuts}
                    className="h-6 w-6 p-0"
                    title="Read shortcuts aloud"
                    disabled={!tts.isEnabled || !tts.isAvailable}
                  >
                    <Volume2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {currentStepData.keyboardShortcuts.map((shortcut, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{shortcut.action}</span>
                      <kbd className="px-2 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs font-mono shadow-sm">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Video Demo */}
            {currentStepData.videoUrl && (
              <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden">
                <video
                  src={currentStepData.videoUrl}
                  controls
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                />
              </div>
            )}

            {/* Image */}
            {currentStepData.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600">
                <img
                  src={currentStepData.imageUrl}
                  alt={currentStepData.title}
                  className="w-full h-auto"
                />
              </div>
            )}

            {/* Custom Actions */}
            {currentStepData.actions && currentStepData.actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentStepData.actions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={action.onClick}
                    className="text-xs"
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-2xl">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
              size="sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            {/* Progress Dots */}
            {config.showProgress !== false && (
              <div className="flex items-center gap-2">
                {config.steps.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      stopSpeaking();
                      setCurrentStep(index);
                    }}
                    className={`h-2 rounded-full transition-all duration-300 ${index === currentStep
                      ? 'w-8 bg-blue-600'
                      : index < currentStep
                        ? 'w-2 bg-green-500'
                        : 'w-2 bg-gray-300 dark:bg-gray-600'
                      }`}
                    title={`Step ${index + 1}`}
                  />
                ))}
              </div>
            )}

            <Button
              onClick={nextStep}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              size="sm"
            >
              {isLastStep ? (
                <>
                  Complete
                  <Rocket className="w-4 h-4" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Arrow pointer (when highlighting an element) */}
      {highlightRect && tooltipPosition && isPlaying && currentStepData.elementSelector && (
        <div
          className="absolute pointer-events-none z-[10001]"
          style={{
            top: highlightRect.y + highlightRect.height / 2,
            left: highlightRect.x + highlightRect.width / 2,
          }}
        >
          {currentStepData.position === 'top' && (
            <div className="animate-bounce" style={{ transform: 'translateY(-60px)' }}>
              <ArrowDown className="w-8 h-8 text-blue-500 drop-shadow-lg" />
            </div>
          )}
          {currentStepData.position === 'bottom' && (
            <div className="animate-bounce" style={{ transform: 'translateY(60px)' }}>
              <ArrowUp className="w-8 h-8 text-blue-500 drop-shadow-lg" />
            </div>
          )}
          {currentStepData.position === 'left' && (
            <div className="animate-bounce" style={{ transform: 'translateX(-60px)' }}>
              <ArrowRight className="w-8 h-8 text-blue-500 drop-shadow-lg" />
            </div>
          )}
          {currentStepData.position === 'right' && (
            <div className="animate-bounce" style={{ transform: 'translateX(60px)' }}>
              <ArrowLeft className="w-8 h-8 text-blue-500 drop-shadow-lg" />
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  );
};