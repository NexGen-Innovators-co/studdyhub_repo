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

  const frames = [
    {
      icon: '🎉',
      title: "You're All Set!",
      subtitle: 'Welcome to StudyHub',
      description: 'Your learning journey starts now',
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: '🤖',
      title: 'Chat with AI',
      subtitle: 'Ask anything, learn anything',
      description: 'Your personal study assistant',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: '📝',
      title: 'Create Notes',
      subtitle: 'Organize your thoughts',
      description: 'Beautiful study material at your fingertips',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: '👥',
      title: 'Learn Together',
      subtitle: 'Connect with others',
      description: 'Find your study tribe',
      color: 'from-orange-500 to-red-500',
    },
  ];

  useEffect(() => {
    // Simulate celebration with confetti-like animation
    const triggerCelebration = () => {
      // Create floating elements
      for (let i = 0; i < 20; i++) {
        const element = document.createElement('div');
        element.className = 'fixed pointer-events-none';
        element.innerHTML = ['🎉', '⭐', '✨', '🌟', '💫'][Math.floor(Math.random() * 5)];
        element.style.left = Math.random() * 100 + '%';
        element.style.top = '-20px';
        element.style.fontSize = Math.random() * 20 + 20 + 'px';
        element.style.animation = `float ${Math.random() * 2 + 3}s linear forwards`;
        document.body.appendChild(element);

        setTimeout(() => element.remove(), 3500);
      }
    };

    triggerCelebration();
  }, []);

  useEffect(() => {
    let hasTriggeredCompletion = false;
    const interval = setInterval(() => {
      setFrameIndex((prev) => {
        if (prev >= frames.length - 1) {
          if (hasTriggeredCompletion) return prev;
          hasTriggeredCompletion = true;
          // Auto-transition to dashboard after final frame
          setTimeout(() => {
            if (onDone) {
              onDone();
              return;
            }
            if (autoNavigate) {
              navigate('/dashboard?isNewUser=true');
            }
          }, 2000);
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [autoNavigate, frames.length, navigate, onDone]);

  const currentFrame = frames[frameIndex];

  return (
    <>
      <style>{`
        @keyframes float {
          to {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideup {
          animation: slideUp 0.6s ease-out;
        }
      `}</style>

      <div className={`flex items-center justify-center min-h-screen bg-gradient-to-br ${currentFrame.color} transition-all duration-700`}>
        <div className="text-center text-white px-6 max-w-md">
          {/* Icon with bounce animation */}
          <div className="text-7xl mb-6 animate-slideup" style={{ animation: 'slideUp 0.6s ease-out' }}>
            {currentFrame.icon}
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold mb-3 animate-slideup">
            {currentFrame.title}
          </h1>

          {/* Subtitle */}
          <p className="text-xl text-white/90 mb-4 animate-slideup">
            {currentFrame.subtitle}
          </p>

          {/* Description */}
          <p className="text-white/80 mb-8 animate-slideup">
            {currentFrame.description}
          </p>

          {/* Progress Indicator */}
          <div className="flex justify-center gap-2 mb-8">
            {frames.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i <= frameIndex ? 'w-8 bg-white' : 'w-2 bg-white/50'
                }`}
              />
            ))}
          </div>

          {/* Final Frame CTA */}
          {frameIndex === frames.length - 1 && (
            <div className="space-y-3 animate-slideup">
              <Button
                size="lg"
                className="w-full bg-white text-current hover:bg-white/90 font-bold text-lg"
                onClick={() => {
                  if (onDone) {
                    onDone();
                    return;
                  }
                  if (autoNavigate) {
                    navigate('/dashboard?isNewUser=true');
                  }
                }}
              >
                See Your Dashboard →
              </Button>
              <p className="text-sm text-white/70">Redirecting in 2 seconds...</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
