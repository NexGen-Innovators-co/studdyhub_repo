import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface OnboardingSuccessScreenProps {
  onDone?: () => void;
  autoNavigate?: boolean;
}

export default function OnboardingSuccessScreen({
  onDone,
  autoNavigate = true,
}: OnboardingSuccessScreenProps) {
  const navigate = useNavigate();
  const [frameIndex, setFrameIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const frames = [
    {
      title: "You're all set!",
      description: 'Your profile is ready and your AI assistant is waiting',
    },
    {
      title: 'Ask questions, explore ideas',
      description: 'Chat with AI to learn about anything you are curious about',
    },
    {
      title: 'Organize what matters',
      description: 'Create notes and save resources to build your personal study library',
    },
    {
      title: 'Study together',
      description: 'Connect with people learning the same things you are',
    },
  ];

  // Auto-advance frames every 2.5 seconds (but not on final frame)
  useEffect(() => {
    if (frameIndex >= frames.length - 1) return; // Stop auto-advancing on final frame

    const timer = setTimeout(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setFrameIndex((prev) => prev + 1);
        setIsTransitioning(false);
      }, 300);
    }, 2500);

    return () => clearTimeout(timer);
  }, [frameIndex, frames.length]);

  const currentFrame = frames[frameIndex];
  const progress = (frameIndex + 1) / frames.length;

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-950 flex flex-col items-center justify-center overflow-hidden">
      {/* Subtle animated background */}
      <div className="absolute inset-0 opacity-40 dark:opacity-20">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200 dark:bg-blue-900 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-200 dark:bg-indigo-900 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg">
        {/* Progress indicator */}
        <div className="mb-12 w-full">
          <div className="h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* Main content with fade transition */}
        <div
          className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
            {currentFrame.title}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {currentFrame.description}
          </p>
        </div>

        {/* Frame indicators */}
        <div className="mt-12 flex justify-center gap-1.5">
          {frames.map((_, i) => (
            <div
              key={i}
              className={`transition-all duration-300 h-1.5 rounded-full ${
                i < frameIndex
                  ? 'w-6 bg-blue-600'
                  : i === frameIndex
                    ? 'w-6 bg-blue-400'
                    : 'w-1.5 bg-gray-300 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* CTA - only on final frame */}
        {frameIndex === frames.length - 1 && (
          <div className="mt-12 space-y-4 w-full animate-fadeIn">
            <Button
              size="lg"
              onClick={() => {
                if (onDone) {
                  onDone();
                } else if (autoNavigate) {
                  navigate('/dashboard?isNewUser=true');
                }
              }}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-2xl transition-all duration-200"
            >
              Go to Dashboard
            </Button>
            {/* <p className="text-sm text-gray-500 dark:text-gray-400">
              Redirecting in 2 seconds...
            </p> */}
          </div>
        )}
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
